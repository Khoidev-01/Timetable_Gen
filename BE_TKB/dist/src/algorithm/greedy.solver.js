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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreedySolver = void 0;
const common_1 = require("@nestjs/common");
const constraint_service_1 = require("./constraint.service");
let GreedySolver = class GreedySolver {
    constraintService;
    constructor(constraintService) {
        this.constraintService = constraintService;
    }
    async solveSchedule(assignments, fixedSlots, maxRetries = 3) {
        let bestSchedule = [];
        let leastFailures = Infinity;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const currentSchedule = [...fixedSlots];
            let failures = 0;
            const sortedAssignments = [...assignments].sort((a, b) => {
                const aDur = a.so_tiet_lien_tiep || 1;
                const bDur = b.so_tiet_lien_tiep || 1;
                if (bDur !== aDur)
                    return bDur - aDur;
                return Math.random() - 0.5;
            });
            for (const assign of sortedAssignments) {
                const duration = assign.so_tiet_lien_tiep || 1;
                const validSlot = this.findValidSlot(assign, duration, currentSchedule);
                if (validSlot) {
                    currentSchedule.push(...validSlot);
                }
                else {
                    failures++;
                    const randomSlot = this.placeRandomly(assign, duration);
                    currentSchedule.push(...randomSlot);
                }
            }
            if (failures < leastFailures) {
                leastFailures = failures;
                bestSchedule = currentSchedule;
            }
            if (failures === 0)
                break;
        }
        return bestSchedule;
    }
    isTeacherBusy(teacherId, day, startPeriod, duration, schedule) {
        for (let i = 0; i < duration; i++) {
            const p = startPeriod + i;
            if (this.constraintService.isTeacherBusy(teacherId, day, p)) {
                return true;
            }
            const exists = schedule.some(s => s.teacherId === teacherId &&
                s.day === day &&
                s.period === p);
            if (exists)
                return true;
        }
        return false;
    }
    isClassBusy(classId, day, startPeriod, duration, schedule) {
        for (let i = 0; i < duration; i++) {
            const p = startPeriod + i;
            const exists = schedule.some(s => s.classId === classId &&
                s.day === day &&
                s.period === p);
            if (exists)
                return true;
        }
        return false;
    }
    findValidSlot(assign, duration, currentSchedule) {
        const isMorning = assign.lop_hoc.buoi_hoc === 'SANG';
        const sessionOffset = isMorning ? 0 : 5;
        const days = [2, 3, 4, 5, 6, 7];
        days.sort(() => Math.random() - 0.5);
        for (const d of days) {
            const possibleStarts = [];
            for (let p = 1; p <= 6 - duration; p++) {
                if (p <= 5)
                    possibleStarts.push(p);
            }
            possibleStarts.sort(() => Math.random() - 0.5);
            for (const relP of possibleStarts) {
                const absStartP = relP + sessionOffset;
                if (this.isTeacherBusy(assign.giao_vien_id, d, absStartP, duration, currentSchedule))
                    continue;
                if (this.isClassBusy(assign.lop_hoc_id, d, absStartP, duration, currentSchedule))
                    continue;
                const candidateSlots = [];
                for (let i = 0; i < duration; i++) {
                    candidateSlots.push({
                        id: Math.random().toString(36).substr(2, 9),
                        classId: assign.lop_hoc_id,
                        subjectId: assign.mon_hoc_id,
                        teacherId: assign.giao_vien_id,
                        roomId: undefined,
                        day: d,
                        period: absStartP + i,
                        isFixed: false
                    });
                }
                return candidateSlots;
            }
        }
        return null;
    }
    placeRandomly(assign, duration) {
        const isMorning = assign.lop_hoc.buoi_hoc === 'SANG';
        const sessionOffset = isMorning ? 0 : 5;
        const d = Math.floor(Math.random() * 6) + 2;
        const relP = Math.floor(Math.random() * (6 - duration)) + 1;
        const slots = [];
        for (let i = 0; i < duration; i++) {
            slots.push({
                id: Math.random().toString(36).substr(2, 9),
                classId: assign.lop_hoc_id,
                subjectId: assign.mon_hoc_id,
                teacherId: assign.giao_vien_id,
                roomId: undefined,
                day: d,
                period: relP + sessionOffset + i,
                isFixed: false
            });
        }
        return slots;
    }
};
exports.GreedySolver = GreedySolver;
exports.GreedySolver = GreedySolver = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [constraint_service_1.ConstraintService])
], GreedySolver);
//# sourceMappingURL=greedy.solver.js.map