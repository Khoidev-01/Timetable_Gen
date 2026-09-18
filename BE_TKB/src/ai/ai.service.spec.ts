import { ServiceUnavailableException } from '@nestjs/common';
import { AiService, SwapAiInput } from './ai.service';
import type { LlmProvider } from './providers/llm-provider.interface';

const input: SwapAiInput = {
    conflict: {
        teacherName: 'Nguyễn Văn A',
        teacherCode: 'GV001',
        weekNumber: 1,
        dayLabel: 'Thứ 2',
        period: 1,
        subjectName: 'Toán',
        className: '10A1',
        reason: 'Bận',
    },
    options: [
        { optionId: 'replace:1', type: 'REPLACE', summary: 'Phương án 1' },
        { optionId: 'swap:2', type: 'SWAP', summary: 'Phương án 2' },
    ],
};

describe('AiService', () => {
    it('ranks swap options through the shared LLM provider', async () => {
        const complete = jest.fn().mockResolvedValue({
            content: '',
            toolCalls: [{
                id: 'call-1',
                name: 'rank_swaps',
                arguments: JSON.stringify({
                    picks: [{ optionId: 'replace:1', rationale: 'Ít xáo trộn nhất' }],
                }),
            }],
        });
        const service = new AiService({ complete, isReady: () => true, label: 'AI Router' } as LlmProvider);

        await expect(service.rankSwapOptions(input)).resolves.toEqual({
            picks: [{ optionId: 'replace:1', rationale: 'Ít xáo trộn nhất' }],
        });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete.mock.calls[0][1]).toEqual([
            expect.objectContaining({ name: 'rank_swaps' }),
        ]);
        expect(complete.mock.calls[0][2]).toEqual({ requiredToolName: 'rank_swaps' });
    });

    it('rejects missing tool output from the shared provider', async () => {
        const provider = {
            complete: jest.fn().mockResolvedValue({ content: 'text only', toolCalls: [] }),
            isReady: () => true,
            label: 'AI Router',
        } as LlmProvider;

        await expect(new AiService(provider).rankSwapOptions(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('drops invented option ids and malformed picks', async () => {
        const provider = {
            complete: jest.fn().mockResolvedValue({
                content: '',
                toolCalls: [{
                    id: 'call-1',
                    name: 'rank_swaps',
                    arguments: JSON.stringify({
                        picks: [
                            { optionId: 'invented', rationale: 'Không hợp lệ' },
                            { optionId: 'swap:2' },
                            { optionId: 'replace:1', rationale: 'Hợp lệ', warning: 123 },
                        ],
                    }),
                }],
            }),
            isReady: () => true,
            label: 'AI Router',
        } as LlmProvider;

        await expect(new AiService(provider).rankSwapOptions(input)).resolves.toEqual({
            picks: [{ optionId: 'replace:1', rationale: 'Hợp lệ' }],
        });
    });
});
