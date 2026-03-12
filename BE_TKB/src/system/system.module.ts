
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemController } from './system.controller';
import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';

@Module({
    imports: [PrismaModule],
    controllers: [SystemController],
    providers: [AcademicYearService, SemesterService],
    exports: [AcademicYearService, SemesterService]
})
export class SystemModule { }
