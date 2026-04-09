
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SystemModule } from './system/system.module';
import { ResourcesModule } from './resources/resources.module';
import { UsersModule } from './users/users.module';
import { OrganizationModule } from './organization/organization.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TimetablesModule } from './timetables/timetables.module';
import { AlgorithmModule } from './algorithm/algorithm.module';
import { BullModule } from '@nestjs/bullmq';
import { WorkerModule } from './worker/worker.module';
import { AuthModule } from './auth/auth.module';
import { ExcelModule } from './excel/excel.module';
import { ConstraintsModule } from './constraints/constraints.module';
import { NotificationModule } from './notifications/notification.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    SystemModule,
    ResourcesModule,
    UsersModule,
    OrganizationModule,
    AssignmentsModule,
    TimetablesModule,
    AlgorithmModule,
    WorkerModule,
    AuthModule,
    ExcelModule,
    ConstraintsModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
