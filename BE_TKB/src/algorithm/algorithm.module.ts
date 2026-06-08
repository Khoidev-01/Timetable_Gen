
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AlgorithmController } from './algorithm.controller';
import { AlgorithmService } from './algorithm.service';
import { SystemModule } from '../system/system.module';
import { ResourcesModule } from '../resources/resources.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { TimetablesModule } from '../timetables/timetables.module';
import { WorkerModule } from '../worker/worker.module';
import { ExportService } from './export.service';
import { ConstraintService } from './constraint.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SystemModule,
    ResourcesModule,
    AssignmentsModule,
    TimetablesModule,
    forwardRef(() => WorkerModule)
  ],
  controllers: [AlgorithmController],
  providers: [AlgorithmService, ExportService, ConstraintService],
  exports: [AlgorithmService, ConstraintService]
})
export class AlgorithmModule { }
