
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AssignmentsController],
    providers: [AssignmentsService],
    exports: [AssignmentsService]
})
export class AssignmentsModule { }
