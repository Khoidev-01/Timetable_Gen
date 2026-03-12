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
exports.AlgorithmController = void 0;
const common_1 = require("@nestjs/common");
const algorithm_service_1 = require("./algorithm.service");
const algorithm_producer_1 = require("../worker/algorithm.producer");
const export_service_1 = require("./export.service");
const excel_utils_1 = require("../excel/excel.utils");
let AlgorithmController = class AlgorithmController {
    algorithmService;
    algorithmProducer;
    exportService;
    constructor(algorithmService, algorithmProducer, exportService) {
        this.algorithmService = algorithmService;
        this.algorithmProducer = algorithmProducer;
        this.exportService = exportService;
    }
    async startOptimization(body) {
        return this.algorithmProducer.startOptimization(body.semesterId);
    }
    async getStatus(jobId) {
        return this.algorithmProducer.getJobStatus(jobId);
    }
    async getResult(semesterId) {
        return this.algorithmProducer.getResult(semesterId);
    }
    async exportSchedule(semesterId, res) {
        const payload = await this.exportService.exportScheduleToExcel(semesterId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': (0, excel_utils_1.buildAttachmentDisposition)(payload.fileName),
            'Content-Length': payload.buffer.length,
        });
        res.end(payload.buffer);
    }
    async moveSlot(body) {
        return this.algorithmService.moveSlot(body);
    }
    async toggleLock(body) {
        return this.algorithmService.toggleLock(body.slotId);
    }
};
exports.AlgorithmController = AlgorithmController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "startOptimization", null);
__decorate([
    (0, common_1.Get)('status/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('result/:semesterId'),
    __param(0, (0, common_1.Param)('semesterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "getResult", null);
__decorate([
    (0, common_1.Get)('export/:semesterId'),
    __param(0, (0, common_1.Param)('semesterId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "exportSchedule", null);
__decorate([
    (0, common_1.Post)('move-slot'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "moveSlot", null);
__decorate([
    (0, common_1.Post)('toggle-lock'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlgorithmController.prototype, "toggleLock", null);
exports.AlgorithmController = AlgorithmController = __decorate([
    (0, common_1.Controller)('algorithm'),
    __metadata("design:paramtypes", [algorithm_service_1.AlgorithmService,
        algorithm_producer_1.AlgorithmProducer,
        export_service_1.ExportService])
], AlgorithmController);
//# sourceMappingURL=algorithm.controller.js.map