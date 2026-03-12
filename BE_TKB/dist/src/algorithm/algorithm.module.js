"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgorithmModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const algorithm_controller_1 = require("./algorithm.controller");
const algorithm_service_1 = require("./algorithm.service");
const system_module_1 = require("../system/system.module");
const resources_module_1 = require("../resources/resources.module");
const assignments_module_1 = require("../assignments/assignments.module");
const timetables_module_1 = require("../timetables/timetables.module");
const worker_module_1 = require("../worker/worker.module");
const export_service_1 = require("./export.service");
const constraint_service_1 = require("./constraint.service");
let AlgorithmModule = class AlgorithmModule {
};
exports.AlgorithmModule = AlgorithmModule;
exports.AlgorithmModule = AlgorithmModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            system_module_1.SystemModule,
            resources_module_1.ResourcesModule,
            assignments_module_1.AssignmentsModule,
            timetables_module_1.TimetablesModule,
            (0, common_1.forwardRef)(() => worker_module_1.WorkerModule)
        ],
        controllers: [algorithm_controller_1.AlgorithmController],
        providers: [algorithm_service_1.AlgorithmService, export_service_1.ExportService, constraint_service_1.ConstraintService],
        exports: [algorithm_service_1.AlgorithmService]
    })
], AlgorithmModule);
//# sourceMappingURL=algorithm.module.js.map