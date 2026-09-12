import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4133;

async function ask(token: string, question: string) {
  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  const text = await res.text();
  const steps = [...text.matchAll(/^event: step\ndata: (.+)$/gm)].map((m) => JSON.parse(m[1]));
  const answer = text.match(/^event: answer\ndata: (.+)$/m);
  console.log(`\nHOI: ${question}`);
  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s · ${steps.map((s: any) => s.tool).join(' -> ') || '(khong goi cong cu)'}`);
  if (answer) console.log('  ' + JSON.parse(answer[1]).answer.split('\n').map((l: string) => '  ' + l).join('\n'));
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = jwt.sign({ sub: admin!.id, username: admin!.username, role: admin!.role });

  await ask(token, 'Giáo viên chủ nhiệm được giảm bao nhiêu tiết một tuần, căn cứ văn bản nào?');
  await ask(token, 'Chào cờ có tính vào định mức tiết dạy không?');
  await ask(token, 'Hệ thống có quy định gì về mức lương giáo viên không?');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
