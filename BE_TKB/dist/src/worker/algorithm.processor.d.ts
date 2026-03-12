import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';
export declare class AlgorithmProcessor extends WorkerHost {
    private readonly algorithmService;
    constructor(algorithmService: AlgorithmService);
    process(job: Job<any, any, string>): Promise<any>;
}
