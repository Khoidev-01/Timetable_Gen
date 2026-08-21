/**
 * Who is asking. Stamped from the verified JWT by the controller and threaded through
 * every tool call.
 *
 * Never parsed out of the question. A model that can be talked into changing who it thinks
 * it is talking to is a model that can be talked into reading a colleague's schedule, and
 * "the user said they were an admin" is not authentication.
 */
export interface Actor {
  userId: string;
  username: string;
  role: 'ADMIN' | 'TEACHER';
  /** The teacher record this account is linked to, when it is linked to one. */
  teacherId?: string;
  teacherName?: string;
}

export interface ToolContext {
  actor: Actor;
  semesterId: string;
}

/** Every tool answers in this shape so the orchestrator never has to special-case one. */
export interface ToolResult {
  ok: boolean;
  /** Data the model may reason over. Always treated as data, never as instructions. */
  data?: unknown;
  /** Vietnamese explanation shown to the user when something is refused or missing. */
  message?: string;
  /**
   * A write the user must confirm before it happens. Tools never carry out a change on
   * their own - the model proposes, a person presses the button.
   */
  confirmation?: {
    action: string;
    summary: string;
    payload: Record<string, unknown>;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the arguments, handed to the model verbatim. */
  parameters: Record<string, unknown>;
  /** True for tools that would change something, so they can be gated as a group. */
  writes?: boolean;
  run(args: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}

export const denied = (message: string): ToolResult => ({ ok: false, message });
export const answer = (data: unknown): ToolResult => ({ ok: true, data });
