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

  console.log(JSON.stringify(report.summary ?? report, null, 2).slice(0, 2000));
  const failures = (report.results ?? []).filter((r: any) => !r.passed);
  console.log(`\nCau khong dat: ${failures.length}`);
  failures.forEach((f: any) => console.log(`  [${f.id}] ${f.question}\n      -> ${f.reason ?? f.note ?? ''}`));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
