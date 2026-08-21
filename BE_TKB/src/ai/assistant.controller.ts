import { BadRequestException, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from './orchestrator.service';
import { ScheduleTools } from './tools/schedule.tools';
import { AskBudget } from './tools/guardrails';
import { Actor } from './tools/tool.types';

const MAX_QUESTION_LENGTH = 500;

@ApiTags('Trợ lý AI')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AssistantController {
  private readonly budget = new AskBudget(Number(process.env.AI_ASKS_PER_HOUR ?? 20));

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly tools: ScheduleTools,
    private readonly prisma: PrismaService,
  ) {}

  /** Whether the assistant can be used at all, so the UI can hide itself rather than fail. */
  @Get('status')
  status(@Req() request: Request) {
    const user: any = (request as any).user;
    return {
      ready: this.orchestrator.isReady(),
      asksRemaining: user?.id ? this.budget.remaining(user.id, Date.now()) : 0,
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
    @Body() body: { question?: string; semesterId?: string },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const question = String(body?.question ?? '').trim();
    if (!question) throw new BadRequestException('Chưa nhập câu hỏi.');
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(`Câu hỏi quá dài, tối đa ${MAX_QUESTION_LENGTH} ký tự.`);
    }

    const actor = await this.actorOf(request);
    const refusal = this.budget.spend(actor.userId, Date.now());
    if (refusal) throw new BadRequestException(refusal);

    const semesterId = body?.semesterId ?? (await this.currentSemesterId());
    if (!semesterId) throw new BadRequestException('Chưa có học kỳ nào để tra cứu.');

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

      const turn = await this.orchestrator.ask(question, { actor, semesterId });
      for (const step of turn.steps) send('step', step);

      send('answer', {
        answer: turn.answer,
        confirmation: turn.confirmation,
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
