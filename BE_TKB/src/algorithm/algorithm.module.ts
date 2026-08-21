
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConstraintsModule } from '../constraints/constraints.module';
import { AlgorithmController } from './algorithm.controller';
import { AlgorithmService } from './algorithm.service';
import { SystemModule } from '../system/system.module';
import { ResourcesModule } from '../resources/resources.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { TimetablesModule } from '../timetables/timetables.module';
import { WorkerModule } from '../worker/worker.module';
import { ExportService } from './export.service';
import { ConstraintService } from './constraint.service';
import { FeasibilityService } from './feasibility.service';
import { AlgorithmGateway } from './algorithm.gateway';
import { BenchmarkService } from './benchmark.service';
import { VariantService } from './variant.service';
import { SwapGraphService } from './swap-graph.service';
import { ChangeLogService } from './change-log.service';
import { AnalyticsService } from './analytics.service';
import { PatternMiningService } from './pattern-mining.service';
import { FairnessService } from './fairness.service';

@Module({
  imports: [
    PrismaModule,
    ConstraintsModule,
    SystemModule,
    ResourcesModule,
    AssignmentsModule,
    TimetablesModule,
    forwardRef(() => WorkerModule)
  ],
  controllers: [AlgorithmController],
  providers: [AlgorithmService, ExportService, ConstraintService, FeasibilityService, AlgorithmGateway, BenchmarkService, VariantService, SwapGraphService, ChangeLogService, AnalyticsService, PatternMiningService, FairnessService],
  exports: [AlgorithmService, AlgorithmGateway, ConstraintService]
})
export class AlgorithmModule { }
