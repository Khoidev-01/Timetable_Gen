import { BadRequestException, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrchestratorService } from './orchestrator.service';
import { AssistantEvalService } from './eval/assistant-eval.service';
import { ScheduleTools } from './tools/schedule.tools';
import { Actor } from './tools/tool.types';
import { AssistantGuardService } from './assistant-guard.service';
import { ConversationMemoryService } from './conversation-memory.service';

const MAX_QUESTION_LENGTH = 2000;
/** Bối cảnh trình duyệt gửi kèm không được phình vô hạn; phần cũ đã có tóm tắt. */
const MAX_HISTORY_TURNS = 20;
const MAX_SUMMARY_LENGTH = 4000;

@ApiTags('Trợ lý AI')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AssistantController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly tools: ScheduleTools,
    private readonly prisma: PrismaService,
    private readonly evaluation: AssistantEvalService,
    private readonly guard: AssistantGuardService,
    private readonly memory: ConversationMemoryService,
  ) {}

  /**
   * Runs the golden questions against whatever model is configured.
   *
   * Minutes of real API calls, so it is never automatic - but it turns "is this model good
   * enough" into a table, and swapping model is one line of .env away.
   */
  @Roles('ADMIN')
  @Post('eval')
  async evaluate(@Body() body: { semesterId?: string; only?: string[] }) {
    const semesterId = body?.semesterId ?? (await this.currentSemesterId());
    if (!semesterId) throw new BadRequestException('Chưa có học kỳ nào để chạy đánh giá.');
    return this.evaluation.run(semesterId, body?.only);
  }

  /** Whether the assistant can be used at all, so the UI can hide itself rather than fail. */
  @Get('status')
  status() {
    return {
      ready: this.orchestrator.isReady(),
      toolCount: this.tools.all().length,
    };
  }

  /**
   * Answers one question, streaming what it is doing as it does it.
   *
   * The steps are streamed rather than the tokens. Watching "đang tra lịch của bạn…" appear
   * is what makes a slow answer bearable, and it also shows the user which data the answer
   * came from - a spinner conveys neither.
   */
  @Post('ask')
  async ask(
    @Body()
    body: {
      question?: string;
      semesterId?: string;
      /** Tóm tắt các lượt cũ mà máy chủ đã trả về ở lượt trước */
      summary?: string | null;
      /** Các lượt chưa nén, nguyên văn */
      history?: Array<{ question?: string; answer?: string }>;
    },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const question = String(body?.question ?? '').trim();
    if (!question) throw new BadRequestException('Chưa nhập câu hỏi.');
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(`Câu hỏi quá dài, tối đa ${MAX_QUESTION_LENGTH} ký tự.`);
    }

    const actor = await this.actorOf(request);
    const semesterId = body?.semesterId ?? (await this.currentSemesterId());
    if (!semesterId) throw new BadRequestException('Chưa có học kỳ nào để tra cứu.');
    // Chặn spam theo người dùng trước khi tốn một lượt gọi mô hình
    await this.guard.check(actor.userId);
    const history = (Array.isArray(body?.history) ? body.history : [])
      .filter((h) => typeof h?.question === 'string' && typeof h?.answer === 'string')
      .slice(-MAX_HISTORY_TURNS)
      .map((h) => ({ question: String(h.question), answer: String(h.answer) }));
    const summary = typeof body?.summary === 'string' && body.summary.trim() ? body.summary.slice(0, MAX_SUMMARY_LENGTH) : null;

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    // Nginx and Traefik buffer by default, which holds every event until the end
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send('start', { question });
      // Nén phần hội thoại cũ trước khi hỏi, để câu hỏi dài / hội thoại lâu không bị quên
      const folded = await this.memory.fold({ summary, history });
      if (folded.consumed > 0) send('step', { tool: 'compress_context', args: { turns: folded.consumed }, ok: true, note: `Đã nén ${folded.consumed} lượt cũ thành ghi nhớ` });

      const turn = await this.orchestrator.ask(question, { actor, semesterId }, folded);
      for (const step of turn.steps) send('step', step);

      const warning = await this.guard.record(actor.userId, turn.answer);
      send('answer', {
        answer: warning ? `${turn.answer}\n\n${warning}` : turn.answer,
        memory: { summary: folded.summary, consumed: folded.consumed },
        confirmation: turn.confirmation,
        citations: turn.citations,
        rounds: turn.rounds,
      });
    } catch (error: any) {
      // Whatever went wrong, the user gets a Vietnamese sentence rather than a stack trace
      send('error', {
        message: error?.response?.message ?? error?.message ?? 'Trợ lý gặp sự cố.',
      });
    } finally {
      send('done', {});
      response.end();
    }
  }

  /**
   * Carries out a write the assistant proposed, once the user has confirmed it.
   *
   * Deliberately a separate call. The assistant never writes; it produces a card, and this
   * is the button behind that card.
   */
  @Post('confirm')
  async confirm(
    @Body() body: { action?: string; payload?: Record<string, any> },
    @Req() request: Request,
  ) {
    const actor = await this.actorOf(request);
    const action = String(body?.action ?? '');
    const payload = body?.payload ?? {};

    if (action !== 'create_busy_registration') {
      throw new BadRequestException(`Không hỗ trợ hành động "${action}".`);
    }

    // Re-check ownership here rather than trusting the payload the browser sent back
    if (actor.role !== 'ADMIN' && payload.teacherId !== actor.teacherId) {
      throw new BadRequestException('Bạn chỉ đăng ký lịch bận cho chính mình.');
    }

    const created = await this.prisma.teacherBusyRequest.create({
      data: {
        teacher_id: String(payload.teacherId),
        semester_id: String(payload.semesterId),
        week_number: Number(payload.weekNumber),
        day_of_week: Number(payload.dayOfWeek),
        period: Number(payload.period),
        reason: String(payload.reason ?? ''),
        status: 'PENDING',
      },
    });

    return { success: true, requestId: created.id, message: 'Đã gửi đơn, chờ quản trị viên duyệt.' };
  }

  private async actorOf(request: Request): Promise<Actor> {
    const user: any = (request as any).user;
    if (!user?.id) throw new BadRequestException('Chưa xác thực.');

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { teacher_profile: { select: { id: true, full_name: true } } },
    });

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      teacherId: account?.teacher_profile?.id,
      teacherName: account?.teacher_profile?.full_name,
    };
  }

  private async currentSemesterId(): Promise<string | undefined> {
    const semester = await this.prisma.semester.findFirst({ orderBy: { term_order: 'asc' } });
    return semester?.id;
  }
}
