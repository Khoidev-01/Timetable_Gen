import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConstraintConfigController } from './constraint-config.controller';

@Module({
    imports: [AuthModule],
    controllers: [ConstraintConfigController],
})
export class ConstraintsModule { }
