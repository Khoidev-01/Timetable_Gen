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
exports.ExcelController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const excel_service_1 = require("./excel.service");
const excel_utils_1 = require("./excel.utils");
let ExcelController = class ExcelController {
    excelService;
    constructor(excelService) {
        this.excelService = excelService;
    }
    async downloadTemplate(academicYearId, res) {
        const payload = await this.excelService.downloadTemplate(academicYearId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': (0, excel_utils_1.buildAttachmentDisposition)(payload.fileName),
            'Content-Length': payload.buffer.length,
        });
        res.end(payload.buffer);
    }
    async exportWorkbook(academicYearId, res) {
        const payload = await this.excelService.exportWorkbook(academicYearId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': (0, excel_utils_1.buildAttachmentDisposition)(payload.fileName),
            'Content-Length': payload.buffer.length,
        });
        res.end(payload.buffer);
    }
    async importWorkbook(academicYearId, file) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException('Thiếu file Excel để import.');
        }
        return this.excelService.importWorkbook(academicYearId, file.buffer);
    }
};
exports.ExcelController = ExcelController;
__decorate([
    (0, common_1.Get)('workbook/template/:academicYearId'),
    __param(0, (0, common_1.Param)('academicYearId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExcelController.prototype, "downloadTemplate", null);
__decorate([
    (0, common_1.Get)('workbook/export/:academicYearId'),
    __param(0, (0, common_1.Param)('academicYearId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExcelController.prototype, "exportWorkbook", null);
__decorate([
    (0, common_1.Post)('workbook/import/:academicYearId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, callback) => {
            if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
                callback(new common_1.BadRequestException('Chỉ hỗ trợ file .xlsx.'), false);
                return;
            }
            callback(null, true);
        },
    })),
    __param(0, (0, common_1.Param)('academicYearId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExcelController.prototype, "importWorkbook", null);
exports.ExcelController = ExcelController = __decorate([
    (0, common_1.Controller)('excel'),
    __metadata("design:paramtypes", [excel_service_1.ExcelService])
], ExcelController);
//# sourceMappingURL=excel.controller.js.map