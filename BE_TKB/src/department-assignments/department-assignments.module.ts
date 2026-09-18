import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExcelModule } from '../excel/excel.module';
import { WorkerModule } from '../worker/worker.module';
import { DepartmentAssignmentsController } from './department-assignments.controller';
import { DepartmentAssignmentsService } from './department-assignments.service';

@Module({
  imports: [PrismaModule, ExcelModule, WorkerModule],
  controllers: [DepartmentAssignmentsController],
  providers: [DepartmentAssignmentsService],
})
export class DepartmentAssignmentsModule {}
