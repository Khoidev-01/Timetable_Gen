/**
 * One message in a conversation, in the shape every provider agreed on.
 *
 * OpenAI published `/chat/completions`, and OpenRouter, Together, Groq and Ollama all
 * copied it. That accident of history is why one implementation reaches all of them and
 * why swapping provider is a `.env` change rather than a rewrite.
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Set on assistant messages that asked for tools. */
  toolCalls?: LlmToolCall[];
  /** Set on tool messages, matching the call being answered. */
  toolCallId?: string;
  name?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  /** Raw JSON from the model. Never trusted - parsed and validated before use. */
  arguments: string;
}

export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmReply {
  content: string;
  toolCalls: LlmToolCall[];
  /** What the provider says it spent, when it says anything. */
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface LlmProvider {
  readonly label: string;
  /** True when the provider is configured well enough to be called at all. */
  isReady(): boolean;
  complete(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmReply>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
