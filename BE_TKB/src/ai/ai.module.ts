import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { ScheduleTools } from './tools/schedule.tools';
import { ToolsController } from './tools/tools.controller';
import { AiService } from './ai.service';

@Module({
    imports: [PrismaModule, AlgorithmModule],
    controllers: [ToolsController],
    providers: [AiService, ScheduleTools],
    exports: [AiService, ScheduleTools],
})
export class AiModule { }
