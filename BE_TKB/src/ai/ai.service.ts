import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/** One swap option offered to the AI for ranking. */
export interface SwapOptionForAi {
    optionId: string;
    type: 'REPLACE' | 'SWAP';
    /** Human-readable one-line summary the model reasons over. */
    summary: string;
}

export interface SwapAiInput {
    /** Conflict context the model needs to reason about. */
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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';
const TIMEOUT_MS = 15_000;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    /**
     * Ask Claude (via OpenRouter) to rank the pre-validated swap options and pick
     * the best two, with a Vietnamese rationale each. The model is constrained by
     * a forced tool call whose `optionId` enum is exactly the provided option ids,
     * so it cannot invent teachers. The caller MUST still verify each returned
     * optionId against the original list (defence in depth).
     */
    async rankSwapOptions(payload: SwapAiInput): Promise<SwapAiOutput> {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new ServiceUnavailableException('Chưa cấu hình OPENROUTER_API_KEY trên máy chủ');
        }
        const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
        const optionIds = payload.options.map(o => o.optionId);

        const tool = {
            type: 'function',
            function: {
                name: 'rank_swaps',
                description: 'Chọn tối đa 2 phương án swap tốt nhất từ danh sách đã cho, kèm lý do tiếng Việt.',
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
            },
        };

        const systemPrompt =
            'Bạn là trợ lý xếp thời khóa biểu trường THPT. Một giáo viên báo bận tại một tiết đang ' +
            'có lịch dạy. Danh sách phương án dưới đây ĐỀU đã được hệ thống kiểm tra hợp lệ (không trùng ' +
            'tiết, không vi phạm ràng buộc). Nhiệm vụ của bạn: chọn TỐI ĐA 2 phương án tốt nhất và giải ' +
            'thích ngắn gọn bằng tiếng Việt. Ưu tiên: ít xáo trộn nhất, giáo viên thay cùng chuyên môn, ' +
            'phương án thay thế 1 chiều (REPLACE) thường gọn hơn hoán đổi 2 chiều (SWAP) trừ khi SWAP hợp ' +
            'lý hơn. CHỈ được chọn optionId nằm trong danh sách. Luôn gọi hàm rank_swaps.';

        const userPrompt = JSON.stringify(payload);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let res: Response;
        try {
            res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://gettimetable.cloud',
                    'X-Title': 'TKB Admin - Swap Suggester',
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    tools: [tool],
                    tool_choice: { type: 'function', function: { name: 'rank_swaps' } },
                }),
                signal: controller.signal,
            });
        } catch (err: any) {
            this.logger.error(`OpenRouter request failed: ${err?.message ?? err}`);
            throw new ServiceUnavailableException(
                err?.name === 'AbortError'
                    ? 'AI phản hồi quá lâu, vui lòng thử lại'
                    : 'Không kết nối được dịch vụ AI',
            );
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
            throw new ServiceUnavailableException(`Dịch vụ AI lỗi (HTTP ${res.status})`);
        }

        let data: any;
        try {
            data = await res.json();
        } catch {
            throw new ServiceUnavailableException('Phản hồi AI không hợp lệ');
        }

        const argsStr: string | undefined =
            data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!argsStr) {
            this.logger.error(`No tool_call in AI response: ${JSON.stringify(data).slice(0, 500)}`);
            throw new ServiceUnavailableException('AI không trả về phương án');
        }

        let parsed: SwapAiOutput;
        try {
            parsed = JSON.parse(argsStr);
        } catch {
            throw new ServiceUnavailableException('Không đọc được kết quả AI');
        }

        const allowed = new Set(optionIds);
        const picks = (parsed?.picks ?? [])
            .filter(p => p && typeof p.optionId === 'string' && allowed.has(p.optionId))
            .slice(0, 2);

        return { picks };
    }
}
