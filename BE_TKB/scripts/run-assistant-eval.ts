import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AssistantEvalService } from '../src/ai/eval/assistant-eval.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const evaluation = app.get(AssistantEvalService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const report: any = await evaluation.run(semester!.id);

  // In cac con so truoc, va in ro rang. Lan truoc toi cat ca ban bao cao o 2000 ky tu roi
  // moi con so quan trong nam ngoai cho cat — chay mat nam muoi phut ma khong doc duoc gi.
  const results = report.results ?? [];
  const passed = results.filter((r: any) => r.passed).length;

  console.log('KET QUA:');
  console.log(`  Diem tong         ${passed}/${results.length}  (${Math.round((passed / results.length) * 100)}%)`);
  console.log(`  Chon dung cong cu ${report.toolAccuracy}%`);
  console.log(`  Cau tra loi dung  ${report.answerAccuracy}%`);
  console.log(`  Tu choi           ${report.refusalRate}%`);
  console.log(`  Do tre trung vi   ${(report.medianMs / 1000).toFixed(1)}s`);
  console.log('Theo nhom:');
  (report.groups ?? []).forEach((g: any) => console.log(`  ${g.group}: ${g.passed}/${g.total}`));

  const failures = results.filter((r: any) => !r.passed);
  console.log(`\nCau khong dat: ${failures.length}`);
  failures.forEach((f: any) => console.log(`  [${f.id}] ${f.question}\n      -> ${f.reason ?? f.note ?? ''}`));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
