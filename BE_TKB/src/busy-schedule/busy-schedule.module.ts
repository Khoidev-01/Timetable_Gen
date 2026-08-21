import { Module } from '@nestjs/common';
import { BusyScheduleService } from './busy-schedule.service';
import { BusyScheduleController } from './busy-schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notifications/notification.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
    imports: [PrismaModule, NotificationModule, AuthModule, AiModule, ScheduleModule],
    controllers: [BusyScheduleController],
    providers: [BusyScheduleService],
})
export class BusyScheduleModule { }
