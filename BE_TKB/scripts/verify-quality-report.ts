import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
const PORT = 4141;
async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = jwt.sign({ sub: admin!.id, username: admin!.username, role: 'ADMIN' });
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });

  const data: any = await (await fetch(`http://127.0.0.1:${PORT}/algorithm/result/${semester!.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  console.log(`Diem: ${data.fitness_score}`);
  console.log(`Diem phat moi tiet: ${data.penaltyPerSlot}`);
  console.log(`Loi cung: ${data.hardViolations}`);
  console.log(`So tiet: ${data.bestSchedule?.length}`);
  console.log(`\nBang chi tiet (${(data.softBreakdown ?? []).length} dong):`);
  (data.softBreakdown ?? [])
    .sort((a: any, b: any) => b.count * b.weight - a.count * a.weight)
    .slice(0, 4)
    .forEach((item: any) => {
      const forced = item.floor ?? 0;
      console.log(`  ${item.label}: -${item.count * item.weight} diem, ${item.count} loi, sua duoc ${item.avoidable ?? item.count}${forced ? ` (${forced} bat kha khang)` : ''}`);
    });
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
