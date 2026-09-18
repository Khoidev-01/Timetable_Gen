
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';
import { AlgorithmGateway } from '../algorithm/algorithm.gateway';

/**
 * Mỗi lần chỉ xếp một học kỳ, và không bao giờ tự chạy lại một lần đang dở.
 *
 * Bộ xếp lịch chiếm trọn luồng xử lý vài phút, nên với khóa mặc định 30 giây BullMQ không kịp
 * gia hạn, coi job là treo và giao lại cho lần chạy thứ hai - chạy song song với lần đầu. Hai lần
 * dùng chung ConstraintService, lần sau nạp dữ liệu học kỳ khác ngay giữa lúc lần trước đang tìm
 * kiếm: đã gặp thật khi xếp HK1 và HK2 liền nhau, HK1 ra 929/930 tiết và không hợp lệ.
 */
@Processor('optimization', {
    concurrency: 1,
    lockDuration: 30 * 60_000,
    stalledInterval: 30 * 60_000,
    maxStalledCount: 0,
})
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
                    `[Worker] Optimization Finished. Timetable ${result.id} - ` +
                    `${saved}/${generated} tiết lưu được (${rejected} bị từ chối), ` +
                    `${result.isValid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}`
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
