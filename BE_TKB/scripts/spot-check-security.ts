/**
 * Kiem nhanh vai o chua tick trong lo trinh, bang cach goi that chu khong doc code.
 */
import '../src/load-env';
import Redis from 'ioredis';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

const PORT = 4134;
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);

  // 0.1 — khong token thi bi chan
  const noToken = await fetch(`${BASE}/users`);
  console.log(`0.1  GET /users khong token        -> ${noToken.status} (mong doi 401)`);

  // 0.1 — /auth/captcha khong can token
  const captchaRes = await fetch(`${BASE}/auth/captcha`, { method: 'POST' });
  console.log(`0.1  POST /auth/captcha khong token -> ${captchaRes.status} (mong doi 200/201)`);
  const captcha: any = await captchaRes.json();

  // 0.5 — captcha dung roi thi khong dung lai duoc
  const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });
  const code = await redis.get(`captcha:${captcha.sessionId}`);
  const ttl = await redis.ttl(`captcha:${captcha.sessionId}`);
  console.log(`0.5  Captcha nam trong Redis, TTL   -> ${ttl}s`);

  const body = (extra: any = {}) => JSON.stringify({ username: 'admin', password: 'sai-mat-khau', captchaCode: code, captchaSessionId: captcha.sessionId, ...extra });
  const first = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() });
  const firstMsg = (await first.json()).message;
  const second = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() });
  const secondMsg = (await second.json()).message;
  console.log(`0.5  Lan 1 (mat khau sai)           -> ${first.status}: ${firstMsg}`);
  console.log(`0.5  Lan 2 dung lai captcha cu      -> ${second.status}: ${secondMsg} (phai la loi captcha)`);
  await redis.quit();

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
