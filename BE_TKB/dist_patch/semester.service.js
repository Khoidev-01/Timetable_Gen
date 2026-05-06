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
exports.SemesterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SemesterService = class SemesterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.semester.findMany({ include: { academic_year: true } });
    }
    async findByYear(yearId) {
        return this.prisma.semester.findMany({ where: { year_id: yearId } });
    }
    async getCurrentSemester() {
        return this.prisma.semester.findFirst({ where: { is_current: true } });
    }
    async create(data) {
        return this.prisma.semester.create({ data });
    }
    async update(id, data) {
        const { start_date, end_date, name } = data;
        return this.prisma.semester.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(start_date !== undefined && { start_date: start_date ? new Date(start_date) : null }),
                ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
            }
        });
    }
    async setCurrent(id) {
        await this.prisma.semester.updateMany({ data: { is_current: false } });
        return this.prisma.semester.update({ where: { id }, data: { is_current: true } });
    }
    async delete(id) {
        const sem = await this.prisma.semester.findUnique({
            where: { id },
            include: { _count: { select: { teaching_assignments: true, generated_timetables: true, busy_requests: true } } }
        });
        if (!sem) throw new common_1.NotFoundException('Không tìm thấy học kỳ');
        if (sem._count.teaching_assignments > 0 || sem._count.generated_timetables > 0) {
            throw new common_1.BadRequestException('Học kỳ đã có dữ liệu phân công hoặc TKB. Xóa dữ liệu đó trước.');
        }
        await this.prisma.teacherBusyRequest.deleteMany({ where: { semester_id: id } });
        return this.prisma.semester.delete({ where: { id } });
    }
};
exports.SemesterService = SemesterService;
exports.SemesterService = SemesterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SemesterService);
//# sourceMappingURL=semester.service.js.map
