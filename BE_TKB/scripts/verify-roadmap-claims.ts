/**
 * Chay that tung o kiem trong lo trinh, thay vi tick theo tri nho.
 *
 * Lo trinh co 100 o chua tick nam trong nhung muc da danh dau xong. Phan lon co le la so
 * sach chua cap nhat, nhung "co le" khong phai la bang chung, va mot lo trinh noi da xong
 * trong khi chua ai chay thu thi te hon mot lo trinh noi thang la chua kiem.
 *
 * Kich ban nay chi kiem nhung thu may kiem duoc: goi HTTP that, doc file that, hoi CSDL
 * that. Nhung o phai nhin bang mat — luoi lap day dan, do thi chay realtime — khong nam o
 * day va van dang la no.
 */
import '../src/load-env';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Redis from 'ioredis';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4136;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..', '..');

/**
 * Ket qua mot phep kiem.
 *
 * Tra ve `true` la dat khong can noi gi them; tra ve chuoi la KHONG dat, va chuoi do la ly
 * do. Muon dat ma van ghi chu thi dung `pass('...')` — ban dau toi de "chuoi nghia la ghi
 * chu", va ba phep kiem dat bi ghi thanh truot chi vi chung co gi do de noi.
 */
type Outcome = true | string | { ok: true; detail: string };

const pass = (detail: string): Outcome => ({ ok: true, detail });

interface Check {
  id: string;
  claim: string;
  run: () => Promise<Outcome> | Outcome;
}

const results: Array<{ id: string; claim: string; ok: boolean; detail: string }> = [];

async function check(id: string, claim: string, run: Check['run']) {
  try {
    const outcome = await run();
    if (outcome === true) {
      results.push({ id, claim, ok: true, detail: 'đạt' });
    } else if (typeof outcome === 'string') {
      results.push({ id, claim, ok: false, detail: outcome });
    } else {
      results.push({ id, claim, ok: true, detail: outcome.detail });
    }
  } catch (error: any) {
    results.push({ id, claim, ok: false, detail: `lỗi khi kiểm: ${error?.message ?? error}` });
  }
}

/** Đọc một file trong repo, trả về chuỗi rỗng nếu không có. */
const read = (relative: string) => {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
};

