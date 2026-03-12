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
exports.TeacherService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TeacherService = class TeacherService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.teacher.findMany({ include: { constraints: true } });
    }
    async findOne(id) {
        const teacher = await this.prisma.teacher.findUnique({
            where: { id },
            include: { constraints: true, homeroom_classes: true }
        });
        if (!teacher)
            throw new common_1.NotFoundException('Teacher not found');
        return teacher;
    }
    async create(data) {
        return this.prisma.teacher.create({ data });
    }
    async update(id, data) {
        return this.prisma.teacher.update({ where: { id }, data });
    }
    async updateConstraints(teacherId, constraints) {
        await this.prisma.teacherConstraint.deleteMany({ where: { teacher_id: teacherId } });
        if (constraints.length > 0) {
            await this.prisma.teacherConstraint.createMany({
                data: constraints.map(c => ({
                    teacher_id: teacherId,
                    day_of_week: c.day,
                    period: c.period,
                    session: c.session,
                    type: c.type
                }))
            });
        }
        return this.findOne(teacherId);
    }
};
exports.TeacherService = TeacherService;
exports.TeacherService = TeacherService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TeacherService);
//# sourceMappingURL=teacher.service.js.map