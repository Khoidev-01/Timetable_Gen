# IMPROVEMENTS BACKLOG

> Tổng hợp từ deep review code (algorithm + security). Đọc + fix theo thứ tự severity.
> Update: 2026-05-04. Trạng thái: chưa fix (trừ TS-1 đã fix).
>
> **Cảnh báo lớn**: production deploy tại `api.gettimetable.cloud` đang **public không auth** — khuyến nghị tắt domain hoặc đặt sau VPN/basic-auth proxy cho tới khi merge SEC-C1.

---

## Mục lục

- [Đã fix](#đã-fix)
- [Severity legend](#severity-legend)
- [Security issues](#security-issues)
- [Algorithm issues](#algorithm-issues)
- [Code quality / refactor](#code-quality--refactor)
- [Quick wins](#quick-wins)
- [Roadmap đề xuất](#roadmap-đề-xuất)

---

## Đã fix

| ID | Mô tả | Commit |
| :--- | :--- | :--- |
| TS-1 | Bỏ `baseUrl` deprecated trong `BE_TKB/tsconfig.json` (TS 7 ngừng hỗ trợ) | (chưa commit) |

---

## Severity legend

- 🔴 **CRITICAL**: data loss, leo quyền, lộ dữ liệu, deploy không an toàn. Fix NGAY.
- 🟠 **HIGH**: bug nghiệp vụ rõ ràng, performance issue lớn. Fix sớm.
- 🟡 **MEDIUM**: edge case, UX, kiến trúc. Fix khi có thời gian.
- 🟢 **LOW**: cleanup, magic number, dead code.

---

## Security issues

### 🔴 SEC-C1: Không có JWT guard nào — mọi endpoint public

**File**: tất cả controllers (trừ `auth.controller.ts`).
**Bằng chứng**: `grep -r "JwtAuthGuard|UseGuards|@Roles"` trả 0 match.

**Attack**:
```bash
curl https://api.gettimetable.cloud/users
# → list user + password_hash của tất cả admin/teacher
curl -X DELETE https://api.gettimetable.cloud/users/<id>
# → xóa user anonymous
curl -X POST https://api.gettimetable.cloud/algorithm/clear/<semesterId>
# → wipe TKB
```

**Fix**:
1. Tạo `src/auth/strategies/jwt.strategy.ts`:
   ```ts
   @Injectable()
   export class JwtStrategy extends PassportStrategy(Strategy) {
     constructor() {
       super({
         jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
         ignoreExpiration: false,
         secretOrKey: process.env.JWT_SECRET,
       });
     }
     async validate(payload: any) { return payload; }
   }
   ```
2. Tạo `src/auth/guards/jwt-auth.guard.ts` extends `AuthGuard('jwt')` + check decorator `@Public()`.
3. Đăng ký global trong `app.module.ts`:
   ```ts
   { provide: APP_GUARD, useClass: JwtAuthGuard }
   ```
4. Mark `/auth/captcha`, `/auth/login` bằng `@Public()`.
5. Test: `curl /users` → 401.

---

### 🔴 SEC-C2: Plain-text password fallback

**File**: `BE_TKB/src/auth/auth.service.ts:53-57`, `:108`.

```ts
if (!isMatch) {
  if (user.password_hash !== pass) return null;  // ← FALLBACK
}
```

**Attack**: DB dump → password lộ trực tiếp. Combined với default `'123456'` (`users.service.ts:26`) → leo quyền dễ.

**Fix**:
1. Migration: scan tất cả `users.password_hash` không phải bcrypt format (`$2[aby]$...`) → force reset.
2. Xóa fallback block.
3. Bỏ default `'123456'` trong `users.service.ts:26` — required field.

---

### 🔴 SEC-C3: Captcha replay vô hạn

**File**: `BE_TKB/src/auth/auth.service.ts:18-42`.

```ts
const hash = crypto.createHmac('sha256', SECRET).update(text).digest('hex');
return { img, sessionId: hash };
```

`sessionId = HMAC(text)` deterministic, không TTL, không one-time use.

**Attack**: Solve captcha 1 lần → cache (code, sessionId) → brute-force login forever.

**Fix**: Dùng Redis store với TTL:
```ts
import Redis from 'ioredis';
const redis = new Redis(...);

async createCaptcha() {
  const captcha = svgCaptcha.create({...});
  const id = crypto.randomUUID();
  await redis.setex(`cap:${id}`, 120, captcha.text.toLowerCase());
  return { img: captcha.data, sessionId: id };
}

async validateCaptcha(code: string, sessionId: string) {
  const stored = await redis.getdel(`cap:${sessionId}`);   // atomic get+delete
  return stored === code.toLowerCase();
}
```

---

### 🔴 SEC-C4: JWT_SECRET fallback hardcoded

**Files**:
- `BE_TKB/src/auth/auth.module.ts:14` → `'SECRET_KEY'`
- `BE_TKB/src/auth/auth.service.ts:11` → `'MY_CAPTCHA_SECRET_KEY'`
- `docker-compose.yml:45` → `'superscretkeytkb2024'`

**Attack**: Deploy không set env → forge JWT với secret biết trước → admin token.

**Fix**:
```ts
// main.ts hoặc một config module
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set, min 32 chars');
}
```
Bỏ `:-superscretkeytkb2024` trong `docker-compose.yml`. Bỏ `|| 'SECRET_KEY'` các nơi.

---

### 🔴 SEC-C5: Mass assignment ở mọi update endpoint

**Files**: 
- `BE_TKB/src/users/users.service.ts:33-45` (`prisma.user.update({ data: payload })`)
- `BE_TKB/src/resources/resources.controller.ts:32,38,45,51`
- `BE_TKB/src/system/system.controller.ts:24`
- `BE_TKB/src/organization/organization.controller.ts:12`
- Mọi controller dùng `@Body() body: any`.

**Attack**: 
```bash
curl -X PUT /users/<self> -d '{"role":"ADMIN","username":"admin"}'
# → leo quyền thành ADMIN
```

**Fix**: Thêm DTO + ValidationPipe whitelist:
```ts
// dto/update-user.dto.ts
export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @MinLength(8) password?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole; // chỉ admin được set
}

// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```
Tạo DTO cho mọi POST/PUT/PATCH endpoint. **Cấm spread `body` vào `prisma.update`**.

---

### 🔴 SEC-C6: Không check role + IDOR

**Files**: tất cả controller. `teacher-alias.controller.ts:33` đặc biệt nguy hiểm.

**Attack**: 
- Teacher A token → `PATCH /giao-vien/<teacherB-id>` → sửa lịch bận của teacher khác.
- Teacher → `POST /algorithm/start` → khởi chạy job admin.

**Fix**:
1. `RolesGuard` + decorator `@Roles(UserRole.ADMIN)`:
   ```ts
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(UserRole.ADMIN)
   @Delete('users/:id')
   deleteUser(@Param('id') id: string) { ... }
   ```
2. Self-route: kiểm `req.user.teacher_profile_id === param.id`:
   ```ts
   @Patch('giao-vien/:id')
   update(@Param('id') id: string, @CurrentUser() user) {
     if (user.role !== 'ADMIN' && user.teacher_profile_id !== id) {
       throw new ForbiddenException();
     }
   }
   ```

---

### 🟠 SEC-H1: CORS allow-all production

**File**: `BE_TKB/src/main.ts:9` → `app.enableCors()`.

**Fix**:
```ts
app.enableCors({
  origin: ['https://gettimetable.cloud'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
});
```

---

### 🟠 SEC-H2: ValidationPipe đăng ký nhưng vô dụng

**File**: `main.ts:8`. `@Body() body: any` khắp nơi → pipe không validate gì.
**Fix**: Đi cùng SEC-C5. Sau khi có DTO mới hoạt động.

---

### 🟠 SEC-H3: Không có rate limit

**Attack**: Brute force `/auth/login` không giới hạn.

**Fix**: `@nestjs/throttler`:
```ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
// auth.controller:
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Post('login')
```
Thêm account lockout: 5 fail → khóa 15 phút.

---

### 🟠 SEC-H4: Excel upload không validate MIME / magic byte / zip-bomb

**Files**: 
- `excel.controller.ts:49-55`
- `auto-assign.controller.ts:39-45`

**Attack**: Upload file zip-bomb 10MB → unzip 10GB → OOM.

**Fix**:
```ts
FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            && file.originalname.endsWith('.xlsx');
    cb(ok ? null : new BadRequestException('Invalid file type'), ok);
  }
})
// Thêm magic byte check sau khi nhận buffer:
if (buffer.subarray(0, 4).toString('hex') !== '504b0304') throw ...
// Cap unzip total size (limit ExcelJS hoặc dùng yauzl với maxSize).
```

---

### 🟠 SEC-H5: Notification IDOR

**File**: `notification.controller.ts:35`.

```ts
@Put(':id/read')
async markAsRead(@Param('id') id: string) {
  return this.notificationService.markAsRead(id);  // ← không check ownership
}
```

**Fix**:
```ts
async markAsRead(id: string, userId: string) {
  return this.prisma.notification.update({
    where: { id, user_id: userId },  // ← compound where (Prisma 5+ requires update with composite)
    data: { is_read: true },
  });
}
```

Bỏ default `role = user.role ?? 'ADMIN'` (line 12,18,29) → sau khi guard thì `req.user` luôn tồn tại.

---

### 🟠 SEC-H6: Change-password không invalidate JWT cũ

**File**: `auth.service.ts:100-119`. JWT 1d TTL → đổi password vẫn dùng được token cũ.

**Fix**:
1. Schema thêm `password_changed_at DateTime` ở `User`.
2. JWT payload include `iat` (mặc định có).
3. Strategy validate: reject nếu `iat * 1000 < user.password_changed_at`.

---

### 🟠 SEC-H7: Không có password reset flow

**Fix**: Tạo `/auth/forgot-password` (email link/OTP) + `/auth/reset-password`. Force change ở first login (column `must_change_password`).

---

### 🟠 SEC-H8: Constraint config global mutable không auth

**File**: `constraint-config.controller.ts:30,40`.
```ts
let constraintStore = [...DEFAULT_CONSTRAINTS];  // module-level mutable
```
Anyone disable HC_01 → algorithm produce TKB invalid.

**Fix**: 
1. Persist vào DB (`constraint_configs` table).
2. Admin-only.
3. Validate enum + weight range.
4. Hook vào `ConstraintService.calculatePenalty` thực sự (hiện tại chỉ UI placeholder).

---

### 🟡 SEC-M1: Thiếu helmet + security headers

**File**: `main.ts`.

**Fix**:
```bash
npm i helmet
```
```ts
import helmet from 'helmet';
app.use(helmet());
app.set('trust proxy', 1);
```

---

### 🟡 SEC-M2: Stack trace lộ ra response

**File**: `auth.controller.ts:51-53` rethrow `e.message`. Default Nest dev mode lộ stack.

**Fix**: Global exception filter:
```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(ex: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp().getResponse();
    const status = ex instanceof HttpException ? ex.getStatus() : 500;
    logger.error(ex);  // log server-side
    ctx.status(status).json({
      message: status === 500 ? 'Internal error' : ex.message,
    });
  }
}
app.useGlobalFilters(new AllExceptionsFilter());
```

---

### 🟡 SEC-M3: Cascade delete + không soft-delete

**File**: `schema.prisma`. Chỉ `Teacher → constraints` và `Timetable → slots` cascade. Còn lại default Restrict. User hard-delete → mất audit.

**Fix**: Add `deleted_at DateTime?` cho `User`, `Teacher`, `Class`, `TeachingAssignment`, `GeneratedTimetable`. Filter `deleted_at: null` trong mọi `findMany`.

---

### 🟡 SEC-M4: Token verify thủ công thay vì strategy

**File**: `auth.controller.ts:56-65` → `extractUser` gọi `jwtService.verify` inline.

**Fix**: Dùng `JwtStrategy` (xem SEC-C1) + `@CurrentUser()` decorator. Bỏ `extractUser`.

---

### 🟡 SEC-M5: ParseIntPipe / ParseUUIDPipe thiếu

**Files**: `resources.controller.ts:32` (`+id`), `auto-assign.controller.ts`, `excel.controller.ts`.

**Fix**: 
```ts
@Param('id', ParseIntPipe) id: number   // cho rooms/subjects
@Param('id', ParseUUIDPipe) id: string  // cho teacher/class/year/semester
```

---

### 🟢 SEC-L1: bcrypt rounds = 10

**Fix**: Tăng lên 12 cho 2026:
```ts
await bcrypt.hash(password, 12);
```

---

### 🟢 SEC-L2: DB password default trong compose

**File**: `docker-compose.yml:8` → `POSTGRES_PASSWORD:-changeme`.
**Fix**: Bỏ default. Fail-fast nếu env không set.

---

### 🟢 SEC-L3: `auto-assign` + `excel` route param không validate UUID

**Fix**: `@Param('id', ParseUUIDPipe)`.

---

## Algorithm issues

### 🔴 ALG-C1: Lock preservation tạo duplicate slots

**File**: `algorithm.service.ts:41-55, 932-963`.

Prev locked slots load vào `solution.slots` nhưng TKB cũ KHÔNG bị xóa. Sau Phase 3, save tạo TKB mới với slots locked → DB có 2 row cho cùng locked logical slot.

**Repro**:
1. Run alg lần 1 → TKB1 (gồm slot A, B, C).
2. Lock slot A.
3. Run alg lần 2 → TKB2 (chứa A, B', C', D'…).
4. DB: TKB1 còn nguyên (1 A) + TKB2 (1 A khác id).

**Fix**: Sau khi save TKB mới thành công, xóa TKB cũ (chỉ giữ `is_official`):
```ts
await prisma.$transaction([
  prisma.generatedTimetable.deleteMany({
    where: { semester_id, is_official: false },
  }),
  // ... create new
]);
```
Hoặc archive: thêm field `is_archived`, update thay vì delete.

---

### 🔴 ALG-C2: clearSchedule xóa hết kể cả `is_official` + `is_locked`

**File**: `algorithm.service.ts:1026-1031`.

```ts
async clearSchedule(semesterId: string) {
  await this.prisma.generatedTimetable.deleteMany({
    where: { semester_id: semesterId },
  });
}
```

**Fix**:
```ts
async clearSchedule(semesterId: string) {
  await this.prisma.generatedTimetable.deleteMany({
    where: { semester_id: semesterId, is_official: false },
  });
}
```
UI thêm confirmation modal "type CONFIRM to delete N timetables".

---

### 🔴 ALG-C3: Concurrency — 2 admin cùng bấm xếp lịch

**File**: `algorithm.producer.ts:19-45`.

Không lock per-semester. 2 jobs chạy song song trên cùng semester → kết quả non-deterministic, prev-lock load có thể đọc bản chưa xong.

**Fix**: BullMQ jobId de-dupe:
```ts
const job = await this.optimizationQueue.add(
  'optimize-schedule',
  { semesterId },
  { jobId: `optimize-${semesterId}` },  // ← dedupe
);
```
BullMQ refuse duplicate jobId. Ngoài ra direct fallback mode còn tệ hơn — nên chuyển luôn sang queue+worker, fail nếu Redis down.

---

### 🔴 ALG-C4: Save không transaction → header rỗng

**File**: `algorithm.service.ts:932-963`.

```ts
const timetable = await prisma.generatedTimetable.create({...});
// ↑ commit
const batch = await prisma.timetableSlot.createMany({...});
// ↑ nếu throw, header đã commit
```

**Fix**: Interactive transaction:
```ts
return prisma.$transaction(async (tx) => {
  const tt = await tx.generatedTimetable.create({...});
  await tx.timetableSlot.createMany({ data: slots.map(s => ({...s, timetable_id: tt.id})) });
  return tt;
});
```

---

### 🔴 ALG-C5: moveSlot dùng sentinel (0,0) nguy hiểm

**File**: `algorithm.service.ts:970-1014`.

Set `day=0, period=0` để né unique constraint. Nếu transaction crash giữa step 2-3 → slot kẹt ở (0,0) → lần sau move khác cũng vào (0,0) → unique violation.

**Fix**: Dùng số âm (-1,-1) khó collision hơn, **HOẶC** dùng deferred constraints (Postgres):
```sql
ALTER TABLE timetable_slots
  DROP CONSTRAINT unique_class_slot,
  ADD CONSTRAINT unique_class_slot UNIQUE (timetable_id, class_id, day, period)
    DEFERRABLE INITIALLY DEFERRED;
```
Khi transaction set DEFERRED, kiểm tra unique cuối transaction → không cần sentinel.

---

### 🟠 ALG-H1: Multi-restart vô dụng — `NUM_RESTARTS=1`

**File**: `algorithm.service.ts:62`.

**Fix**: 
1. Extract config:
   ```ts
   // algorithm.config.ts
   export const ALGO_CONFIG = {
     numRestarts: parseInt(process.env.ALGO_RESTARTS || '5'),
     phase3MaxRounds: 60,
     phase3InitialTemp: 50,
     phase3CoolingRate: 0.92,
     // ...
   };
   ```
2. Seed RNG riêng mỗi attempt (xem ALG-H7).

---

### 🟠 ALG-H3: Phase 2 trừ nhầm `alreadyAssigned` từ GVCN_TEACHING

**File**: `algorithm.service.ts:336-339`.

Phase 1 cấp slot GVCN_TEACHING với `subjectId = subj_chính_GVCN` (vd Toán). Phase 2 đếm:
```ts
let alreadyAssigned = 0;
for (const s of solution.slots) {
  if (s.classId === cls.id && s.subjectId === assign.subject_id) alreadyAssigned++;
}
```
→ trừ nhầm tiết Toán → THIẾU TIẾT Toán cho lớp.

**Fix**: Filter loại GVCN_TEACHING:
```ts
const isFixedFromPhase1 = (s) => s.isLocked && [
  'CHAO_CO', 'SHCN', 'SH_CUOI_TUAN', 'GVCN_TEACHING'
].includes(this.constraintService.getSubjectCode(s.subjectId));
// ↑ nhưng GVCN_TEACHING dùng môn chính nên check theo flag riêng
```
Hoặc: gắn marker `is_fixed_quota=true` vào slot để biết slot này KHÔNG count vào quota môn.

---

### 🟠 ALG-H4: slotCost ≠ fitness — optimize theo metric sai

**Files**: `algorithm.service.ts:slotCost (607-712)` vs `constraint.service.ts:checkHardConstraints (187-258)` + `calculatePenalty (246-257)`.

| | slotCost | fitness |
| :--- | :--- | :--- |
| Teacher conflict | +200 | +100 |
| Class conflict | +200 | +100 |
| Wrong session | +500 | +100 |
| Heavy subject | +500 | +100 |
| SC1 | +10 mỗi slot (n²) | +1 mỗi (subj,class) |
| SC4 | +30 | +10 |
| Room conflict | **MISSING** | +100 |

Phase 3 swap improve slotCost nhưng có thể giảm fitness.

**Fix**: Tách 1 hàm shared:
```ts
// algorithm/scoring.ts
export function calcSlotCost(slot, ctx, weights = DEFAULT_WEIGHTS) { ... }
export function calcFitness(slots, ctx) {
  return slots.reduce((sum, s, i) => sum + calcSlotCost(s, ctx), 0) / 2;
  // ÷2 vì mỗi conflict được count ở 2 slot
}
```
Đảm bảo monotonic: sum(slotCost) ↔ fitness có quan hệ tuyến tính.

---

### 🟠 ALG-H5: SA accept không track best-so-far

**File**: `algorithm.service.ts:789-803`.

SA accept worse → `roundImproved++` ngay cả khi fitness giảm. Không có rollback nếu xuống dốc xa.

**Fix**:
```ts
let bestFitness = currentFitness;
let bestSnapshot = slots.map(s => ({...s}));

// trong loop
if (currentFitness > bestFitness) {
  bestFitness = currentFitness;
  bestSnapshot = slots.map(s => ({...s}));
}

// cuối phase, restore
slots.length = 0;
slots.push(...bestSnapshot);
```

---

### 🟠 ALG-H6: slotCost không check room conflict

**File**: `algorithm.service.ts:607-712`.

doSwap đổi day/period giữ roomId. Nếu 2 slot khác class cùng phòng cố định, swap → room conflict mới.

**Fix**: Build `roomAt` index như `teacherAt`/`classAt`. Add cost trong slotCost:
```ts
if (s.roomId) {
  const rs = roomAt.get(`${s.roomId}-${s.day}-${s.period}`);
  if (rs && rs.size > 1) cost += 200;
}
```

---

### 🟠 ALG-H7: RNG không seeded — không reproduce được

**Files**: `Math.random()` ở `algorithm.service.ts:389, 417, 452-453, 513, 793, 924-928`, `greedy.solver.ts:31, 125, 138`.

**Fix**: 
```bash
npm i seedrandom
npm i -D @types/seedrandom
```
```ts
import seedrandom from 'seedrandom';

// Inject vào AlgorithmService
private rng: () => number = Math.random;

setSeed(seed: string) { this.rng = seedrandom(seed); }

// Mọi nơi: this.rng() thay vì Math.random()
```
Log seed mỗi run vào `debugLogs`. Test mode dùng seed cố định → reproducible.

---

### 🟠 ALG-H8: getResult re-init constraintService mỗi lần

**File**: `algorithm.producer.ts:150`.

UI poll mỗi 5s → reload teachers/rooms/subjects/classes mỗi 5s. DB nóng, race với worker.

**Fix**: Cache với TTL hoặc tính fitness lúc save (đã có) + trả từ DB column thay vì re-compute:
```ts
// Lưu fitnessDetails JSON vào generatedTimetable
model GeneratedTimetable {
  // ...
  fitness_details Json?
  fitness_violations Json?
}
```
Trả thẳng từ DB.

---

### 🟡 ALG-M1: Sort biased shuffle

**Files**: `algorithm.service.ts:389, 513`, `greedy.solver.ts:31, 125, 138`.
```ts
[...arr].sort(() => Math.random() - 0.5)  // ← biased
```

**Fix**: Dùng `shuffleArray` (đã có trong code, line 924) — Fisher-Yates đúng.

---

### 🟡 ALG-M2: Tabu key collision

**File**: `algorithm.service.ts:757, 775, 807`.

Tabu key dùng `${minIdx}-${maxIdx}`. Sau swap, mapping (i,j) ↔ slot identities thay đổi.

**Fix**: Tabu key dùng `(slot.subjectId, slot.classId, original_day, original_period)` snapshot.

---

### 🟡 ALG-M4: SC4 pair-merge triple-count cost

**File**: `algorithm.service.ts:889-899`.

```ts
const oldCost = slotCost(idxA) + slotCost(idxB) + slotCost(targetIdx);
```
Cùng penalty được tính ở idxA + idxB → triple-count.

**Fix**: Dùng global delta thay vì local sum.

---

### 🟡 ALG-M6: SC1 spread không cap penalty

**File**: `constraint.service.ts:270-288`.

`if (uniqueDays < min(length,3)) penalty++` — luôn +1 không cap, không weight theo độ chệch.

**Fix**: Weight theo `(min(length,3) - uniqueDays)`.

---

### 🟡 ALG-M7: checkSpecialSubjectTime sai cho class chiều

**File**: `constraint.service.ts:320-335`.

Check không phân biệt main_session lớp.

**Fix**: Dùng `classSessionMap.get(classId)` để xác định "buổi trái".

---

### 🟡 ALG-M8: Phase 1 fallback `teachers[0]` bias

**File**: `algorithm.service.ts:196`.

`teachers[0]` không deterministic, có thể trùng GV bận → tạo fake conflict.

**Fix**: Skip slot thay vì assign GV bừa. Log warning.

---

### 🟡 ALG-M9: groupBy roomId='none' tạo HC3 false positive

**File**: `constraint.service.ts:259-267, 203-207`.

`groupBy(schedule, 'roomId')` cho slot không room → key `'none'`. `checkHardConstraints` chỉ skip `'undefined'` và `'null'`, không skip `'none'` → mọi slot không phòng cùng day/period bị tính room conflict.

**Fix**: 
```ts
// constraint.service.ts:204
if (roomId === 'undefined' || roomId === 'null' || roomId === 'none') continue;
```

---

### 🟡 ALG-M10: Phase 2 GDTC block > 3 tiết never fits

**File**: `algorithm.service.ts:374-409`.

`validRange.length - count` âm khi count > 3 → loop không chạy → fallback.

**Fix**: Validate config; throw nếu `assign.total_periods` cho GDTC > 3.

---

### 🟢 ALG-L1: Magic numbers

Extract `algorithm.config.ts`:
```ts
export const ALGO = {
  PHASE3_MAX_ROUNDS: 60,
  PHASE3_INITIAL_TEMP: 50,
  PHASE3_COOLING_RATE: 0.92,
  PHASE3_TABU_CAP: 5000,
  PHASE3_TOFIX_LIMIT: 3000,
  PHASE3_STALE_BREAK: 5,
  HC_WEIGHT: 100,
  SC_WEIGHTS: { SC1: 10, SC4: 10, SC6: 5, SC7: 10 },
  SLOT_COST_WEIGHTS: { TEACHER_CONFLICT: 200, ... },
  HEAVY_CODES: ['TOAN','VAN','NGU_VAN','ANH','TIENG_ANH','LY','VAT_LY','HOA','HOA_HOC'],
  BLOCK_CODES: ['TOAN','VAN','NGU_VAN','ANH','TIENG_ANH'],
  PRIORITY_CODES: ['TOAN','VAN','NGU_VAN','ANH','TIENG_ANH'],
  TEACHER_MAX_PER_SESSION: 5,
  GDTC_MORNING_PERIODS: [1,2,3],
  GDTC_AFTERNOON_PERIODS: [8,9,10],
};
```

---

### 🟢 ALG-L2: algorithm.service.ts 1032 dòng — split

Tách:
- `phase1.fixed.ts`
- `phase2.heuristic.ts`
- `phase3.optimizer.ts`
- `slot-cost.ts`
- `swap.ts`

Strategy pattern: `Phase` interface với `run(solution, ctx)`.

---

### 🟢 ALG-L3: greedy.solver.ts dead code

Dùng tên field tiếng Việt (`lop_hoc`, `mon_hoc_id`) khác Prisma schema. Confirm + delete.

---

### 🟢 ALG-L5: Empty data → save header rỗng

**File**: `algorithm.service.ts:101-113`.

Nếu `classes=[]` hoặc `assignments=[]`, vẫn chạy → save TKB rỗng.

**Fix**:
```ts
if (data.classes.length === 0) throw new BadRequestException('No classes');
if (data.assignments.length === 0) throw new BadRequestException('No assignments');
```

---

### 🟢 ALG-L7: Redis check timeout 1000ms

**File**: `algorithm.producer.ts:53`.

Cold start Redis có thể > 1s.

**Fix**: 5s. Trả 503 thay vì chạy synchronous fallback (chặn HTTP request).

---

### 🟢 ALG-L8: processor không update progress

**File**: `algorithm.processor.ts`.

Frontend `getJobStatus` luôn 0%.

**Fix**: 
```ts
async process(job: Job) {
  await job.updateProgress(10);
  // phase 1
  await job.updateProgress(30);
  // phase 2
  await job.updateProgress(60);
  // phase 3
  await job.updateProgress(90);
  // save
  await job.updateProgress(100);
}
```

---

### 🟢 ALG-L9: getFitnessDetails vs calculateFitness lệch room conflict count

**File**: `constraint.service.ts:204` skip `'undefined'|'null'`, line 555 skip thêm `'none'`. Hai bên lệch → score lưu DB ≠ score hiển thị.

**Fix**: Đồng nhất guard.

---

### 🟢 ALG-L10: Phase 3 không có timeout tổng

**Fix**: Wrap `Promise.race` với timeout 60s.

---

## Code quality / refactor

### CQ-1: TypeScript strict
- BE: `strictNullChecks: true` nhưng `noImplicitAny: false` — bật full strict.
- FE: đã `strict: true` OK.

### CQ-2: API client thống nhất ở FE
Phần lớn pages dùng `fetch()` raw thay vì axios `api` instance. Migrate hết → 1 nơi config interceptor (auth token, error handling).

### CQ-3: Error boundary
FE chưa có error boundary global. Add `app/error.tsx` (Next 13+ pattern).

### CQ-4: Loading skeleton
Dashboard, lists hiện chỉ "Loading…". Add skeleton component.

### CQ-5: Toast system thống nhất
Mỗi page có local `toast` state. Tạo `ToastProvider` global (sonner / react-hot-toast).

### CQ-6: i18n
Strings tiếng Việt hardcode. Nếu cần multilingual: `next-intl`.

### CQ-7: Test coverage
Hiện chỉ có 2 spec file (`app.controller.spec.ts`, `algorithm.controller.spec.ts`). Cần:
- Unit test cho `ConstraintService.checkHardConstraints`, `getFitnessDetails`.
- Integration test cho `/algorithm/start` flow (mock Redis hoặc dùng testcontainers).
- E2E FE với Playwright.

### CQ-8: CI/CD
GitHub Actions:
- Lint + typecheck PR.
- Run tests.
- Build Docker images push registry.
- Coolify webhook deploy on `main` push.

### CQ-9: Pre-commit hooks
`husky` + `lint-staged` — chạy lint + typecheck trước commit.

### CQ-10: Monitoring
- Sentry cho error tracking (FE + BE).
- Prometheus + Grafana cho metrics (Coolify integrate được).
- Log aggregation: Loki / ELK.

### CQ-11: Backup
- Coolify có scheduled backup cho Postgres → enable.
- Verify restore flow định kỳ.

### CQ-12: Database index
Check thêm:
- `teaching_assignments[semester_id]` (query phổ biến).
- `timetable_slots[timetable_id]` (auto có do FK?).
- `generated_timetables[semester_id, created_at desc]`.

---

## Quick wins

Có thể fix trong < 30 phút mỗi cái:

1. ✅ TS-1 (đã làm).
2. SEC-L1: bcrypt rounds 10 → 12.
3. SEC-L2: bỏ default password compose.
4. SEC-L3: ParseUUIDPipe param.
5. SEC-H1: CORS whitelist domain.
6. ALG-L5: throw early empty data.
7. ALG-L7: tăng Redis timeout 5s.
8. ALG-M1: replace `.sort(() => Math.random()-0.5)` → `shuffleArray`.
9. ALG-L8: add `job.updateProgress`.
10. ALG-M9: add `'none'` vào guard room conflict.
11. ALG-L9: đồng nhất guard fitness vs check.

---

## Roadmap đề xuất

### Sprint 1 — Security urgent (1-2 ngày)
**Mục tiêu**: production an toàn dùng được.
- [ ] SEC-C1: JWT guard global + JwtStrategy
- [ ] SEC-C5: DTO + ValidationPipe whitelist
- [ ] SEC-C6: RolesGuard + IDOR check
- [ ] SEC-C2: Bỏ plain-text fallback
- [ ] SEC-C4: Throw nếu thiếu JWT_SECRET
- [ ] SEC-H1: CORS whitelist
- [ ] SEC-H3: ThrottlerModule

### Sprint 2 — Data integrity (1-2 ngày)
- [ ] ALG-C1: xóa TKB cũ khi save mới
- [ ] ALG-C2: clearSchedule giữ official + locked
- [ ] ALG-C3: BullMQ jobId dedupe
- [ ] ALG-C4: $transaction header + slots
- [ ] ALG-C5: deferred constraints hoặc sentinel âm

### Sprint 3 — Algorithm correctness (2-3 ngày)
- [ ] ALG-H3: fix GVCN_TEACHING quota counting
- [ ] ALG-H4: unify slotCost ↔ fitness
- [ ] ALG-H6: room conflict trong slotCost
- [ ] ALG-H7: seedrandom + log seed
- [ ] ALG-H1: extract config + tăng NUM_RESTARTS
- [ ] ALG-H5: track best-so-far với rollback

### Sprint 4 — Quality + UX (1 tuần)
- [ ] SEC-C3: Captcha Redis TTL
- [ ] SEC-H4: Excel MIME + magic byte + zip-bomb guard
- [ ] SEC-H5: Notification IDOR
- [ ] SEC-H6: invalidate JWT on password change
- [ ] SEC-H7: forgot-password flow
- [ ] CQ-2: FE thống nhất axios client
- [ ] CQ-3: error boundary
- [ ] CQ-7: unit test ConstraintService

### Sprint 5 — Observability + DevOps (1 tuần)
- [ ] CQ-8: GitHub Actions CI/CD
- [ ] CQ-9: husky pre-commit
- [ ] CQ-10: Sentry + Prometheus
- [ ] CQ-11: backup verify
- [ ] SEC-M1: helmet
- [ ] SEC-M2: global exception filter

### Backlog (khi rảnh)
- ALG-M*, ALG-L* refactor.
- CQ-4, CQ-5, CQ-6 UI polish.
- SEC-M3 soft-delete migration.
- ALG-L2 split algorithm.service.ts.

---

**Tổng**: 6 SEC-CRITICAL, 8 SEC-HIGH, 5 ALG-CRITICAL, 8 ALG-HIGH, ~25 MEDIUM/LOW. Ưu tiên Sprint 1+2 để production an toàn + dữ liệu không mất.
