import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

export interface VariantSummary {
  id: string;
  name: string;
  createdAt: Date;
  isOfficial: boolean;
  score: number;
  hardViolations: number;
  isValid: boolean;
  slotCount: number;
  metrics: {
    teacherGaps: number;
    teacherExtraSessions: number;
    bothSessionsSameDay: number;
    splitBlocks: number;
    subjectPileUp: number;
    teachersWithoutDayOff: number;
    stairFloors: number;
  };
  details: string[];
  offenders: Array<{ label: string; slotIds: string[] }>;
}

/**
 * The solver keeps several good schedules rather than one. They are equally usable but
 * trade off differently - one may be kinder to teachers, another tidier for classes -
 * and that choice belongs to the school, not the algorithm.
 */
@Injectable()
export class VariantService {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
  ) {}

  async listForSemester(semesterId: string): Promise<VariantSummary[]> {
    await this.constraints.initialize(semesterId);

    const timetables = await this.prisma.generatedTimetable.findMany({
      where: { semester_id: semesterId },
      orderBy: { created_at: 'desc' },
      take: 6,
      include: { slots: true },
    });

    return timetables.map((timetable) => {
      const slots: TimeSlot[] = timetable.slots.map((s) => ({
        id: s.id,
        day: s.day,
        period: s.period,
        classId: s.class_id,
        subjectId: s.subject_id,
        teacherId: s.teacher_id,
        roomId: s.room_id ?? undefined,
        isLocked: s.is_locked,
      }));

      const fitness = this.constraints.getFitnessDetails(slots);
      const byLabel = new Map<string, number>(
        (fitness.breakdown?.soft ?? []).map((item: any) => [item.label, item.count]),
      );

      return {
        id: timetable.id,
        name: timetable.name,
        createdAt: timetable.created_at,
        isOfficial: timetable.is_official,
        score: fitness.score,
        hardViolations: fitness.hardViolations,
        isValid: fitness.isValid,
        slotCount: slots.length,
        metrics: {
          teacherGaps: byLabel.get('Tiết trống giáo viên') ?? 0,
          teacherExtraSessions: byLabel.get('Giáo viên phải đến trường thêm buổi') ?? 0,
          bothSessionsSameDay: byLabel.get('Giáo viên dạy cả sáng lẫn chiều') ?? 0,
          splitBlocks: byLabel.get('Môn 2 tiết bị xé lẻ') ?? 0,
          subjectPileUp: byLabel.get('Môn học dồn cục') ?? 0,
          teachersWithoutDayOff: byLabel.get('Giáo viên không có ngày nghỉ') ?? 0,
          stairFloors: byLabel.get('Giáo viên phải leo cầu thang') ?? 0,
        },
        details: fitness.details,
        offenders: fitness.offenders ?? [],
      };
    });
  }

  /**
   * Mark one variant as the school's official timetable. Exactly one can hold the flag,
   * and only a variant with no hard violations may - publishing a broken schedule to
   * every teacher is worse than publishing nothing.
   */
  async publish(timetableId: string) {
    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: timetableId },
      include: { slots: true },
    });
    if (!timetable) throw new NotFoundException('Không tìm thấy phương án này.');

    await this.constraints.initialize(timetable.semester_id);

    const slots: TimeSlot[] = timetable.slots.map((s) => ({
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
    }));

    const fitness = this.constraints.getFitnessDetails(slots);
    if (!fitness.isValid) {
      throw new BadRequestException(
        `Phương án còn ${fitness.hardViolations} lỗi cứng nên chưa thể công bố. ` +
          fitness.details.slice(0, 3).join(' · '),
      );
    }

    // Issue the public link on first publish and keep it thereafter, so a QR code
    // printed on the staff noticeboard does not stop working when a variant is swapped
    const publicToken = timetable.public_token ?? crypto.randomBytes(16).toString('hex');

    await this.prisma.$transaction([
      this.prisma.generatedTimetable.updateMany({
        where: { semester_id: timetable.semester_id },
        data: { is_official: false },
      }),
      this.prisma.generatedTimetable.update({
        where: { id: timetableId },
        data: { is_official: true, public_token: publicToken },
      }),
    ]);

    return { success: true, id: timetableId, score: fitness.score, publicToken };
  }

  /**
   * The public link plus a QR image of it. Teachers scan this off the noticeboard and
   * read today's schedule on their phone - no account, no app.
   */
  async publicLink(timetableId: string) {
    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: timetableId },
      select: { public_token: true, is_official: true },
    });
    if (!timetable) throw new NotFoundException('Không tìm thấy phương án này.');
    if (!timetable.public_token) {
      throw new BadRequestException('Phương án chưa được công bố nên chưa có liên kết công khai.');
    }

    const base = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const url = `${base}/xem/${timetable.public_token}`;

    return {
      url,
      token: timetable.public_token,
      qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1, width: 240 }),
    };
  }
}
