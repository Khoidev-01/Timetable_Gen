import { Module } from '@nestjs/common';
import { AutoAssignService } from './auto-assign.service';
import { AutoAssignController } from './auto-assign.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AutoAssignController],
  providers: [AutoAssignService],
})
export class AutoAssignModule {}
