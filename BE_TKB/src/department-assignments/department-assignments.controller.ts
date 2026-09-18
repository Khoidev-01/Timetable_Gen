import { BadRequestException, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { buildAttachmentDisposition } from '../excel/excel.utils';
import { DepartmentAssignmentsService } from './department-assignments.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const userIdOf = (req: Request) => {
  const user = (req as any).user;
  return user?.sub ?? user?.id ?? '';
};

@ApiTags('Tổng hợp phân công')
@ApiBearerAuth('access-token')
@Controller('department-assignments')
export class DepartmentAssignmentsController {
  constructor(private readonly service: DepartmentAssignmentsService) {}

  // ---------------------------------------------------------------- to truong

  @Roles('TEACHER')
  @Get('mine')
  mine(@Req() req: Request) {
    return this.service.mine(userIdOf(req));
  }

  @Roles('TEACHER')
  @Get('mine/template')
  async template(@Req() req: Request, @Res() res: Response) {
    const { buffer, fileName } = await this.service.template(userIdOf(req));
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': buildAttachmentDisposition(fileName), 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Roles('TEACHER')
  @Post('mine/submit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(new BadRequestException('Chỉ nhận file .xlsx.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  submit(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Chưa chọn file.');
    // multer đọc tên file theo latin1; đổi lại để giữ dấu tiếng Việt
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.service.submit(userIdOf(req), fileName, file.buffer);
  }

  // ---------------------------------------------------------------- admin

  @Roles('ADMIN')
  @Get('overview')
  overview(@Query('yearId') yearId?: string) {
    return this.service.overview(yearId);
  }

  @Roles('ADMIN')
  @Post('consolidate')
  consolidate(@Query('yearId') yearId?: string) {
    return this.service.consolidate(yearId);
  }

  @Roles('ADMIN')
  @Post('auto-assign')
  autoAssign(@Req() req: Request, @Query('yearId') yearId?: string) {
    return this.service.autoAssign(userIdOf(req), yearId);
  }

  @Roles('ADMIN')
  @Get('consolidations/:id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.service.download(id);
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': buildAttachmentDisposition(fileName), 'Content-Length': buffer.length });
    res.end(buffer);
  }
}
