/**
 * Dang nhap that bang mot tai khoan giao vien vua tao, roi goi dung nhung duong ma man hinh
 * giao vien goi. Ghi duoc vao bang khong co nghia la dang nhap duoc.
 */
import '../src/load-env';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

const PORT = 4131;
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);

  const csv = path.join(__dirname, '..', '..', 'tai-khoan-giao-vien.csv');
  const rows = fs.readFileSync(csv, 'utf8').trim().split('\n').slice(1);
  const [, name, username, password] = rows[0].split(',');
  console.log(`Thu dang nhap: ${username} (${name})`);

  // Dang nhap that co captcha. Kich ban khong doc duoc anh, nhung no chay tren cung may
  // nen lay duoc chuoi dung tu Redis — van di qua dung phep kiem captcha cua he thong,
  // khong bo qua buoc nao.
  const captcha: any = await (await fetch(`${BASE}/auth/captcha`, { method: 'POST' })).json();
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 2,
  });
  const code = await redis.get(`captcha:${captcha.sessionId}`);
  await redis.quit();
  console.log(`0. POST /auth/captcha -> co ma, doc duoc chuoi dung`);

  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaCode: code, captchaSessionId: captcha.sessionId }),
  });
  const body: any = await login.json();
  console.log(`1. POST /auth/login -> ${login.status}, co token=${Boolean(body.access_token)}`);
  if (!body.access_token) {
    console.log('   ', JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${body.access_token}` };

  const profile: any = await (await fetch(`${BASE}/auth/profile`, { headers })).json();
  const teacherId = profile.teacherId ?? profile.teacher_profile?.id;
  console.log(`2. GET /auth/profile -> ho so giao vien = ${teacherId ?? 'KHONG CO'}`);

  // Duong ma trang "Doi tiet" cua giao vien goi dau tien
  const years: any = await (await fetch(`${BASE}/system/years`, { headers })).json();
  const semester = years.flatMap((y: any) => y.semesters ?? [])[0];
  const result: any = await (await fetch(`${BASE}/algorithm/result/${semester.id}`, { headers })).json();
  const mine = (result.bestSchedule ?? []).filter((s: any) => s.teacherId === teacherId);
  console.log(`3. GET /algorithm/result -> ${mine.length} tiet cua chinh minh`);

  if (mine.length > 0) {
    const suggest = await fetch(`${BASE}/doi-tiet/goi-y/${mine[0].id}`, { headers });
    const options: any = await suggest.json();
    console.log(`4. GET /doi-tiet/goi-y -> ${suggest.status}, ${Array.isArray(options) ? options.length : 0} phuong an doi tiet`);
  }

  const swaps = await fetch(`${BASE}/doi-tiet?semesterId=${semester.id}`, { headers });
  console.log(`5. GET /doi-tiet -> ${swaps.status}, ${(await swaps.json()).length} yeu cau`);

  const notifications = await fetch(`${BASE}/notifications`, { headers });
  console.log(`6. GET /notifications -> ${notifications.status}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
