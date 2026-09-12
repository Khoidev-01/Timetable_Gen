/**
 * Nam thuat toan tren cung mot bo du lieu, cung mot ngan sach.
 *
 * Bo giai dang chay o ban chinh la luyen kim mo phong. Tabu Search la mot thuat toan khac
 * han — no cam cac nuoc vua di de khong quay lai cho cu, thay vi nhan nuoc xau theo xac suat.
 * Neu mot thuat toan khac han ma cho ket qua tuong duong, thi con so dang co la gioi han cua
 * BAI TOAN chu khong phai gioi han cua mot cach lam.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BenchmarkService } from '../src/algorithm/benchmark.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const benchmark = app.get(BenchmarkService);
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });

  const report: any = await benchmark.run({
    semesterId: semester!.id,
    runs: Number(process.argv[2] ?? 5),
    iterations: Number(process.argv[3] ?? 60000),
  });

  console.log('Thuat toan          | diem tot nhat | trung binh | loi cung | thoi gian');
  console.log('--------------------|---------------|------------|----------|----------');
  const rows = report.results ?? report.solvers ?? [];
  for (const r of rows) {
    console.log(
      `${String(r.key ?? r.solver).padEnd(19)} | ${String(Math.round(r.best ?? r.bestScore ?? 0)).padStart(13)} | ` +
      `${String(Math.round(r.mean ?? r.averageScore ?? 0)).padStart(10)} | ` +
      `${String(r.hardViolations ?? r.bestHardViolations ?? '?').padStart(8)} | ` +
      `${((r.averageMs ?? r.meanMs ?? 0) / 1000).toFixed(1)}s`,
    );
  }
  if (rows.length === 0) console.log(JSON.stringify(report).slice(0, 800));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
