
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';

@Processor('optimization')
export class AlgorithmProcessor extends WorkerHost {
    constructor(private readonly algorithmService: AlgorithmService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { semesterId } = job.data as any; // Cast job data just in case
        console.log(`[Worker] Starting optimization for Semester ${semesterId}...`);

        try {
            // Updated to use the monolithic runAlgorithm method
            const result: any = await this.algorithmService.runAlgorithm(semesterId);

            if (result.success) {
                console.log(`[Worker] Optimization Finished. Created Timetable ID: ${result.id}`);
            } else {
                console.warn(`[Worker] Optimization LOGICALLY Failed: ${result.error}`);
            }

            return {
                success: result.success,
                timetableId: result.id,
                debugLogs: result.debugLogs,
                error: result.error
            };
        } catch (error: any) {
            console.error(`[Worker] Optimization Crashed:`, error);
            // Return crash as result to view logs if captured (unlikely here)
            return { success: false, error: error.message };
        }
    }
}
