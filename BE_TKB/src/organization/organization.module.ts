
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationController } from './organization.controller';
import { ClassService } from './class.service';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [OrganizationController],
    providers: [ClassService],
    exports: [ClassService]
})
export class OrganizationModule { }
