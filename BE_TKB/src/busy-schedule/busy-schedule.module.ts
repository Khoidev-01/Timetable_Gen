import { Module } from '@nestjs/common';
import { BusyScheduleService } from './busy-schedule.service';
import { BusyScheduleController } from './busy-schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
    imports: [PrismaModule, NotificationModule],
    controllers: [BusyScheduleController],
    providers: [BusyScheduleService],
})
export class BusyScheduleModule { }
