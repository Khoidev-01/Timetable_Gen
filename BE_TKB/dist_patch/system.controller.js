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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const common_1 = require("@nestjs/common");
const academic_year_service_1 = require("./academic-year.service");
const semester_service_1 = require("./semester.service");
let SystemController = class SystemController {
    yearService;
    semesterService;
    constructor(yearService, semesterService) {
        this.yearService = yearService;
        this.semesterService = semesterService;
    }
    getYears() {
        return this.yearService.findAll();
    }
    createYear(body) {
        return this.yearService.create(body);
    }
    updateYear(id, body) {
        return this.yearService.update(id, body);
    }
    deleteYear(id) {
        return this.yearService.delete(id);
    }
    getActiveYear() {
        return this.yearService.getActiveYear();
    }
    getSemesters() {
        return this.semesterService.findAll();
    }
    createSemester(body) {
        return this.semesterService.create(body);
    }
    updateSemester(id, body) {
        return this.semesterService.update(id, body);
    }
    setCurrentSemester(id) {
        return this.semesterService.setCurrent(id);
    }
    deleteSemester(id) {
        return this.semesterService.delete(id);
    }
};
exports.SystemController = SystemController;
__decorate([
    (0, common_1.Get)('years'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getYears", null);
__decorate([
    (0, common_1.Post)('years'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createYear", null);
__decorate([
    (0, common_1.Put)('years/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateYear", null);
__decorate([
    (0, common_1.Delete)('years/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deleteYear", null);
__decorate([
    (0, common_1.Get)('years/active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getActiveYear", null);
__decorate([
    (0, common_1.Get)('semesters'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getSemesters", null);
__decorate([
    (0, common_1.Post)('semesters'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createSemester", null);
__decorate([
    (0, common_1.Put)('semesters/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateSemester", null);
__decorate([
    (0, common_1.Put)('semesters/:id/set-current'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "setCurrentSemester", null);
__decorate([
    (0, common_1.Delete)('semesters/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deleteSemester", null);
exports.SystemController = SystemController = __decorate([
    (0, common_1.Controller)('system'),
    __metadata("design:paramtypes", [academic_year_service_1.AcademicYearService,
        semester_service_1.SemesterService])
], SystemController);
//# sourceMappingURL=system.controller.js.map
