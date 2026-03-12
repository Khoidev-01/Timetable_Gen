import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlgorithmProducer } from './algorithm.producer';
import { AlgorithmProcessor } from './algorithm.processor';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'optimization',
        }),
        forwardRef(() => AlgorithmModule),
        PrismaModule,
    ],
    providers: [AlgorithmProducer, AlgorithmProcessor],
    exports: [AlgorithmProducer],
})
export class WorkerModule { }
