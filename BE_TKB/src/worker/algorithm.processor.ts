
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';
import { AlgorithmGateway } from '../algorithm/algorithm.gateway';

@Processor('optimization')
export class AlgorithmProcessor extends WorkerHost {
    constructor(
        private readonly algorithmService: AlgorithmService,
        private readonly gateway: AlgorithmGateway,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { semesterId } = job.data as any; // Cast job data just in case
        console.log(`[Worker] Starting optimization for Semester ${semesterId}...`);

        try {
            // Updated to use the monolithic runAlgorithm method
            const result: any = await this.algorithmService.runAlgorithm(semesterId);

            if (result.success) {
                const { generated, saved, rejected } = result.stats ?? {};
                console.log(
                    `[Worker] Optimization Finished. Timetable ${result.id} — ` +
                    `${saved}/${generated} tiết lưu được (${rejected} bị từ chối), ` +
                    `điểm ${result.fitnessScore}, ${result.isValid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}`
                );
            } else {
                console.warn(`[Worker] Optimization LOGICALLY Failed: ${result.error}`);
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
            console.error(`[Worker] Optimization Crashed:`, error);
            // Return crash as result to view logs if captured (unlikely here)
            return { success: false, error: error.message };
        }
    }
}
