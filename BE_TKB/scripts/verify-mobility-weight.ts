import '../src/load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4137;

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  // Dung y het main.ts. Thieu dong nay thi moi rang buoc trong DTO deu khong chay, va ket
  // qua kiem noi ve kich ban chu khong noi ve he thong.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = jwt.sign({ sub: admin!.id, username: admin!.username, role: 'ADMIN' });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const teacher = await prisma.teacher.findFirst({ orderBy: { code: 'asc' } });
  const original = teacher!.mobility_weight;
  console.log(`${teacher!.code} ${teacher!.full_name}: he so hien tai = ${original}`);

  const res = await fetch(`http://127.0.0.1:${PORT}/resources/teachers/${teacher!.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ mobility_weight: 25 }),
  });
  console.log(`PUT mobility_weight=25 -> ${res.status}`);

  const after = await prisma.teacher.findUnique({ where: { id: teacher!.id } });
  console.log(`Doc lai tu CSDL: ${after!.mobility_weight} ${after!.mobility_weight === 25 ? '(dat)' : '(KHONG GHI DUOC)'}`);

  // Gia tri vo ly phai bi chan
  const bad = await fetch(`http://127.0.0.1:${PORT}/resources/teachers/${teacher!.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ mobility_weight: 99999 }),
  });
  console.log(`PUT mobility_weight=99999 -> ${bad.status} (mong doi 400)`);

  await prisma.teacher.update({ where: { id: teacher!.id }, data: { mobility_weight: original } });
  console.log(`Da tra ve ${original}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
