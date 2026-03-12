"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ConstraintService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstraintService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ConstraintService = ConstraintService_1 = class ConstraintService {
    prisma;
    logger = new common_1.Logger(ConstraintService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    roomMap = new Map();
    subjectMap = new Map();
    subjects = [];
    teacherMap = new Map();
    teacherMapByName = new Map();
    async initialize(semesterId) {
        this.logger.log('Initializing Constraint Service...');
        const rooms = await this.prisma.room.findMany();
        rooms.forEach(r => this.roomMap.set(r.name, r.id));
        const subjects = await this.prisma.subject.findMany();
        this.subjects = subjects;
        subjects.forEach(s => this.subjectMap.set(s.code, s.id));
        const teachers = await this.prisma.teacher.findMany();
        teachers.forEach(t => {
            this.teacherMap.set(t.id, t);
            this.teacherMapByName.set(t.code, t);
        });
        this.logger.log(`Loaded ${rooms.length} rooms, ${subjects.length} subjects, ${teachers.length} teachers.`);
    }
    checkTeacherConflict(slot, others) {
        return others.some(o => o.day === slot.day &&
            o.period === slot.period &&
            o.teacherId === slot.teacherId &&
            o.classId !== slot.classId);
    }
    checkClassConflict(slot, others) {
        return others.some(o => o.day === slot.day &&
            o.period === slot.period &&
            o.classId === slot.classId &&
            o.subjectId !== slot.subjectId);
    }
    checkRoomConflict(slot, others) {
        if (!slot.roomId)
            return false;
        return others.some(o => o.day === slot.day &&
            o.period === slot.period &&
            o.roomId === slot.roomId &&
            o.classId !== slot.classId);
    }
    getValidRooms(grade, session, period, subjectType, subjectCode) {
        if (subjectType === 'THUC_HANH' && subjectCode) {
            const code = subjectCode.toUpperCase();
            if (code.includes('TIN'))
                return [this.getRoomId('314'), this.getRoomId('315')].filter((id) => id !== undefined);
            if (code.includes('LY') || code.includes('VAT_LY'))
                return [this.getRoomId('301')].filter((id) => id !== undefined);
            if (code.includes('HOA'))
                return [this.getRoomId('302')].filter((id) => id !== undefined);
            if (code.includes('SINH'))
                return [this.getRoomId('303')].filter((id) => id !== undefined);
        }
        const isMorningPeriod = period <= 5;
        if (grade === 12 && isMorningPeriod) {
            return this.getRangeRoomIds(101, 114);
        }
        if (grade === 11 && !isMorningPeriod) {
            return this.getRangeRoomIds(101, 114);
        }
        if (grade === 10 && isMorningPeriod) {
            return this.getRangeRoomIds(201, 214);
        }
        return [...this.getRangeRoomIds(101, 114), ...this.getRangeRoomIds(201, 214)];
    }
    isTeacherBusy(teacherId, day, period) {
        const teacher = this.teacherMap.get(teacherId);
        if (!teacher || !teacher.ngay_nghi_dang_ky)
            return false;
        try {
            const offDays = teacher.ngay_nghi_dang_ky;
            if (Array.isArray(offDays)) {
                const session = period <= 5 ? 0 : 1;
                return offDays.some(d => d.day === day && (d.session === session || d.session === 2));
            }
        }
        catch (e) { }
        return false;
    }
    getRoomIds() {
        return Array.from(this.roomMap.values());
    }
    getRoomId(name) {
        return this.roomMap.get(name);
    }
    getRangeRoomIds(start, end) {
        const ids = [];
        for (let i = start; i <= end; i++) {
            const id = this.roomMap.get(String(i));
            if (id)
                ids.push(id);
        }
        return ids;
    }
    checkFixedSlot(day, period, grade, session) {
        if (day === 2 && period === 1 && session === 'SANG') {
            return { isFixed: true, subjectCode: 'CHAO_CO' };
        }
        if (day === 2) {
            if (session === 'SANG' && period === 2)
                return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            if (session === 'CHIEU' && period === 6)
                return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
        }
        if (day === 7) {
            if ((session === 'SANG' && period === 4) || (session === 'CHIEU' && period === 9)) {
                return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            }
            if ((session === 'SANG' && period === 5) || (session === 'CHIEU' && period === 10)) {
                return { isFixed: true, subjectCode: 'SH_CUOI_TUAN' };
            }
        }
        if (day === 5) {
            if (session === 'SANG') {
                if (period === 1)
                    return { isFixed: true, subjectCode: 'GDDP' };
                if (period === 2)
                    return { isFixed: true, subjectCode: 'HDTN' };
            }
            if (session === 'CHIEU') {
                if (period === 6)
                    return { isFixed: true, subjectCode: 'GDDP' };
                if (period === 7)
                    return { isFixed: true, subjectCode: 'HDTN' };
            }
        }
        return { isFixed: false };
    }
    checkHardConstraints(schedule) {
        let violations = 0;
        const teacherMap = this.groupBy(schedule, 'teacherId');
        for (const [_, slots] of teacherMap) {
            violations += this.countTimeOverlaps(slots);
        }
        const classMap = this.groupBy(schedule, 'classId');
        for (const [_, slots] of classMap) {
            violations += this.countTimeOverlaps(slots);
        }
        const roomMap = this.groupBy(schedule, 'roomId');
        for (const [roomId, slots] of roomMap) {
            if (!roomId)
                continue;
            violations += this.countTimeOverlaps(slots);
        }
        return violations;
    }
    countTimeOverlaps(slots) {
        let overlaps = 0;
        const timeMap = new Map();
        for (const s of slots) {
            const key = `${s.day}-${s.period}`;
            timeMap.set(key, (timeMap.get(key) || 0) + 1);
        }
        for (const count of timeMap.values()) {
            if (count > 1)
                overlaps += (count - 1);
        }
        return overlaps;
    }
    calculatePenalty(schedule) {
        let score = 0;
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');
        score += this.checkSpreadSubjects(classSchedule) * 10;
        score += this.checkHeavySubjects(classSchedule) * 20;
        score += this.checkMorningPriority(classSchedule) * 15;
        score += this.checkBlock2(classSchedule) * 10;
        score += this.checkTeacherOffDay(schedule) * 50;
        score += this.checkNoHoles(teacherSchedule) * 5;
        score += this.checkMaxLoad(teacherSchedule) * 10;
        return score;
    }
    groupBy(schedule, key) {
        const map = new Map();
        for (const s of schedule) {
            const k = String(s[key]);
            if (!map.has(k))
                map.set(k, []);
            map.get(k).push(s);
        }
        return map;
    }
    checkSpreadSubjects(classSchedule) {
        let penalty = 0;
        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId))
                    subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId).push(s.day);
            }
            for (const [subjId, days] of subjectMap) {
                if (days.length > 2) {
                    const uniqueDays = new Set(days).size;
                    if (uniqueDays < Math.min(days.length, 3)) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }
    checkHeavySubjects(classSchedule) {
        let penalty = 0;
        const heavySubjects = ['TOAN', 'LY', 'HOA', 'VAT_LY', 'HOA_HOC'];
        for (const [_, slots] of classSchedule) {
            const sortedByDay = new Map();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day))
                    sortedByDay.set(s.day, []);
                sortedByDay.get(s.day).push(s);
            });
            for (const [day, daySlots] of sortedByDay) {
                daySlots.sort((a, b) => a.period - b.period);
                let consec = 0;
                let lastSubj = '';
                for (const s of daySlots) {
                    const subjCode = this.getSubjectCode(s.subjectId);
                    const isHeavy = heavySubjects.some(h => subjCode.includes(h));
                    if (isHeavy) {
                        if (subjCode === lastSubj) {
                            consec++;
                        }
                        else {
                            consec = 1;
                            lastSubj = subjCode;
                        }
                    }
                    else {
                        consec = 0;
                        lastSubj = '';
                    }
                    if (consec > 3)
                        penalty++;
                }
            }
        }
        return penalty;
    }
    checkMorningPriority(classSchedule) {
        let penalty = 0;
        const priority = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];
        for (const [_, slots] of classSchedule) {
            for (const s of slots) {
                const subjCode = this.getSubjectCode(s.subjectId);
                if (priority.some(p => subjCode.includes(p))) {
                    if (s.period > 3 && s.period <= 5) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }
    checkBlock2(classSchedule) {
        let penalty = 0;
        const blocks = ['TOAN', 'VAN', 'NGU_VAN', 'TIN', 'LY', 'HOA', 'SINH'];
        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId))
                    subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId).push(s);
            }
            for (const [subjId, subjSlots] of subjectMap) {
                const code = this.getSubjectCode(subjId);
                if (blocks.some(b => code.includes(b))) {
                    subjSlots.sort((a, b) => a.day === b.day ? a.period - b.period : a.day - b.day);
                    for (let i = 0; i < subjSlots.length; i++) {
                        const prev = subjSlots[i - 1];
                        const next = subjSlots[i + 1];
                        const curr = subjSlots[i];
                        const isAdjPrev = prev && prev.day === curr.day && Math.abs(prev.period - curr.period) === 1;
                        const isAdjNext = next && next.day === curr.day && Math.abs(next.period - curr.period) === 1;
                        if (!isAdjPrev && !isAdjNext && subjSlots.length > 1) {
                            penalty++;
                        }
                    }
                }
            }
        }
        return penalty;
    }
    checkTeacherOffDay(schedule) {
        let penalty = 0;
        for (const slot of schedule) {
            const teacher = this.teacherMap.get(slot.teacherId);
            if (teacher && teacher.ngay_nghi_dang_ky) {
                try {
                    const offDays = teacher.ngay_nghi_dang_ky;
                    if (Array.isArray(offDays)) {
                        const session = slot.period <= 5 ? 0 : 1;
                        const isOff = offDays.some(d => d.day === slot.day && (d.session === session || d.session === 2));
                        if (isOff)
                            penalty++;
                    }
                }
                catch (e) { }
            }
        }
        return penalty;
    }
    checkNoHoles(teacherSchedule) {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const sortedByDay = new Map();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day))
                    sortedByDay.set(s.day, []);
                sortedByDay.get(s.day).push(s);
            });
            for (const [day, daySlots] of sortedByDay) {
                if (daySlots.length < 2)
                    continue;
                daySlots.sort((a, b) => a.period - b.period);
                for (let i = 0; i < daySlots.length - 1; i++) {
                    const curr = daySlots[i];
                    const next = daySlots[i + 1];
                    const currSession = curr.period <= 5 ? 0 : 1;
                    const nextSession = next.period <= 5 ? 0 : 1;
                    if (currSession === nextSession) {
                        const gap = next.period - curr.period - 1;
                        if (gap > 0)
                            penalty += gap;
                    }
                }
            }
        }
        return penalty;
    }
    checkMaxLoad(teacherSchedule) {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const daySessionCounts = new Map();
            for (const s of slots) {
                const session = s.period <= 5 ? 'SANG' : 'CHIEU';
                const key = `${s.day}-${session}`;
                daySessionCounts.set(key, (daySessionCounts.get(key) || 0) + 1);
            }
            for (const count of daySessionCounts.values()) {
                if (count > 4)
                    penalty += (count - 4);
            }
        }
        return penalty;
    }
    getSubjectCode(id) {
        const subj = this.subjects.find(s => s.id === id);
        return subj ? subj.code.toUpperCase() : '';
    }
    getFitnessDetails(schedule) {
        const details = [];
        const hc1 = this.checkTeacherConflictDetails(schedule);
        if (hc1)
            details.push(`Giáo viên trùng giờ: -${hc1 * 100} điểm (${hc1} lỗi)`);
        const hc2 = this.checkClassConflictDetails(schedule);
        if (hc2)
            details.push(`Lớp học trùng giờ: -${hc2 * 100} điểm (${hc2} lỗi)`);
        const hc3 = this.checkRoomConflictDetails(schedule);
        if (hc3)
            details.push(`Phòng học trùng giờ: -${hc3 * 100} điểm (${hc3} lỗi)`);
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');
        const sc1 = this.checkSpreadSubjects(classSchedule);
        if (sc1)
            details.push(`Môn học dồn cục (chưa rải đều): -${sc1 * 10} điểm`);
        const sc2 = this.checkHeavySubjects(classSchedule);
        if (sc2)
            details.push(`Môn nặng học liền nhau: -${sc2 * 20} điểm`);
        const sc3 = this.checkMorningPriority(classSchedule);
        if (sc3)
            details.push(`Môn ưu tiên học buổi chiều/tiết cuối: -${sc3 * 15} điểm`);
        const sc4 = this.checkBlock2(classSchedule);
        if (sc4)
            details.push(`Môn 2 tiết bị xé lẻ: -${sc4 * 10} điểm`);
        const sc5 = this.checkTeacherOffDay(schedule);
        if (sc5)
            details.push(`Giáo viên dạy ngày nghỉ: -${sc5 * 50} điểm`);
        const sc6 = this.checkNoHoles(teacherSchedule);
        if (sc6)
            details.push(`Tiết trống giáo viên (lủng lịch): -${sc6 * 5} điểm`);
        const sc7 = this.checkMaxLoad(teacherSchedule);
        if (sc7)
            details.push(`Giáo viên dạy quá số tiết/buổi: -${sc7 * 10} điểm`);
        const hardViolations = hc1 + hc2 + hc3;
        const softPenalty = (sc1 * 10) + (sc2 * 20) + (sc3 * 15) + (sc4 * 10) + (sc5 * 50) + (sc6 * 5) + (sc7 * 10);
        const score = 1000 - (hardViolations * 100) - softPenalty;
        return { score, details };
    }
    checkTeacherConflictDetails(schedule) {
        const map = this.groupBy(schedule, 'teacherId');
        let v = 0;
        for (const [_, slots] of map)
            v += this.countTimeOverlaps(slots);
        return v;
    }
    checkClassConflictDetails(schedule) {
        const map = this.groupBy(schedule, 'classId');
        let v = 0;
        for (const [_, slots] of map)
            v += this.countTimeOverlaps(slots);
        return v;
    }
    checkRoomConflictDetails(schedule) {
        const map = this.groupBy(schedule, 'roomId');
        let v = 0;
        for (const [id, slots] of map) {
            if (id)
                v += this.countTimeOverlaps(slots);
        }
        return v;
    }
};
exports.ConstraintService = ConstraintService;
exports.ConstraintService = ConstraintService = ConstraintService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConstraintService);
//# sourceMappingURL=constraint.service.js.map