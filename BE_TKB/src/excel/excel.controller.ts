import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Express } from 'express';
import { memoryStorage } from 'multer';
import { ExcelService } from './excel.service';
import { buildAttachmentDisposition } from './excel.utils';

@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Get('workbook/template/:academicYearId')
  async downloadTemplate(@Param('academicYearId') academicYearId: string, @Res() res: Response) {
    const payload = await this.excelService.downloadTemplate(academicYearId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildAttachmentDisposition(payload.fileName),
      'Content-Length': payload.buffer.length,
    });
    res.end(payload.buffer);
  }

  @Get('workbook/export/:academicYearId')
  async exportWorkbook(@Param('academicYearId') academicYearId: string, @Res() res: Response) {
    const payload = await this.excelService.exportWorkbook(academicYearId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildAttachmentDisposition(payload.fileName),
      'Content-Length': payload.buffer.length,
    });
    res.end(payload.buffer);
  }

  @Post('workbook/import/:academicYearId')
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
  async importWorkbook(
    @Param('academicYearId') academicYearId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file?.buffer) {
      throw new BadRequestException('Thiếu file Excel để import.');
    }

    return this.excelService.importWorkbook(academicYearId, file.buffer);
  }
}
