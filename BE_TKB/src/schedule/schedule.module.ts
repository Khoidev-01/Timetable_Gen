import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { EffectiveScheduleService } from './effective-schedule.service';
import { ScheduleController } from './schedule.controller';
import { SubstituteService } from './substitute.service';
import { IcalService } from './ical.service';
import { AbsenceLinkService } from './absence-link.service';
import { SwapRequestService } from './swap-request.service';
import { SwapRequestController } from './swap-request.controller';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, AlgorithmModule, NotificationModule],
  controllers: [ScheduleController, SwapRequestController],
  providers: [EffectiveScheduleService, SubstituteService, IcalService, AbsenceLinkService, SwapRequestService],
  exports: [EffectiveScheduleService, SubstituteService, IcalService, AbsenceLinkService, SwapRequestService],
})
export class ScheduleModule {}
