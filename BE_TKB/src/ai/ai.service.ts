import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { LlmProvider, LlmToolSpec } from './providers/llm-provider.interface';
import { LLM_PROVIDER } from './providers/llm-provider.interface';

/** One swap option offered to the AI for ranking. */
export interface SwapOptionForAi {
    optionId: string;
    type: 'REPLACE' | 'SWAP';
    /** Human-readable one-line summary the model reasons over. */
    summary: string;
}

export interface SwapAiInput {
    /** Conflict context the model needs to reason over. */
    conflict: {
        teacherName: string;
        teacherCode: string;
        weekNumber: number;
        dayLabel: string;
        period: number;
        subjectName: string;
        className: string;
        reason: string;
    };
    options: SwapOptionForAi[];
}

export interface SwapAiPick {
    optionId: string;
    rationale: string;
    warning?: string;
}

export interface SwapAiOutput {
    picks: SwapAiPick[];
}

@Injectable()
export class AiService {
    constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

    /**
     * Ask the shared AI Router provider to rank the pre-validated swap options.
     * The option id enum limits model output, then the result is validated again.
     */
    async rankSwapOptions(payload: SwapAiInput): Promise<SwapAiOutput> {
        const optionIds = payload.options.map(option => option.optionId);
        const tool: LlmToolSpec = {
            name: 'rank_swaps',
            description: 'Chọn tối đa 2 phương án đổi giáo viên tốt nhất từ danh sách đã cho, kèm lý do tiếng Việt.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    picks: {
                        type: 'array',
                        maxItems: 2,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                optionId: { type: 'string', enum: optionIds },
                                rationale: { type: 'string', description: 'Lý do chọn (tiếng Việt, ngắn gọn)' },
                                warning: { type: 'string', description: 'Cảnh báo nếu có (tùy chọn)' },
                            },
                            required: ['optionId', 'rationale'],
                        },
                    },
                },
                required: ['picks'],
            },
        };

        const systemPrompt =
            'Bạn là trợ lý xếp thời khóa biểu trường THPT. Một giáo viên báo bận tại một tiết đang ' +
            'có lịch dạy. Danh sách phương án dưới đây ĐỀU đã được hệ thống kiểm tra hợp lệ (không trùng ' +
            'tiết, không vi phạm ràng buộc). Nhiệm vụ của bạn: chọn TỐI ĐA 2 phương án tốt nhất và giải ' +
            'thích ngắn gọn bằng tiếng Việt. Ưu tiên: ít xáo trộn nhất, giáo viên thay cùng chuyên môn, ' +
            'phương án thay thế 1 chiều (REPLACE) thường gọn hơn hoán đổi 2 chiều (SWAP) trừ khi SWAP hợp ' +
            'lý hơn. CHỈ được chọn optionId nằm trong danh sách. Luôn gọi hàm rank_swaps.';

        const reply = await this.llm.complete(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(payload) },
            ],
            [tool],
            { requiredToolName: tool.name },
        );
        const call = reply.toolCalls.find(candidate => candidate.name === tool.name);
        if (!call) {
            throw new ServiceUnavailableException('AI không trả về phương án');
        }

        let parsed: SwapAiOutput;
        try {
            parsed = JSON.parse(call.arguments);
        } catch {
            throw new ServiceUnavailableException('Không đọc được kết quả AI');
        }

        const allowed = new Set(optionIds);
        const picks = (Array.isArray(parsed?.picks) ? parsed.picks : [])
            .filter(pick =>
                pick &&
                typeof pick.optionId === 'string' &&
                allowed.has(pick.optionId) &&
                typeof pick.rationale === 'string',
            )
            .slice(0, 2)
            .map(pick => ({
                optionId: pick.optionId,
                rationale: pick.rationale,
                ...(typeof pick.warning === 'string' ? { warning: pick.warning } : {}),
            }));

        return { picks };
    }
}
