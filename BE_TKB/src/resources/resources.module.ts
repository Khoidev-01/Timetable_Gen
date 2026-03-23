
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcesController } from './resources.controller';
import { TeacherAliasController } from './teacher-alias.controller';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';

@Module({
    imports: [PrismaModule],
    controllers: [ResourcesController, TeacherAliasController],
    providers: [RoomService, SubjectService, TeacherService],
    exports: [RoomService, SubjectService, TeacherService]
})
export class ResourcesModule { }
