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
exports.AlgorithmProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const algorithm_service_1 = require("../algorithm/algorithm.service");
let AlgorithmProcessor = class AlgorithmProcessor extends bullmq_1.WorkerHost {
    algorithmService;
    constructor(algorithmService) {
        super();
        this.algorithmService = algorithmService;
    }
    async process(job) {
        const { semesterId } = job.data;
        console.log(`[Worker] Starting optimization for Semester ${semesterId}...`);
        try {
            const result = await this.algorithmService.runAlgorithm(semesterId);
            if (result.success) {
                console.log(`[Worker] Optimization Finished. Created Timetable ID: ${result.id}`);
            }
            else {
                console.warn(`[Worker] Optimization LOGICALLY Failed: ${result.error}`);
            }
            return {
                success: result.success,
                timetableId: result.id,
                debugLogs: result.debugLogs,
                error: result.error
            };
        }
        catch (error) {
            console.error(`[Worker] Optimization Crashed:`, error);
            return { success: false, error: error.message };
        }
    }
};
exports.AlgorithmProcessor = AlgorithmProcessor;
exports.AlgorithmProcessor = AlgorithmProcessor = __decorate([
    (0, bullmq_1.Processor)('optimization'),
    __metadata("design:paramtypes", [algorithm_service_1.AlgorithmService])
], AlgorithmProcessor);
//# sourceMappingURL=algorithm.processor.js.map