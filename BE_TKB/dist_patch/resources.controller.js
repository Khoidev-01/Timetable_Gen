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
exports.ResourcesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const room_service_1 = require("./room.service");
const subject_service_1 = require("./subject.service");
const teacher_service_1 = require("./teacher.service");
let ResourcesController = class ResourcesController {
    prisma;
    roomService;
    subjectService;
    teacherService;
    constructor(prisma, roomService, subjectService, teacherService) {
        this.prisma = prisma;
        this.roomService = roomService;
        this.subjectService = subjectService;
        this.teacherService = teacherService;
    }
    async getStats() {
        const [teachers, classes, subjects, rooms] = await Promise.all([
            this.prisma.teacher.count(),
            this.prisma.class.count(),
            this.prisma.subject.count(),
            this.prisma.room.count(),
        ]);
        return { teachers, classes, subjects, rooms };
    }
    getRooms() { return this.roomService.findAll(); }
    createRoom(body) { return this.roomService.create(body); }
    updateRoom(id, body) { return this.roomService.update(+id, body); }
    deleteAllRooms() { return this.roomService.deleteAll(); }
    deleteRoom(id) { return this.roomService.delete(+id); }
    getSubjects() { return this.subjectService.findAll(); }
    createSubject(body) { return this.subjectService.create(body); }
    updateSubject(id, body) { return this.subjectService.update(+id, body); }
    deleteAllSubjects() { return this.subjectService.deleteAll(); }
    deleteSubject(id) { return this.subjectService.delete(+id); }
    getTeachers() { return this.teacherService.findAll(); }
    getTeacher(id) { return this.teacherService.findOne(id); }
    createTeacher(body) { return this.teacherService.create(body); }
    updateTeacher(id, body) { return this.teacherService.update(id, body); }
    deleteAllTeachers() { return this.teacherService.deleteAll(); }
    deleteTeacher(id) { return this.teacherService.delete(id); }
    updateTeacherConstraints(id, body) {
        return this.teacherService.updateConstraints(id, body);
    }
};
exports.ResourcesController = ResourcesController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('rooms'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getRooms", null);
__decorate([
    (0, common_1.Post)('rooms'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Put)('rooms/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "updateRoom", null);
__decorate([
    (0, common_1.Delete)('rooms/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteAllRooms", null);
__decorate([
    (0, common_1.Delete)('rooms/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteRoom", null);
__decorate([
    (0, common_1.Get)('subjects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getSubjects", null);
__decorate([
    (0, common_1.Post)('subjects'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "createSubject", null);
__decorate([
    (0, common_1.Put)('subjects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "updateSubject", null);
__decorate([
    (0, common_1.Delete)('subjects/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteAllSubjects", null);
__decorate([
    (0, common_1.Delete)('subjects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteSubject", null);
__decorate([
    (0, common_1.Get)('teachers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getTeachers", null);
__decorate([
    (0, common_1.Get)('teachers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getTeacher", null);
__decorate([
    (0, common_1.Post)('teachers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "createTeacher", null);
__decorate([
    (0, common_1.Put)('teachers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "updateTeacher", null);
__decorate([
    (0, common_1.Delete)('teachers/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteAllTeachers", null);
__decorate([
    (0, common_1.Delete)('teachers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteTeacher", null);
__decorate([
    (0, common_1.Put)('teachers/:id/constraints'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "updateTeacherConstraints", null);
exports.ResourcesController = ResourcesController = __decorate([
    (0, common_1.Controller)('resources'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        room_service_1.RoomService,
        subject_service_1.SubjectService,
        teacher_service_1.TeacherService])
], ResourcesController);
//# sourceMappingURL=resources.controller.js.map
