
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';

@Processor('optimization', { lockDuration: 180000 })
export class AlgorithmProcessor extends WorkerHost {
    private readonly logger = new Logger(AlgorithmProcessor.name);

    constructor(private readonly algorithmService: AlgorithmService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { semesterId, options } = job.data as any;
        this.logger.log(`Starting optimization for Semester ${semesterId}`);

        try {
            const result: any = await this.algorithmService.runAlgorithm(semesterId, options);

            if (result.success) {
                this.logger.log(`Optimization Finished. Created Timetable ID: ${result.id}`);
            } else {
                this.logger.warn(`Optimization LOGICALLY Failed: ${result.error}`);
            }

            return {
                success: result.success,
                timetableId: result.id,
                debugLogs: result.debugLogs,
                error: result.error
            };
        } catch (error: any) {
            this.logger.error(`Optimization Crashed: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }
}
