import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4135;

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = jwt.sign({ sub: admin!.id, username: admin!.username, role: admin!.role });

  for (const question of [
    'Giáo viên chủ nhiệm được giảm mấy tiết một tuần?',
    'Thứ hai lớp 10C1 học những gì?',
  ]) {
    const res = await fetch(`http://127.0.0.1:${PORT}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question }),
    });
    const text = await res.text();
    const line = text.match(/^event: answer\ndata: (.+)$/m);
    const payload = line ? JSON.parse(line[1]) : {};
    const citations = payload.citations ?? [];

    console.log(`\nHOI: ${question}`);
    console.log(`  so trich dan gui ra: ${citations.length}`);
    citations.forEach((c: any) =>
      console.log(`   - [${c.source}${c.article ? ', ' + c.article : ''}] ${c.title} (${c.body.length} ky tu nguyen van)`),
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
