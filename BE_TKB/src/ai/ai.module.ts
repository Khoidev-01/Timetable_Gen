import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { ScheduleTools } from './tools/schedule.tools';
import { ToolsController } from './tools/tools.controller';
import { AssistantController } from './assistant.controller';
import { OrchestratorService } from './orchestrator.service';
import { LLM_PROVIDER } from './providers/llm-provider.interface';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AiService } from './ai.service';

@Module({
    imports: [PrismaModule, AlgorithmModule],
    controllers: [ToolsController, AssistantController],
    providers: [
        AiService,
        ScheduleTools,
        OrchestratorService,
        // Swapping provider is an .env change; the interface is what the orchestrator sees
        { provide: LLM_PROVIDER, useClass: OpenAiCompatibleProvider },
    ],
    exports: [AiService, ScheduleTools, OrchestratorService],
})
export class AiModule { }
