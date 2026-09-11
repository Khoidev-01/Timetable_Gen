import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeasibilityService } from '../src/algorithm/feasibility.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const feasibility = app.get(FeasibilityService);
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });

  const report: any = await feasibility.analyse(semester!.id);
  console.log(JSON.stringify(report, null, 2).slice(0, 4000));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
