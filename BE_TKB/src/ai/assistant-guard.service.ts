import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/** Câu trả lời từ chối phải chứa cụm này (được ghi trong lời nhắc hệ thống), để đếm được. */
export const OFF_TOPIC_MARKER = 'chỉ hỗ trợ về thời khóa biểu';

const QUESTIONS_PER_WINDOW = 20;
const WINDOW_SECONDS = 10 * 60;
const OFF_TOPIC_LIMIT = 3;
const OFF_TOPIC_MEMORY_SECONDS = 15 * 60;
const BLOCK_SECONDS = 10 * 60;

/**
 * Chặn dùng trợ lý làm chatbot chung hoặc dội câu hỏi.
 *
 * Mỗi lượt gọi mô hình đều tốn tiền, nên giới hạn theo NGƯỜI (không chỉ theo IP như bộ đếm
 * chung của ứng dụng): tối đa 20 câu mỗi 10 phút, và ba câu ngoài phạm vi liên tiếp thì khóa
 * trợ lý 10 phút với người đó. Câu hỏi đúng phạm vi xóa chuỗi đếm ngoài phạm vi.
 */
@Injectable()
export class AssistantGuardService implements OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 2,
  });

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  /** Gọi trước khi hỏi mô hình. Ném 429 kèm số phút phải đợi khi bị chặn. */
  async check(userId: string) {
    const blockTtl = await this.redis.ttl(`ai:block:${userId}`);
    if (blockTtl > 0) {
      throw new HttpException(
        `Trợ lý tạm khóa vì nhiều câu hỏi ngoài phạm vi liên tiếp. Thử lại sau ${Math.ceil(blockTtl / 60)} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const rateKey = `ai:rate:${userId}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) await this.redis.expire(rateKey, WINDOW_SECONDS);
    if (count > QUESTIONS_PER_WINDOW) {
      const wait = Math.max(1, Math.ceil((await this.redis.ttl(rateKey)) / 60));
      throw new HttpException(
        `Bạn đã hỏi ${QUESTIONS_PER_WINDOW} câu trong 10 phút. Thử lại sau ${wait} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Gọi sau khi có câu trả lời. Trả về lời nhắc thêm nếu người dùng sắp bị khóa. */
  async record(userId: string, answer: string): Promise<string | null> {
    const key = `ai:offtopic:${userId}`;
    if (!this.isOffTopic(answer)) {
      await this.redis.del(key);
      return null;
    }
    const strikes = await this.redis.incr(key);
    await this.redis.expire(key, OFF_TOPIC_MEMORY_SECONDS);
    if (strikes >= OFF_TOPIC_LIMIT) {
      await this.redis.set(`ai:block:${userId}`, '1', 'EX', BLOCK_SECONDS);
      await this.redis.del(key);
      return `Đây là câu ngoài phạm vi thứ ${strikes} liên tiếp, trợ lý tạm khóa ${BLOCK_SECONDS / 60} phút.`;
    }
    return `(${strikes}/${OFF_TOPIC_LIMIT} câu ngoài phạm vi; đủ ${OFF_TOPIC_LIMIT} câu liên tiếp trợ lý sẽ tạm khóa.)`;
  }

  isOffTopic(answer: string): boolean {
    return answer.toLowerCase().includes(OFF_TOPIC_MARKER);
  }
}
