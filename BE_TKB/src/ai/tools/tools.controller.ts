import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleTools } from './schedule.tools';
import { AskBudget } from './guardrails';
import { Actor } from './tool.types';

/**
 * The assistant's tools, callable directly.
 *
 * Every tool works the same way whether a model called it or a person did with curl. That
 * makes the interesting behaviour testable and debuggable without a model in the loop, and
 * it is why the identity rules live here rather than in a prompt.
 */
@ApiTags('Trợ lý AI')
@ApiBearerAuth('access-token')
@Controller('ai/tools')
export class ToolsController {
  private readonly budget = new AskBudget(
    Number(process.env.AI_ASKS_PER_HOUR ?? 20),
  );

  constructor(
    private readonly tools: ScheduleTools,
    private readonly prisma: PrismaService,
  ) {}

  /** What the assistant can do, in the shape a model expects to be handed. */
  @Get()
  list() {
    return this.tools.all().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      writes: Boolean(tool.writes),
    }));
  }

  @Post(':name')
  async run(
    @Param('name') name: string,
    @Body() body: { semesterId?: string; args?: Record<string, unknown> },
    @Req() request: Request,
  ) {
    const tool = this.tools.all().find((t) => t.name === name);
    if (!tool) throw new BadRequestException(`Không có công cụ tên "${name}".`);

    const actor = await this.actorOf(request);

    // Counted here rather than in the orchestrator so a direct caller cannot walk around
    // the limit by skipping the chat endpoint
    const refusal = this.budget.spend(actor.userId, Date.now());
    if (refusal) throw new BadRequestException(refusal);

    const semesterId = body?.semesterId ?? (await this.currentSemesterId());
    if (!semesterId) throw new BadRequestException('Chưa có học kỳ nào để tra cứu.');

    return tool.run(body?.args ?? {}, { actor, semesterId });
  }

  /**
   * Identity comes from the verified token, never from the request body.
   *
   * A model that can be talked into changing who it is acting as is a model that can be
   * talked into reading a colleague's schedule, so there is deliberately no way to pass an
   * actor in.
   */
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
