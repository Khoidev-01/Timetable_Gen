import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SwapStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SwapActor, SwapRequestService } from './swap-request.service';

/**
 * Teachers arranging a trade between themselves, with an admin signing it off.
 *
 * No route takes a teacher id from the body. Who you are comes from the verified token, so
 * a teacher cannot request, accept or cancel on somebody else's behalf by editing a payload.
 */
@ApiTags('Đổi tiết')
@ApiBearerAuth('access-token')
@Controller('doi-tiet')
export class SwapRequestController {
  constructor(
    private readonly swaps: SwapRequestService,
    private readonly prisma: PrismaService,
  ) {}

  /** Periods this one could trade with. */
  @Get('goi-y/:slotId')
  async suggest(@Param('slotId') slotId: string, @Req() request: Request) {
    return this.swaps.suggest(slotId, await this.actorOf(request));
  }

  /** Requests this person is allowed to see. */
  @Get()
  async list(
    @Query('semesterId') semesterId: string,
    @Query('status') status: string | undefined,
    @Req() request: Request,
  ) {
    const id = semesterId || (await this.currentSemesterId());
    if (!id) throw new BadRequestException('Chưa có học kỳ nào.');

    return this.swaps.list(id, await this.actorOf(request), status as SwapStatus | undefined);
  }

  @Post()
  async create(
    @Body() body: { requesterSlotId?: string; partnerSlotId?: string; reason?: string },
    @Req() request: Request,
  ) {
    if (!body?.requesterSlotId || !body?.partnerSlotId) {
      throw new BadRequestException('Cần chọn đủ hai tiết để đổi.');
    }
    return this.swaps.create(
      {
        requesterSlotId: body.requesterSlotId,
        partnerSlotId: body.partnerSlotId,
        reason: body.reason ?? '',
      },
      await this.actorOf(request),
    );
  }

  /** The colleague's answer. Agreeing sends it to an admin, not into the timetable. */
  @Patch(':id/tra-loi')
  async respond(
    @Param('id') id: string,
    @Body() body: { accept?: boolean; note?: string },
    @Req() request: Request,
  ) {
    if (typeof body?.accept !== 'boolean') {
      throw new BadRequestException('Cần cho biết đồng ý hay từ chối.');
    }
    return this.swaps.respond(id, body.accept, body.note ?? '', await this.actorOf(request));
  }

  /** The admin's decision, and the only route that changes the timetable. */
  @Patch(':id/duyet')
  async decide(
    @Param('id') id: string,
    @Body() body: { approve?: boolean; note?: string },
    @Req() request: Request,
  ) {
    if (typeof body?.approve !== 'boolean') {
      throw new BadRequestException('Cần cho biết duyệt hay không duyệt.');
    }
    return this.swaps.decide(id, body.approve, body.note ?? '', await this.actorOf(request));
  }

  @Patch(':id/rut-lai')
  async cancel(@Param('id') id: string, @Req() request: Request) {
    return this.swaps.cancel(id, await this.actorOf(request));
  }

  private async actorOf(request: Request): Promise<SwapActor> {
    const user: any = (request as any).user;
    if (!user?.id) throw new BadRequestException('Chưa xác thực.');

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { teacher_profile: { select: { id: true, full_name: true } } },
    });

    return {
      userId: user.id,
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
