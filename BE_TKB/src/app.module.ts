
// Must come first: every module below may read process.env while being evaluated.
import './load-env';
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
import { ScheduleModule } from './schedule/schedule.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { NotificationModule } from './notifications/notification.module';
import { AutoAssignModule } from './auto-assign/auto-assign.module';
import { BusyScheduleModule } from './busy-schedule/busy-schedule.module';

@Module({
  imports: [
    // Blanket ceiling so no endpoint can be hammered; /auth/login tightens it further
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
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
    ScheduleModule,
    NotificationModule,
    AutoAssignModule,
    BusyScheduleModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Protected by default: a route is reachable only with a valid token unless it
    // explicitly opts out with @Public(), and only by the roles @Roles() allows.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule { }
