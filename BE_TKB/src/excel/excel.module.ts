import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ExcelController } from './excel.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
