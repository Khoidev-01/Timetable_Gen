
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationController } from './organization.controller';
import { ClassService } from './class.service';

@Module({
    imports: [PrismaModule],
    controllers: [OrganizationController],
    providers: [ClassService],
    exports: [ClassService]
})
export class OrganizationModule { }
