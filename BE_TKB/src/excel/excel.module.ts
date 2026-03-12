import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExcelController } from './excel.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
