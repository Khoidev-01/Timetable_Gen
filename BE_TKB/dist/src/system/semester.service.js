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
    async setCurrent(id) {
        await this.prisma.semester.updateMany({ data: { is_current: false } });
        return this.prisma.semester.update({ where: { id }, data: { is_current: true } });
    }
};
exports.SemesterService = SemesterService;
exports.SemesterService = SemesterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SemesterService);
//# sourceMappingURL=semester.service.js.map