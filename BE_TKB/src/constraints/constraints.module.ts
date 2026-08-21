import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConstraintConfigController } from './constraint-config.controller';
import { ConstraintSettingsService } from './constraint-settings.service';
import { FixedPeriodRuleController } from './fixed-period-rule.controller';

@Module({
    imports: [PrismaModule],
    controllers: [ConstraintConfigController, FixedPeriodRuleController],
    providers: [ConstraintSettingsService],
    exports: [ConstraintSettingsService],
})
export class ConstraintsModule { }
