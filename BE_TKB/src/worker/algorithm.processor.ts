
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';
import { AlgorithmGateway } from '../algorithm/algorithm.gateway';

@Processor('optimization')
export class AlgorithmProcessor extends WorkerHost {
    private readonly logger = new Logger(AlgorithmProcessor.name);

    constructor(
        private readonly algorithmService: AlgorithmService,
        private readonly gateway: AlgorithmGateway,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { semesterId } = job.data as any;
        this.logger.log(`Starting optimization for Semester ${semesterId}`);

        try {
            const result: any = await this.algorithmService.runAlgorithm(semesterId);

            if (result.success) {
                const { generated, saved, rejected } = result.stats ?? {};
                console.log(
                    `[Worker] Optimization Finished. Timetable ${result.id} — ` +
                    `${saved}/${generated} tiết lưu được (${rejected} bị từ chối), ` +
                    `điểm ${result.fitnessScore}, ${result.isValid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}`
                );
            } else {
                this.logger.warn(`Optimization LOGICALLY Failed: ${result.error}`);
            }

            this.gateway.publishDone(semesterId, {
                success: result.success,
                timetableId: result.id,
                fitnessScore: result.fitnessScore,
                isValid: result.isValid,
                stats: result.stats,
                error: result.error,
            });

            return {
                success: result.success,
                timetableId: result.id,
                debugLogs: result.debugLogs,
                fitnessScore: result.fitnessScore,
                fitnessDetails: result.fitnessDetails,
                isValid: result.isValid,
                stats: result.stats,
                error: result.error
            };
        } catch (error: any) {
            this.logger.error(`Optimization Crashed: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }
}
