import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { ScheduleTools } from './tools/schedule.tools';
import { ToolsController } from './tools/tools.controller';
import { AssistantController } from './assistant.controller';
import { OrchestratorService } from './orchestrator.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { AssistantEvalService } from './eval/assistant-eval.service';
import { LLM_PROVIDER } from './providers/llm-provider.interface';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AssistantGuardService } from './assistant-guard.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { AiService } from './ai.service';

@Module({
    imports: [PrismaModule, AlgorithmModule],
    controllers: [ToolsController, AssistantController],
    providers: [
        AssistantGuardService,
        ConversationMemoryService,
        AiService,
        ScheduleTools,
        OrchestratorService,
        AssistantEvalService,
        KnowledgeService,
        // Swapping provider is an .env change; the interface is what the orchestrator sees
        { provide: LLM_PROVIDER, useClass: OpenAiCompatibleProvider },
    ],
    exports: [AiService, ScheduleTools, OrchestratorService, AssistantEvalService, KnowledgeService],
})
export class AiModule { }
