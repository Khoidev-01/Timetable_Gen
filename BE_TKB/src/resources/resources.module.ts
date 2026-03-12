
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcesController } from './resources.controller';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';

@Module({
    imports: [PrismaModule],
    controllers: [ResourcesController],
    providers: [RoomService, SubjectService, TeacherService],
    exports: [RoomService, SubjectService, TeacherService]
})
export class ResourcesModule { }
