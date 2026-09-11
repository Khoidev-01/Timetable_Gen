/**
 * Do lai thoi gian tra loi cho cau hoi cua mot giao vien dang ban, qua HTTP that.
 * Tai khoan giao vien duoc tao tam roi xoa.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4126;

async function ask(token: string, question: string) {
  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  const text = await res.text();
  const steps = [...text.matchAll(/^event: step\ndata: (.+)$/gm)].map((m) => JSON.parse(m[1]));
  const answerLine = text.match(/^event: answer\ndata: (.+)$/m);
  const seconds = (Date.now() - started) / 1000;

  console.log(`\nHOI: ${question}`);
  console.log(`  ${seconds.toFixed(1)}s · ${steps.length} luot goi cong cu: ${steps.map((s: any) => s.tool).join(' -> ')}`);
  if (answerLine) console.log('  TRA LOI:\n' + JSON.parse(answerLine[1]).answer.split('\n').map((l: string) => '    ' + l).join('\n'));
  return seconds;
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const temporary: string[] = [];

  try {
    const timetable = await prisma.generatedTimetable.findFirst({ where: { is_official: true }, orderBy: { created_at: 'desc' } });
    const slot = (await prisma.timetableSlot.findMany({ where: { timetable_id: timetable!.id, is_locked: false }, take: 1 }))[0];
    const teacher = await prisma.teacher.findUnique({ where: { id: slot.teacher_id } });

    const account = await prisma.user.create({
      data: { username: 'kiem-tra-tro-ly', password_hash: 'x', role: 'TEACHER', teacher_profile_id: teacher!.id },
    });
    temporary.push(account.id);
    const token = jwt.sign({ sub: account.id, username: account.username, role: 'TEACHER' });

    const DAY = ['', '', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'][slot.day];
    console.log(`Tiet ban: ${DAY} tiet ${slot.period}`);

    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      runs.push(await ask(token, `${DAY} tiết ${slot.period} tôi có việc bận, tiết đó tôi đổi với ai được?`));
    }
    console.log(`\nBa lan chay: ${runs.map((r) => r.toFixed(1) + 's').join(' · ')} — trung vi ${[...runs].sort((a, b) => a - b)[1].toFixed(1)}s`);
  } finally {
    await prisma.notification.deleteMany({ where: { user_id: { in: temporary } } });
    await prisma.user.deleteMany({ where: { id: { in: temporary } } });
    console.log('(Da xoa tai khoan tam.)');
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
