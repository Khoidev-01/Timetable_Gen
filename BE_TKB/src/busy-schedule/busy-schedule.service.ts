import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { AbsenceLinkService } from '../schedule/absence-link.service';
import { AiService, SwapOptionForAi } from '../ai/ai.service';

const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

/** A constraint-valid swap option (server-computed, before AI ranking). */
interface SwapOption {
    optionId: string;
    type: 'REPLACE' | 'SWAP';
    teacherIn: { id: string; full_name: string; code: string };
    teacherOut?: { id: string; full_name: string; code: string };
    /** For SWAP: the other slot whose teacher is swapped in. */
    swapSlot?: { id: string; subjectName: string; className: string; day: number; period: number };
}

@Injectable()
export class BusyScheduleService {
    private readonly logger = new Logger(BusyScheduleService.name);

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        private aiService: AiService,
        private readonly absenceLink: AbsenceLinkService,
    ) { }

    // ─── TEACHER ───────────────────────────────────────────────────────────────

    /** Resolve user → teacher profile */
    private async getTeacherIdFromUser(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { teacher_profile_id: true },
        });
        if (!user?.teacher_profile_id) throw new BadRequestException('Tài khoản chưa liên kết hồ sơ giáo viên');
        return user.teacher_profile_id;
    }

    async submit(userId: string, body: { semesterId: string; slots: { weekNumber: number; dayOfWeek: number; period: number }[]; reason: string }) {
        const teacherId = await this.getTeacherIdFromUser(userId);

        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId }, select: { full_name: true, code: true } });

        // Upsert each slot (skip if already exists for same week/day/period)
        const created: string[] = [];
        for (const s of body.slots) {
            try {
                await this.prisma.teacherBusyRequest.upsert({
                    where: {
                        teacher_id_semester_id_week_number_day_of_week_period: {
                            teacher_id: teacherId,
                            semester_id: body.semesterId,
                            week_number: s.weekNumber,
                            day_of_week: s.dayOfWeek,
                            period: s.period,
                        },
                    },
                    update: { reason: body.reason, status: 'PENDING', rejection_note: null, reviewed_by: null, reviewed_at: null },
                    create: {
                        teacher_id: teacherId,
                        semester_id: body.semesterId,
                        week_number: s.weekNumber,
                        day_of_week: s.dayOfWeek,
                        period: s.period,
                        reason: body.reason,
                    },
                });
                created.push(`${DAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek}/T${s.period}`);
            } catch (_) { /* skip duplicate */ }
        }

        // Notify admins
        if (created.length > 0 && teacher) {
            await this.notificationService.create({
                userId: null, // broadcast to all admins
                category: 'BUSY_SCHEDULE',
                title: 'GV đăng ký lịch bận mới',
                message: `${teacher.full_name} (${teacher.code}) đăng ký bận Tuần ${body.slots[0]?.weekNumber}: ${created.slice(0, 5).join(', ')}${created.length > 5 ? '...' : ''}`,
                metadata: { teacherId, teacherName: teacher.full_name, slots: body.slots },
            });
        }

        return { success: true, count: created.length };
    }

    async getMyRequests(userId: string, semesterId: string) {
        const teacherId = await this.getTeacherIdFromUser(userId);
        return this.prisma.teacherBusyRequest.findMany({
            where: { teacher_id: teacherId, semester_id: semesterId },
            orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }, { period: 'asc' }],
        });
    }

    async cancelRequest(userId: string, requestId: string) {
        const teacherId = await this.getTeacherIdFromUser(userId);
        const req = await this.prisma.teacherBusyRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');
        if (req.teacher_id !== teacherId) throw new BadRequestException('Không có quyền');
        if (req.status !== 'PENDING') throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ duyệt');
        await this.prisma.teacherBusyRequest.delete({ where: { id: requestId } });
        return { success: true };
    }

    // ─── ADMIN ─────────────────────────────────────────────────────────────────

    async getAll(semesterId: string, status?: string) {
        return this.prisma.teacherBusyRequest.findMany({
            where: {
                semester_id: semesterId,
                ...(status ? { status: status as any } : {}),
            },
            include: { teacher: { select: { full_name: true, code: true } } },
            orderBy: [{ created_at: 'desc' }],
        });
    }

    async approve(requestId: string, adminUserId: string) {
        const req = await this.prisma.teacherBusyRequest.findUnique({
            where: { id: requestId },
            include: { teacher: { select: { full_name: true, user: { select: { id: true } } } } },
        });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');

        await this.prisma.teacherBusyRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', reviewed_by: adminUserId, reviewed_at: new Date() },
        });

        // Notify teacher
        const teacherUserId = req.teacher.user?.id;
        if (teacherUserId) {
            await this.notificationService.create({
                userId: teacherUserId,
                category: 'BUSY_SCHEDULE',
                title: '✅ Lịch bận đã được duyệt',
                message: `Yêu cầu bận Tuần ${req.week_number}, ${DAY_LABELS[req.day_of_week] ?? req.day_of_week} Tiết ${req.period} đã được admin duyệt.`,
            });
        }

        // Approving used to end here: the request sat in its own table, the effective
        // schedule never merged it, and the class turned up to an empty room. Write the
        // dated absence into the overlay layer so the timetable people read reflects it.
        let absence: { periods: number; overlays: number; note?: string } = { periods: 0, overlays: 0 };
        try {
            const linked = await this.absenceLink.linkApproved({
                semesterId: req.semester_id,
                teacherId: req.teacher_id,
                weekNumber: req.week_number,
                createdBy: adminUserId,
            });
            absence = { periods: linked.linked.length, overlays: linked.overlayIds.length };
            if (linked.skipped.length) absence.note = linked.skipped[0].reason;
        } catch (e: any) {
            // A missing semester start date must not block the approval itself
            this.logger.warn(`Không tạo được lịch vắng cho đơn ${requestId}: ${e?.message ?? e}`);
            absence.note = e?.message ?? 'Không tạo được lịch vắng';
        }

        return { success: true, absence };
    }

    async reject(requestId: string, adminUserId: string, note: string) {
        const req = await this.prisma.teacherBusyRequest.findUnique({
            where: { id: requestId },
            include: { teacher: { select: { full_name: true, user: { select: { id: true } } } } },
        });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');

        await this.prisma.teacherBusyRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED', rejection_note: note, reviewed_by: adminUserId, reviewed_at: new Date() },
        });

        const teacherUserId = req.teacher.user?.id;
        if (teacherUserId) {
            await this.notificationService.create({
                userId: teacherUserId,
                category: 'BUSY_SCHEDULE',
                title: '❌ Lịch bận bị từ chối',
                message: `Yêu cầu bận Tuần ${req.week_number}, ${DAY_LABELS[req.day_of_week] ?? req.day_of_week} Tiết ${req.period} bị từ chối${note ? ': ' + note : '.'}`,
            });
        }

        return { success: true };
    }

    async getConflicts(semesterId: string) {
        // APPROVED busy requests
        const approved = await this.prisma.teacherBusyRequest.findMany({
            where: { semester_id: semesterId, status: 'APPROVED' },
            include: { teacher: { select: { full_name: true, code: true } } },
        });
        if (approved.length === 0) return [];

        // Latest timetable for this semester
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            select: { id: true },
        });
        if (!latestTkb) return [];

        const conflicts: any[] = [];

        for (const req of approved) {
            // Find matching slot in timetable (same teacher, day, period, week)
            const conflictSlots = await this.prisma.timetableSlot.findMany({
                where: {
                    timetable_id: latestTkb.id,
                    teacher_id: req.teacher_id,
                    day: req.day_of_week,
                    period: req.period,
                    week: req.week_number,
                },
                include: {
                    class: { select: { name: true } },
                    subject: { select: { name: true, code: true } },
                },
            });

            for (const slot of conflictSlots) {
                // Find substitute teachers: same subject + semester assignment, free at this slot
                const candidates = await this.prisma.teachingAssignment.findMany({
                    where: {
                        semester_id: semesterId,
                        subject_id: slot.subject_id,
                        teacher_id: { not: req.teacher_id },
                    },
                    include: { teacher: { select: { id: true, full_name: true, code: true } } },
                    distinct: ['teacher_id'],
                });

                // Filter: not busy themselves, not already teaching at this slot/week
                const suggestions: any[] = [];
                for (const candidate of candidates) {
                    const tid = candidate.teacher.id;
                    const isBusy = await this.prisma.teacherBusyRequest.findFirst({
                        where: { teacher_id: tid, semester_id: semesterId, week_number: req.week_number, day_of_week: req.day_of_week, period: req.period, status: 'APPROVED' },
                    });
                    const hasSlot = await this.prisma.timetableSlot.findFirst({
                        where: { timetable_id: latestTkb.id, teacher_id: tid, day: req.day_of_week, period: req.period, week: req.week_number },
                    });
                    if (!isBusy && !hasSlot) suggestions.push(candidate.teacher);
                    if (suggestions.length >= 3) break;
                }

                conflicts.push({
                    busyRequestId: req.id,
                    timetableSlotId: slot.id,
                    teacher: req.teacher,
                    weekNumber: req.week_number,
                    dayOfWeek: req.day_of_week,
                    period: req.period,
                    className: slot.class.name,
                    subjectName: slot.subject.name,
                    reason: req.reason,
                    suggestions,
                });
            }
        }

        return conflicts;
    }

    // ─── AI SWAP SUGGESTER ───────────────────────────────────────────────────────

    /**
     * Compute ALL constraint-valid swap options for a busy conflict slot, without
     * calling AI. Two kinds:
     *  - REPLACE (A→B): qualified teacher B (same subject in semester) free at the
     *    busy slot teaches it instead.
     *  - SWAP (A↔B): B takes the busy slot, A takes one of B's other slots in the
     *    same week where A is qualified and free.
     * Only `unique_teacher_slot` matters — slots stay in place, only teacher_id moves,
     * so room/class uniqueness is untouched.
     */
    async computeSwapOptions(timetableSlotId: string): Promise<{ conflict: any; options: SwapOption[] }> {
        const s1 = await this.prisma.timetableSlot.findUnique({
            where: { id: timetableSlotId },
            include: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
                teacher: { select: { id: true, full_name: true, code: true } },
                timetable: { select: { id: true, semester_id: true } },
            },
        });
        if (!s1) throw new NotFoundException('Không tìm thấy tiết học');

        const timetableId = s1.timetable.id;
        const semesterId = s1.timetable.semester_id;
        const busyTeacherId = s1.teacher_id;
        const { day, period, week } = s1;

        // Matching approved busy request (for the conflict reason / context)
        const busyReq = await this.prisma.teacherBusyRequest.findFirst({
            where: { teacher_id: busyTeacherId, semester_id: semesterId, week_number: week, day_of_week: day, period, status: 'APPROVED' },
            select: { reason: true },
        });

        // Load everything we need up front (per-week occupancy + qualifications)
        const [slots, assignments, approvedBusy] = await Promise.all([
            this.prisma.timetableSlot.findMany({
                where: { timetable_id: timetableId, week },
                include: {
                    subject: { select: { name: true } },
                    class: { select: { name: true } },
                    teacher: { select: { id: true, full_name: true, code: true } },
                },
            }),
            this.prisma.teachingAssignment.findMany({
                where: { semester_id: semesterId },
                select: { teacher_id: true, subject_id: true, teacher: { select: { id: true, full_name: true, code: true } } },
            }),
            this.prisma.teacherBusyRequest.findMany({
                where: { semester_id: semesterId, week_number: week, status: 'APPROVED' },
                select: { teacher_id: true, day_of_week: true, period: true },
            }),
        ]);

        // subjectId -> qualified teachers; teacherId -> set of subjectIds; teacher meta
        const teachersBySubject = new Map<number, Map<string, { id: string; full_name: string; code: string }>>();
        const subjectsByTeacher = new Map<string, Set<number>>();
        for (const a of assignments) {
            if (!teachersBySubject.has(a.subject_id)) teachersBySubject.set(a.subject_id, new Map());
            teachersBySubject.get(a.subject_id)!.set(a.teacher_id, a.teacher);
            if (!subjectsByTeacher.has(a.teacher_id)) subjectsByTeacher.set(a.teacher_id, new Set());
            subjectsByTeacher.get(a.teacher_id)!.add(a.subject_id);
        }

        const busyKey = (t: string, d: number, p: number) => `${t}|${d}|${p}`;
        const busySet = new Set(approvedBusy.map(b => busyKey(b.teacher_id, b.day_of_week, b.period)));
        const occupiedSet = new Set(slots.map(s => busyKey(s.teacher_id, s.day, s.period)));
        const isBusy = (t: string, d: number, p: number) => busySet.has(busyKey(t, d, p));
        const isOccupied = (t: string, d: number, p: number) => occupiedSet.has(busyKey(t, d, p));

        const CAP = 12;
        const options: SwapOption[] = [];

        // ── REPLACE (A→B) ──
        const qualified = teachersBySubject.get(s1.subject_id);
        if (qualified) {
            for (const [bid, b] of qualified) {
                if (bid === busyTeacherId) continue;
                if (isBusy(bid, day, period)) continue;       // B reported busy then
                if (isOccupied(bid, day, period)) continue;   // B already teaches then → unique_teacher_slot
                options.push({ optionId: `replace:${bid}`, type: 'REPLACE', teacherIn: b, teacherOut: s1.teacher });
                if (options.filter(o => o.type === 'REPLACE').length >= CAP) break;
            }
        }

        // ── SWAP (A↔B) ──
        const aSubjects = subjectsByTeacher.get(busyTeacherId) ?? new Set<number>();
        for (const s2 of slots) {
            if (options.filter(o => o.type === 'SWAP').length >= CAP) break;
            if (s2.id === s1.id) continue;
            const bid = s2.teacher_id;
            if (bid === busyTeacherId) continue;
            if (!aSubjects.has(s2.subject_id)) continue;           // A qualified for S2's subject
            if (isBusy(busyTeacherId, s2.day, s2.period)) continue; // A free at S2 time
            if (isOccupied(busyTeacherId, s2.day, s2.period)) continue;
            if (isBusy(bid, day, period)) continue;                 // B free at S1 time
            if (isOccupied(bid, day, period)) continue;
            options.push({
                optionId: `swap:${s2.id}`,
                type: 'SWAP',
                teacherIn: s2.teacher,
                teacherOut: s1.teacher,
                swapSlot: { id: s2.id, subjectName: s2.subject.name, className: s2.class.name, day: s2.day, period: s2.period },
            });
        }

        const conflict = {
            teacherName: s1.teacher.full_name,
            teacherCode: s1.teacher.code,
            weekNumber: week,
            dayLabel: DAY_LABELS[day] ?? String(day),
            period,
            subjectName: s1.subject.name,
            className: s1.class.name,
            reason: busyReq?.reason ?? '',
        };

        return { conflict, options };
    }

    /** Compute valid options, then ask the AI to rank the best 2 (graceful on AI failure). */
    async suggestAiSwaps(timetableSlotId: string): Promise<{ options: any[]; aiError?: string }> {
        const { conflict, options } = await this.computeSwapOptions(timetableSlotId);
        if (options.length === 0) return { options: [] };

        const aiInput = {
            conflict,
            options: options.map<SwapOptionForAi>(o => ({
                optionId: o.optionId,
                type: o.type,
                summary:
                    o.type === 'REPLACE'
                        ? `Thay thế: ${o.teacherIn.full_name} (${o.teacherIn.code}) dạy thay tại tiết bận.`
                        : `Hoán đổi: ${o.teacherIn.full_name} (${o.teacherIn.code}) dạy tiết bận; ${o.teacherOut?.full_name} dạy thay môn ${o.swapSlot?.subjectName} lớp ${o.swapSlot?.className} (${DAY_LABELS[o.swapSlot!.day]} tiết ${o.swapSlot!.period}).`,
            })),
        };

        try {
            const { picks } = await this.aiService.rankSwapOptions(aiInput);
            const byId = new Map(options.map(o => [o.optionId, o]));
            const ranked = picks
                .map(p => {
                    const opt = byId.get(p.optionId);
                    return opt ? { ...opt, rationale: p.rationale, warning: p.warning } : null;
                })
                .filter(Boolean);
            // Fallback: if AI returned nothing usable, surface the raw options
            if (ranked.length === 0) return { options: options.slice(0, 4) };
            return { options: ranked };
        } catch (err: any) {
            return { options: options.slice(0, 4), aiError: err?.message ?? 'Dịch vụ AI không khả dụng' };
        }
    }

    /** Two-directional swap: exchange teacher_id between two slots, re-validated in a transaction. */
    async swapTeachers(slotAId: string, slotBId: string) {
        if (slotAId === slotBId) throw new BadRequestException('Hai tiết phải khác nhau');
        return this.prisma.$transaction(async (tx) => {
            const [a, b] = await Promise.all([
                tx.timetableSlot.findUnique({ where: { id: slotAId } }),
                tx.timetableSlot.findUnique({ where: { id: slotBId } }),
            ]);
            if (!a || !b) throw new NotFoundException('Không tìm thấy tiết học');
            if (a.timetable_id !== b.timetable_id) throw new BadRequestException('Hai tiết không cùng thời khóa biểu');

            // Re-check unique_teacher_slot for the post-swap positions (guard against
            // the timetable changing between suggestion and apply).
            const conflict = await tx.timetableSlot.findFirst({
                where: {
                    timetable_id: a.timetable_id,
                    week: { in: [a.week, b.week] },
                    id: { notIn: [a.id, b.id] },
                    OR: [
                        { teacher_id: b.teacher_id, day: a.day, period: a.period, week: a.week },
                        { teacher_id: a.teacher_id, day: b.day, period: b.period, week: b.week },
                    ],
                },
                select: { id: true },
            });
            if (conflict) throw new BadRequestException('Hoán đổi gây trùng tiết, thời khóa biểu đã thay đổi — vui lòng tải lại');

            await tx.timetableSlot.update({ where: { id: a.id }, data: { teacher_id: b.teacher_id } });
            await tx.timetableSlot.update({ where: { id: b.id }, data: { teacher_id: a.teacher_id } });
            return { success: true };
        });
    }

    async resolveConflict(timetableSlotId: string, substituteTeacherId: string) {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: timetableSlotId } });
        if (!slot) throw new NotFoundException('Không tìm thấy slot');
        await this.prisma.timetableSlot.update({
            where: { id: timetableSlotId },
            data: { teacher_id: substituteTeacherId },
        });
        return { success: true };
    }
}
