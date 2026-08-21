import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConstraintConfigController } from './constraint-config.controller';
import { ConstraintSettingsService } from './constraint-settings.service';
import { FixedPeriodRuleController } from './fixed-period-rule.controller';

// No AuthModule import: the global guard in app.module protects every route, and
// @Roles('ADMIN') on the controller decides who gets through.
@Module({
    imports: [PrismaModule],
    controllers: [ConstraintConfigController, FixedPeriodRuleController],
    providers: [ConstraintSettingsService],
    exports: [ConstraintSettingsService],
})
export class ConstraintsModule { }
