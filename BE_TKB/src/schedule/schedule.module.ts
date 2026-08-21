import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { EffectiveScheduleService } from './effective-schedule.service';
import { ScheduleController } from './schedule.controller';
import { SubstituteService } from './substitute.service';
import { IcalService } from './ical.service';

@Module({
  imports: [PrismaModule, AlgorithmModule],
  controllers: [ScheduleController],
  providers: [EffectiveScheduleService, SubstituteService, IcalService],
  exports: [EffectiveScheduleService, SubstituteService, IcalService],
})
export class ScheduleModule {}
