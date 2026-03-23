import { Module } from '@nestjs/common';
import { ConstraintConfigController } from './constraint-config.controller';

@Module({
    controllers: [ConstraintConfigController],
})
export class ConstraintsModule { }
