import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LlmProvider } from './providers/llm-provider.interface';
import { LLM_PROVIDER } from './providers/llm-provider.interface';

export interface HistoryTurn {
  question: string;
  answer: string;
}

/** Bối cảnh hội thoại phía máy khách gửi kèm mỗi câu hỏi. */
export interface ConversationMemory {
  /** Tóm tắt các lượt cũ đã được nén; null khi hội thoại còn ngắn. */
  summary: string | null;
  /** Các lượt chưa nén, nguyên văn. */
  history: HistoryTurn[];
}

/** Kết quả nén: tóm tắt mới, các lượt còn giữ nguyên văn, và số lượt đầu đã gộp vào tóm tắt. */
export interface FoldedMemory {
  summary: string | null;
  recent: HistoryTurn[];
  consumed: number;
}

/** Luôn giữ nguyên văn chừng này lượt gần nhất. */
const KEEP_RECENT = 4;
/** Nén khi số lượt chưa nén vượt mức này... */
const FOLD_WHEN_TURNS = 6;
/** ...hoặc khi tổng chữ của chúng vượt mức này (câu hỏi/câu trả lời dài). */
const FOLD_WHEN_CHARS = 6000;
/** Tóm tắt không dài quá mức này, kể cả khi mô hình nói nhiều. */
const SUMMARY_MAX_CHARS = 2000;
const TURN_TEXT_MAX = 1500;

/**
 * Nén hội thoại dài thành một đoạn tóm tắt để trợ lý không quên phần đầu.
 *
 * Máy chủ không lưu hội thoại; trình duyệt giữ toàn bộ và gửi kèm tóm tắt cũ + các lượt
 * chưa nén. Khi phần chưa nén đủ dài, các lượt cũ được gộp vào tóm tắt bằng một lượt gọi
 * mô hình riêng (không dùng công cụ), rồi trả tóm tắt mới về cho trình duyệt cất. Nếu mô
 * hình không tóm tắt được thì cắt gọn bằng tay, để hội thoại vẫn đi tiếp.
 */
@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  async fold(memory: ConversationMemory): Promise<FoldedMemory> {
    const history = memory.history.map((turn) => ({
      question: turn.question.slice(0, TURN_TEXT_MAX),
      answer: turn.answer.slice(0, TURN_TEXT_MAX),
    }));
    const chars = history.reduce((sum, turn) => sum + turn.question.length + turn.answer.length, 0);
    if (history.length <= KEEP_RECENT || (history.length < FOLD_WHEN_TURNS && chars < FOLD_WHEN_CHARS)) {
      return { summary: memory.summary, recent: history, consumed: 0 };
    }

    const consumed = history.length - KEEP_RECENT;
    const older = history.slice(0, consumed);
    const summary = await this.summarize(memory.summary, older);
    return { summary, recent: history.slice(consumed), consumed };
  }

  private async summarize(previous: string | null, older: HistoryTurn[]): Promise<string> {
    const transcript = older.map((turn, i) => `[Lượt ${i + 1}]\nNgười dùng: ${turn.question}\nTrợ lý: ${turn.answer}`).join('\n\n');
    try {
      const reply = await this.llm.complete(
        [
          {
            role: 'system',
            content: [
              'Bạn nén hội thoại giữa người dùng và trợ lý thời khóa biểu thành ghi nhớ ngắn gọn bằng tiếng Việt.',
              'Giữ lại: các thực thể đã nhắc (lớp, giáo viên, môn, thứ/tiết, học kỳ), điều người dùng đang quan tâm,',
              'kết luận hoặc số liệu quan trọng đã trả lời, và việc còn dang dở. Bỏ lời chào, lời lặp.',
              `Viết dưới ${Math.floor(SUMMARY_MAX_CHARS / 2)} ký tự, dạng gạch đầu dòng. Không thêm lời dẫn.`,
            ].join(' '),
          },
          {
            role: 'user',
            content: (previous ? `Ghi nhớ hiện có:\n${previous}\n\n` : '') + `Các lượt mới cần gộp vào ghi nhớ:\n\n${transcript}`,
          },
        ],
        [],
      );
      const text = reply.content.trim();
      if (text) return text.slice(0, SUMMARY_MAX_CHARS);
    } catch (error) {
      this.logger.warn(`Không tóm tắt được hội thoại, cắt gọn bằng tay: ${String(error)}`);
    }
    return this.truncateByHand(previous, older);
  }

  /** Dự phòng khi mô hình lỗi: giữ đầu mỗi câu hỏi và câu trả lời, ưu tiên phần mới nhất. */
  private truncateByHand(previous: string | null, older: HistoryTurn[]): string {
    const lines = older.map((turn) => `- Hỏi: ${turn.question.slice(0, 120)} | Đáp: ${turn.answer.slice(0, 200).replace(/\s+/g, ' ')}`);
    const text = (previous ? `${previous}\n` : '') + lines.join('\n');
    return text.length > SUMMARY_MAX_CHARS ? text.slice(text.length - SUMMARY_MAX_CHARS) : text;
  }
}
