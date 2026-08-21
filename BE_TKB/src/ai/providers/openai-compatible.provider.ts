import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  LlmMessage,
  LlmProvider,
  LlmReply,
  LlmToolSpec,
} from './llm-provider.interface';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_200;

/**
 * Talks to anything that speaks the `/chat/completions` shape.
 *
 * That is OpenAI, OpenRouter, Groq, Together, and Ollama running on the user's own machine.
 * Three environment variables decide which:
 *
 *   LLM_BASE_URL=https://api.openai.com/v1      LLM_MODEL=gpt-4.1-mini
 *   LLM_BASE_URL=https://openrouter.ai/api/v1   LLM_MODEL=anthropic/claude-sonnet-4.6
 *   LLM_BASE_URL=http://localhost:11434/v1      LLM_MODEL=qwen2.5:7b
 *
 * Kept behind an interface so the orchestrator can be tested against a scripted model. A
 * real model is too non-deterministic to assert against, and the parts worth testing - the
 * tool loop, the identity stamping, the refusals - are not the model's behaviour anyway.
 */
@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  get label(): string {
    return `${this.baseUrl} · ${this.model}`;
  }

  private get baseUrl(): string {
    return (process.env.LLM_BASE_URL ?? process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  private get model(): string {
    return process.env.LLM_MODEL ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  }

  private get apiKey(): string | undefined {
    return process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY;
  }

  isReady(): boolean {
    // Ollama runs without a key, so a local base URL counts as configured
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) return true;
    return Boolean(this.apiKey);
  }

  async complete(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmReply> {
    if (!this.isReady()) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình LLM_API_KEY trên máy chủ nên trợ lý chưa hoạt động. ' +
          'Mọi chức năng khác của hệ thống không bị ảnh hưởng.',
      );
    }

    // A provider that drops one connection in ten looks exactly like a broken assistant to
    // a teacher, and exactly like a bad model in an evaluation. Found the hard way: an
    // eval run lost seventeen of fifty questions to transient failures and scored them all
    // as wrong. Retry the failures that are worth retrying, and say which is which.
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.callOnce(messages, tools);
      } catch (error: any) {
        lastError = error;
        if (!error?.retryable || attempt === MAX_ATTEMPTS) break;

        const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.logger.warn(`LLM lỗi tạm thời (lần ${attempt}/${MAX_ATTEMPTS}), thử lại sau ${backoff}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    throw lastError;
  }

  private async callOnce(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmReply> {

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          // OpenRouter asks for these; harmless everywhere else
          'HTTP-Referer': process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
          'X-Title': 'MiKiTimetable',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(toWireMessage),
          ...(tools.length > 0
            ? {
                tools: tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
                tool_choice: 'auto',
              }
            : {}),
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        this.logger.error(`LLM ${response.status}: ${detail}`);

        // The provider's own error text is for the log, not for a teacher's screen
        throw retryableIf(
          response.status === 429 || response.status >= 500,
          new ServiceUnavailableException(
            response.status === 401
              ? 'Khoá API của trợ lý không hợp lệ. Liên hệ quản trị viên.'
              : response.status === 429
                ? 'Trợ lý đang quá tải hoặc đã hết lượt dùng. Thử lại sau ít phút.'
                : 'Trợ lý tạm thời không phản hồi. Thử lại sau ít phút.',
          ),
        );
      }

      const body: any = await response.json();
      const choice = body?.choices?.[0]?.message ?? {};

      return {
        content: String(choice.content ?? ''),
        toolCalls: (choice.tool_calls ?? []).map((call: any) => ({
          id: String(call.id ?? ''),
          name: String(call.function?.name ?? ''),
          arguments: String(call.function?.arguments ?? '{}'),
        })),
        usage: {
          promptTokens: body?.usage?.prompt_tokens,
          completionTokens: body?.usage?.completion_tokens,
        },
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw retryableIf(
          true,
          new ServiceUnavailableException('Trợ lý trả lời quá lâu nên đã dừng. Thử hỏi ngắn gọn hơn.'),
        );
      }
      if (error instanceof ServiceUnavailableException) throw error;

      // A dropped socket is the classic transient failure, and the one that silently
      // ruined the first evaluation run
      this.logger.error(`LLM gọi hỏng: ${error?.message ?? error}`);
      throw retryableIf(true, new ServiceUnavailableException('Không kết nối được tới trợ lý.'));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Marks an error as worth retrying, without inventing a new error class for it. */
function retryableIf<T>(retryable: boolean, error: T): T {
  (error as any).retryable = retryable;
  return error;
}

function toWireMessage(message: LlmMessage) {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId, name: message.name };
  }
  if (message.toolCalls?.length) {
    return {
      role: message.role,
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content };
}
