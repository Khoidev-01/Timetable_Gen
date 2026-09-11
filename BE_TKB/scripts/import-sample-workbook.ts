/**
 * Nhap file du lieu mau qua dung duong import that cua he thong (ExcelService), khong phai
 * qua mot script rieng: neu duong nhap that co loi thi phai lo ra o day, chu khong phai lo
 * ra khi nguoi dung bam nut.
 */
import '../src/load-env';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExcelService } from '../src/excel/excel.service';
import { PrismaService } from '../src/prisma/prisma.service';

const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const excel = app.get(ExcelService);
  const prisma = app.get(PrismaService);

  const year = await prisma.academicYear.findFirst({ orderBy: { name: 'desc' } });
  console.log(`Nam hoc dich: "${year!.name}"`);

  const result = await excel.importWorkbook(year!.id, fs.readFileSync(SOURCE));

  console.log('\nKet qua nhap:');
  console.log(JSON.stringify(result.summary, null, 2));
  console.log(`\nCanh bao: ${result.warnings.length}`);
  result.warnings.slice(0, 15).forEach((w: any) => console.log(`  [${w.sheet ?? '-'}] ${w.message}`));
  if (result.warnings.length > 15) console.log(`  ... con ${result.warnings.length - 15} canh bao nua`);
  console.log(`Loi: ${result.errors.length}`);
  result.errors.forEach((e: any) => console.log(`  ${e.message}`));

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
