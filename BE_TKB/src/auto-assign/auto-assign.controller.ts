import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AutoAssignService } from './auto-assign.service';
import { buildAttachmentDisposition } from '../excel/excel.utils';

@Controller('auto-assign')
export class AutoAssignController {
  constructor(private readonly autoAssignService: AutoAssignService) {}

  /** Tải mẫu Excel nhập danh sách GV đơn giản */
  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.autoAssignService.generateInputTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildAttachmentDisposition('mau-nhap-gv-phan-cong.xlsx'),
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Upload Excel GV + chạy thuật toán phân công tự động */
  @Post('generate/:yearId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(new BadRequestException('Chỉ hỗ trợ file .xlsx.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async generateAssignments(
    @Param('yearId') yearId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file?.buffer) {
      throw new BadRequestException('Thiếu file Excel.');
    }
    return this.autoAssignService.generateAssignments(yearId, file.buffer);
  }

  /** Xuất kết quả phân công ra Excel (dạng Phan_cong) */
  @Get('export/:yearId')
  async exportResult(@Param('yearId') yearId: string, @Res() res: Response) {
    const buffer = await this.autoAssignService.exportAssignmentResult(yearId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildAttachmentDisposition(`phan-cong-tu-dong.xlsx`),
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