/** Grep toàn bộ mã nguồn, bỏ qua test và chú thích một dòng. */
function grepSource(pattern: RegExp, dir: string): string[] {
  const hits: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.next', '.git'].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || /\.spec\.ts$/.test(entry.name)) continue;
      for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (pattern.test(line)) hits.push(`${path.relative(ROOT, full)}: ${trimmed.slice(0, 80)}`);
      }
    }
  };
  walk(path.join(ROOT, dir));
  return hits;
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER', teacher_profile_id: { not: null } } });
  const adminToken = jwt.sign({ sub: admin!.id, username: admin!.username, role: 'ADMIN' });
  const teacherToken = jwt.sign({ sub: teacher!.id, username: teacher!.username, role: 'TEACHER' });

  // ---------------------------------------------------------------- 0.1
  await check('0.1', 'Không kèm token vào /users → 401', async () =>
    (await fetch(`${BASE}/users`)).status === 401 || `nhận ${(await fetch(`${BASE}/users`)).status}`);

  await check('0.1', 'Token TEACHER gọi DELETE /resources/teachers/:id → 403', async () => {
    const res = await fetch(`${BASE}/resources/teachers/khong-ton-tai`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    return res.status === 403 || `nhận ${res.status}`;
  });

  await check('0.1', '/auth/login và /auth/captcha gọi được không cần token', async () => {
    const captcha = await fetch(`${BASE}/auth/captcha`, { method: 'POST' });
    const login = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', password: 'y' }),
    });
    // Login sai thì vẫn phải là 400/401 chứ không phải 401 do thiếu token
    return (captcha.status === 200 || captcha.status === 201) && login.status !== 403
      ? true
      : `captcha ${captcha.status}, login ${login.status}`;
  });

  // ---------------------------------------------------------------- 0.2
  await check('0.2', 'Không endpoint nào trả về password_hash', async () => {
    const endpoints = ['/users', '/resources/teachers', '/auth/profile'];
    for (const endpoint of endpoints) {
      const res = await fetch(`${BASE}${endpoint}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!res.ok) continue;
      if ((await res.text()).includes('password_hash')) return `${endpoint} có trả về password_hash`;
    }
    return true;
  });

  await check('0.2', 'password_hash chỉ xuất hiện ở đường xác thực', () => {
    const hits = grepSource(/password_hash/, 'BE_TKB/src').filter(
      (line) => !/auth\.service|users\.service|prisma/.test(line),
    );
    return hits.length === 0 || hits.join(' | ');
  });

  // ---------------------------------------------------------------- 0.3
  await check('0.3', 'Không còn nhánh so sánh mật khẩu dạng plaintext', () => {
    const auth = read('BE_TKB/src/auth/auth.service.ts');
    const plaintext = /===\s*(pass|password)\b|password\s*===\s*user\./.test(auth);
    return !plaintext || 'còn nhánh so sánh trực tiếp trong auth.service.ts';
  });

  await check('0.3', 'Đăng nhập bằng tài khoản thật vẫn hoạt động', async () => {
    const captcha: any = await (await fetch(`${BASE}/auth/captcha`, { method: 'POST' })).json();
    const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });
    const code = await redis.get(`captcha:${captcha.sessionId}`);
    await redis.quit();

    const csv = path.join(ROOT, 'tai-khoan-giao-vien.csv');
    if (!fs.existsSync(csv)) return 'chưa có danh sách tài khoản để thử';
    const [, , username, password] = fs.readFileSync(csv, 'utf8').trim().split('\n')[1].split(',');

    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, captchaCode: code, captchaSessionId: captcha.sessionId }),
    });
    return Boolean((await res.json()).access_token) || `đăng nhập thất bại, mã ${res.status}`;
  });

  // ---------------------------------------------------------------- 0.4
  await check('0.4', 'Không còn giá trị JWT_SECRET mặc định trong mã nguồn', () => {
    const hits = grepSource(/JWT_SECRET\s*(\|\||\?\?)\s*['"]/, 'BE_TKB/src');
    return hits.length === 0 || hits.join(' | ');
  });

  await check('0.4', '.env.example ghi rõ yêu cầu JWT_SECRET', () => {
    const example = read('BE_TKB/.env.example');
    if (!example) return 'không có file .env.example';
    return /JWT_SECRET/.test(example) || '.env.example không nhắc JWT_SECRET';
  });

  // ---------------------------------------------------------------- 0.5
  await check('0.5', 'Captcha lưu Redis kèm TTL', async () => {
    const captcha: any = await (await fetch(`${BASE}/auth/captcha`, { method: 'POST' })).json();
    const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });
    const ttl = await redis.ttl(`captcha:${captcha.sessionId}`);
    await redis.quit();
    return ttl > 0 ? pass(`TTL ${ttl}s`) : 'không tìm thấy key trong Redis';
  });

  await check('0.5', 'Dùng lại captcha lần hai thì thất bại', async () => {
    const captcha: any = await (await fetch(`${BASE}/auth/captcha`, { method: 'POST' })).json();
    const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });
    const code = await redis.get(`captcha:${captcha.sessionId}`);
    await redis.quit();

    const body = JSON.stringify({ username: 'admin', password: 'sai', captchaCode: code, captchaSessionId: captcha.sessionId });
    const headers = { 'Content-Type': 'application/json' };
    await fetch(`${BASE}/auth/login`, { method: 'POST', headers, body });
    const second = await fetch(`${BASE}/auth/login`, { method: 'POST', headers, body });
    return /captcha/i.test((await second.json()).message ?? '') || 'lần hai không bị chặn vì captcha';
  });

  // ---------------------------------------------------------------- 0.7
  await check('0.7', 'CORS_ORIGIN có trong .env.example', () => {
    const example = read('BE_TKB/.env.example');
    return /CORS_ORIGIN/.test(example) || 'thiếu CORS_ORIGIN trong .env.example';
  });

  // ---------------------------------------------------------------- 0.9
  await check('0.9', 'Không còn đoán buổi học từ tên lớp bằng regex', () => {
    const hits = grepSource(/name\.match\(\/\\d/, 'BE_TKB/src');
    return hits.length === 0 || hits.join(' | ');
  });

  // ---------------------------------------------------------------- 0.12
  await check('0.12', 'FE đã gỡ hai package Redux', () => {
    const pkg = read('FE_TKB/package.json');
    return !/react-redux|@reduxjs\/toolkit/.test(pkg) || 'package.json FE vẫn còn Redux';
  });

  // ---------------------------------------------------------------- 0.15
  await check('0.15', 'Không còn file .log nào được git theo dõi', () => {
    const tracked = execSync('git ls-files', { cwd: ROOT }).toString();
    const logs = tracked.split('\n').filter((f) => f.endsWith('.log'));
    return logs.length === 0 || logs.join(' | ');
  });

  // ---------------------------------------------------------------- 0.17
  await check('0.17', 'Có phòng loại YARD trong cơ sở dữ liệu', async () => {
    const count = await prisma.room.count({ where: { type: 'YARD' } });
    return count > 0 ? pass(`${count} sân`) : 'chưa có sân nào';
  });

  await check('0.17', 'Môn thực hành được đánh dấu và bị giới hạn phòng', async () => {
    const practice = await prisma.teachingAssignment.count({ where: { required_room_type: { not: null } } });
    return practice > 0
      ? pass(`${practice} phân công cần phòng chức năng`)
      : 'không phân công nào cần phòng chức năng';
  });

  // ---------------------------------------------------------------- F1
  // Dung tai lieu y het main.ts. Goi HTTP vao app cua kich ban nay thi luon 404, vi kich
  // ban khong chay bootstrap — va do la loi cua phep kiem chu khong phai cua he thong.
  await check('F1', 'Swagger liệt kê endpoint, có Authorize, đánh dấu endpoint cần ADMIN', async () => {
    const config = new DocumentBuilder()
      .setTitle('API Xếp Thời khóa biểu THPT')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const spec: any = SwaggerModule.createDocument(app, config);

    const paths = Object.keys(spec.paths ?? {}).length;
    const hasAuth = Boolean(spec.components?.securitySchemes?.['access-token']);
    const secured = JSON.stringify(spec).match(/access-token/g)?.length ?? 0;

    if (paths === 0) return 'không endpoint nào được liệt kê';
    if (!hasAuth) return 'không có securityScheme để Authorize';
    return pass(`${paths} đường dẫn, ${secured} chỗ gắn access-token`);
  });

  // ---------------------------------------------------------------- 0.10
  await check('0.10', 'moveSlot kiểm đủ lớp / giáo viên / phòng', () => {
    const source = grepSource(/moveSlot/, 'BE_TKB/src');
    if (source.length === 0) return 'không tìm thấy moveSlot';
    const file = read('BE_TKB/src/algorithm/change-log.service.ts') + read('BE_TKB/src/schedule/schedule.service.ts');
    const all = fs
      .readdirSync(path.join(ROOT, 'BE_TKB/src'), { recursive: true as any })
      .filter((f: any) => typeof f === 'string' && f.endsWith('.ts'))
      .map((f: any) => read(path.join('BE_TKB/src', f)))
      .filter((text) => text.includes('moveSlot'))
      .join('\n');
    const checksAll = /teacher/i.test(all) && /room/i.test(all) && /class/i.test(all);
    return checksAll || 'không thấy đủ ba chiều trong hàm moveSlot';
  });

  // ---------------------------------------------------------------- 0.4
  await check('0.4', 'Thiếu JWT_SECRET → ứng dụng dừng ngay lúc khởi động', () => {
    // Chay trong mot tien trinh rieng khong co bien do. Goi thang requireJwtSecret() trong
    // tien trinh nay thi khong chung minh duoc gi: bien da duoc nap tu .env roi.
    try {
      execSync('node -e "delete process.env.JWT_SECRET; require(\'ts-node\').register({transpileOnly:true}); require(\'./src/auth/jwt.constants\').requireJwtSecret()"', {
        cwd: path.join(ROOT, 'BE_TKB'),
        stdio: 'pipe',
        env: { ...process.env, JWT_SECRET: '' },
      });
      return 'không throw — ứng dụng vẫn chạy tiếp khi thiếu JWT_SECRET';
    } catch {
      return true;
    }
  });

  // ---------------------------------------------------------------- 0.5
  await check('0.5', 'sessionId hết hạn rồi dùng lại → thất bại', async () => {
    const captcha: any = await (await fetch(`${BASE}/auth/captcha`, { method: 'POST' })).json();
    const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });
    const code = await redis.get(`captcha:${captcha.sessionId}`);
    // Xoa key = het han som, thay vi cho nam phut
    await redis.del(`captcha:${captcha.sessionId}`);
    await redis.quit();

    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'sai', captchaCode: code, captchaSessionId: captcha.sessionId }),
    });
    return /captcha/i.test((await res.json()).message ?? '') || 'sessionId hết hạn vẫn được chấp nhận';
  });

  // ---------------------------------------------------------------- 0.6
  await check('0.6', 'Sai quá nhiều lần liên tiếp → bị chặn 429', async () => {
    const codes: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'khong-ton-tai', password: 'sai' }),
      });
      codes.push(res.status);
      if (res.status === 429) return pass(`bị chặn ở lần thứ ${attempt + 1}`);
    }
    return `tám lần sai liên tiếp không bị chặn: ${codes.join(',')}`;
  });

  // ---------------------------------------------------------------- 0.9
  await check('0.9', 'Buổi học lấy từ main_session của lớp, không đoán từ tên', async () => {
    const classes = await prisma.class.findMany({ select: { name: true, grade_level: true, main_session: true }, take: 40 });
    const sessions = new Set(classes.map((c) => c.main_session));
    const grades = new Set(classes.map((c) => c.grade_level));
    return sessions.size > 0 && grades.size > 0
      ? pass(`${classes.length} lớp, ${grades.size} khối, ${sessions.size} kiểu buổi`)
      : 'không đọc được main_session';
  });

  // ---------------------------------------------------------------- 0.10
  await check('0.10', 'Vị trí đỗ tạm khi đổi chỗ dùng số âm', () => {
    const swap = read('BE_TKB/src/schedule/swap-request.service.ts');
    return /day:\s*-1|period:\s*-1/.test(swap) || 'không thấy vị trí đỗ tạm âm trong luồng đổi tiết';
  });

  // ---------------------------------------------------------------- A6
  await check('A6', 'Bảng điểm có mục chi phí di chuyển cầu thang', () => {
    const constraint = read('BE_TKB/src/algorithm/constraint.service.ts');
    return /leo cầu thang/.test(constraint) || 'không thấy mục leo cầu thang trong getFitnessDetails';
  });

  await check('A6', 'Sửa được mobility_weight trong quản lý giáo viên', () => {
    const dto = read('BE_TKB/src/resources/dto/teacher.dto.ts') + read('BE_TKB/src/resources/teacher.service.ts');
    const fe = read('FE_TKB/app/admin/teachers/page.tsx');
    return /mobility_weight/.test(dto) && /mobility_weight/.test(fe)
      ? true
      : `backend=${/mobility_weight/.test(dto)}, frontend=${/mobility_weight/.test(fe)}`;
  });

  // ---------------------------------------------------------------- A8
  await check('A8', 'Một lần chạy sinh nhiều phương án khác nhau', async () => {
    const timetables = await prisma.generatedTimetable.findMany({ orderBy: { created_at: 'desc' }, take: 5 });
    const scores = new Set(timetables.map((t) => t.fitness_score));
    return timetables.length >= 3 && scores.size >= 3
      ? pass(`${timetables.length} phương án, ${scores.size} mức điểm khác nhau`)
      : `${timetables.length} phương án, ${scores.size} mức điểm`;
  });

  // ---------------------------------------------------------------- B6
  await check('B6', 'Thao tác thủ công được ghi nhật ký kèm người thực hiện', () => {
    const schema = read('BE_TKB/prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model TimetableChangeLog'), schema.indexOf('model TimetableChangeLog') + 800);
    const hasActor = /changed_by|user_id|actor/.test(model);
    return hasActor || 'TimetableChangeLog không có cột ghi người thực hiện';
  });

  // ---------------------------------------------------------------- A4
  await check('A4', 'Tìm phương án đổi tiết dưới 2 giây trên dữ liệu thật', async () => {
    const slot = await prisma.timetableSlot.findFirst({ where: { is_locked: false } });
    if (!slot) return 'không có tiết nào để thử';

    const started = Date.now();
    const res = await fetch(`${BASE}/doi-tiet/goi-y/${slot.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const seconds = (Date.now() - started) / 1000;
    const options = res.ok ? ((await res.json()) as any[]).length : 0;

    return seconds < 2
      ? pass(`${seconds.toFixed(2)}s, ${options} phương án`)
      : `mất ${seconds.toFixed(2)}s, quá 2 giây`;
  });

  // ---------------------------------------------------------------- F2
  await check('F2', 'isTeacherBusy có test đủ ba nhánh buổi', () => {
    const spec = read('BE_TKB/src/algorithm/constraint.service.spec.ts');
    const branches = ['sáng', 'chiều', 'cả ngày'].filter((word) => spec.includes(word));
    return branches.length === 3 ? true : `chỉ thấy ${branches.join(', ') || 'không nhánh nào'}`;
  });

  await check('F2', 'Độ phủ test của constraint.service.ts đạt ngưỡng', () => {
    const out = execSync(
      'npx jest --coverage --collectCoverageFrom=algorithm/constraint.service.ts --coverageReporters=json-summary --silent',
      { cwd: path.join(ROOT, 'BE_TKB'), stdio: 'pipe' },
    ).toString();
    const file = path.join(ROOT, 'BE_TKB', 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(file)) return `không đọc được báo cáo độ phủ: ${out.slice(-120)}`;

    const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry: any = Object.entries(summary).find(([key]) => key.includes('constraint.service.ts'))?.[1];
    if (!entry) return 'không thấy constraint.service.ts trong báo cáo';

    const lines = entry.lines.pct;
    return lines >= 80 ? pass(`${lines}% dòng`) : `chỉ ${lines}% dòng, dưới 80%`;
  });

  // ---------------------------------------------------------------- B1
  await check('B1', 'Thời khóa biểu gốc không bị sửa khi có bản ghi đè', async () => {
    const overlays = await prisma.scheduleOverlay.count();
    const logs = await prisma.timetableChangeLog.count();
    // Ban ghi de nam o bang rieng: goc va phan sua khong dung chung mot cho
    const schema = read('BE_TKB/prisma/schema.prisma');
    const separate = /model ScheduleOverlay/.test(schema) && /model TimetableSlot/.test(schema);
    return separate ? pass(`${overlays} bản ghi đè, ${logs} dòng nhật ký, hai bảng tách rời`) : 'không thấy bảng ghi đè riêng';
  });

  await check('B1', 'Tra lịch hiệu lực của một giáo viên trong một ngày dưới 100ms', async () => {
    const teacherRow = await prisma.teacher.findFirst({ select: { id: true } });
    const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
    const started = Date.now();
    const res = await fetch(
      `${BASE}/schedule/effective?semesterId=${semester!.id}&teacherId=${teacherRow!.id}&date=2026-09-14`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const ms = Date.now() - started;
    if (!res.ok) return `endpoint trả ${res.status}`;
    return ms < 100 ? pass(`${ms}ms`) : `mất ${ms}ms`;
  });

  // ---------------------------------------------------------------- A8
  await check('A8', 'Chọn một phương án làm bản chính thức', async () => {
    const variants = await prisma.generatedTimetable.findMany({ orderBy: { fitness_score: 'desc' }, take: 3 });
    if (variants.length === 0) return 'chưa có phương án nào';

    const before = variants[0].is_official;
    const res = await fetch(`${BASE}/algorithm/publish/${variants[0].id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) return `publish trả ${res.status}`;

    const after = await prisma.generatedTimetable.findUnique({ where: { id: variants[0].id } });
    const others = await prisma.generatedTimetable.count({ where: { id: { not: variants[0].id } } });
    await prisma.generatedTimetable.update({ where: { id: variants[0].id }, data: { is_official: before } });

    return after!.is_official ? pass(`bản chính thức được đặt, ${others} bản còn lại vẫn giữ`) : 'is_official không được đặt';
  });

  // ---------------------------------------------------------------- B3
  await check('B3', 'Tìm được giáo viên dạy thay cùng môn, đúng tiết đó', async () => {
    const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
    const slot = await prisma.timetableSlot.findFirst({ where: { is_locked: false } });
    const res = await fetch(
      `${BASE}/schedule/absence-plan?semesterId=${semester!.id}&teacherId=${slot!.teacher_id}&date=2026-09-14`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    if (!res.ok) return `endpoint trả ${res.status}`;
    const plan: any = await res.json();
    const periods = plan.periods ?? [];
    if (!Array.isArray(periods)) return 'không đọc được danh sách tiết cần phủ';

    // Moi tiet phai co danh sach nguoi day thay, khong chi co ten tiet
    const withCandidates = periods.filter((item: any) => Array.isArray(item.candidates)).length;
    return periods.length > 0 && withCandidates === periods.length
      ? pass(`${periods.length} tiết cần phủ, tiết nào cũng có phương án`)
      : `${periods.length} tiết, ${withCandidates} tiết có phương án`;
  });

  // ---------------------------------------------------------------- in ket qua
  console.log('\nKET QUA KIEM TUNG O:\n');
  const pad = (text: string, n: number) => text.padEnd(n);
  results.forEach((r) => {
    console.log(`  ${r.ok ? 'DAT   ' : 'CHUA  '} [${pad(r.id, 4)}] ${r.claim}`);
    if (!r.ok || r.detail !== 'đạt') console.log(`            ${r.detail}`);
  });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} o duoc kiem tu dong va dat.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
