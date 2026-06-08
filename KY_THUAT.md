# TÀI LIỆU KỸ THUẬT CHUYÊN SÂU — TKB Pro

> Mổ xẻ **tất tần tật** kỹ thuật code, thuật toán, cấu trúc dữ liệu, design pattern, và công nghệ thực sự dùng trong hệ thống xếp Thời Khóa Biểu THPT. Mọi nội dung tham chiếu trực tiếp tới code thật trong repo. Đây là tài liệu **WHY & HOW** (vì sao + làm thế nào), bổ trợ cho [PROJECT.md](PROJECT.md) (WHAT — tra cứu nhanh).

> Phiên bản 1.0 — đọc kèm source. Mỗi đoạn code dán ở đây là trích từ file thật, đường dẫn ghi rõ.

---

## Mục lục

1. [Triết lý kiến trúc & quyết định kỹ thuật](#1-triết-lý-kiến-trúc--quyết-định-kỹ-thuật)
2. [Mô hình hóa bài toán — từ nghiệp vụ sang toán học](#2-mô-hình-hóa-bài-toán--từ-nghiệp-vụ-sang-toán-học)
3. [Cấu trúc dữ liệu cốt lõi & kỹ thuật mã hóa](#3-cấu-trúc-dữ-liệu-cốt-lõi--kỹ-thuật-mã-hóa)
4. [Thuật toán lai — tổng quan pipeline 3 pha](#4-thuật-toán-lai--tổng-quan-pipeline-3-pha)
5. [Phase 1 — Đặt slot cố định (Constraint Seeding)](#5-phase-1--đặt-slot-cố-định-constraint-seeding)
6. [Phase 2 — Greedy heuristic + Pair/Block scheduling](#6-phase-2--greedy-heuristic--pairblock-scheduling)
7. [Phase 2c/2d — Post-processing: nén lịch & gán phòng lab](#7-phase-2c2d--post-processing-nén-lịch--gán-phòng-lab)
8. [Phase 3 — Hill Climbing + Simulated Annealing + Tabu Search](#8-phase-3--hill-climbing--simulated-annealing--tabu-search)
9. [Hàm Fitness & hệ thống Constraint](#9-hàm-fitness--hệ-thống-constraint)
10. [Kỹ thuật tối ưu hiệu năng](#10-kỹ-thuật-tối-ưu-hiệu-năng)
11. [Bảo mật — Captcha HMAC, JWT, bcrypt, Guards](#11-bảo-mật--captcha-hmac-jwt-bcrypt-guards)
12. [Worker/Queue — BullMQ + fallback đồng bộ](#12-workerqueue--bullmq--fallback-đồng-bộ)
13. [Pipeline Excel — parse, alias, validate, transaction](#13-pipeline-excel--parse-alias-validate-transaction)
14. [Frontend — Drag & Drop, Redux, optimistic update](#14-frontend--drag--drop-redux-optimistic-update)
15. [Tổng hợp Design Pattern toàn dự án](#15-tổng-hợp-design-pattern-toàn-dự-án)

---

## 1. Triết lý kiến trúc & quyết định kỹ thuật

### 1.1. Vì sao tách 3 tier rõ rệt

Hệ thống chia 3 process độc lập, giao tiếp qua ranh giới rõ ràng:

```
┌─────────────┐   HTTP/JSON    ┌─────────────┐   Prisma/SQL   ┌────────────┐
│  FE_TKB     │ ◄────────────► │  BE_TKB     │ ◄────────────► │ PostgreSQL │
│  Next.js    │   axios/fetch  │  NestJS     │   TCP 5432     │  17-alpine │
└─────────────┘                └──────┬──────┘                └────────────┘
                                      │ BullMQ
                                      ▼
                                 ┌─────────┐
                                 │  Redis  │  ← job queue + ping healthcheck
                                 └─────────┘
```

Lý do then chốt:
- **Thuật toán nặng CPU** (xếp 1800 slot/tuần) phải tách khỏi request HTTP để không block event loop của Node. → Đẩy qua **BullMQ worker**.
- **FE build-time tĩnh** (Next standalone) → deploy độc lập, scale riêng, CDN cache được.
- **DB là single source of truth** — không có state nghiệp vụ nằm ở memory (trừ cache đọc của thuật toán, build lại mỗi lần chạy).

### 1.2. Ba quyết định kỹ thuật quan trọng nhất

| Quyết định | Đánh đổi (trade-off) | Vì sao chọn |
| :--- | :--- | :--- |
| **Thuật toán lai (Greedy → SA), KHÔNG phải GA thuần** | Mất tính đa dạng quần thể của GA thật | Greedy lấp 90-95% trong vài trăm ms; SA chỉ sửa phần dư → tổng thời gian giây thay vì phút. Bài toán có cấu trúc mạnh (môn cố định, buổi học cố định) nên heuristic ăn đứt random init. |
| **In-memory index Set/Map rebuild mỗi pha** | Tốn RAM tạm, phải maintain khi swap | Biến mọi kiểm tra xung đột từ O(n) quét mảng → O(1) hash lookup. Với n≈1800 slot và hàng triệu phép kiểm tra, đây là yếu tố sống còn. |
| **Template-week expansion lúc save** | Nhân slot lên ×18 tuần khi ghi DB | Thuật toán chỉ làm việc trên 1 "tuần mẫu" (60 ô/lớp); DB lưu đủ tuần để FE hiển thị lịch theo tuần thực. Tách compute khỏi storage. |

### 1.3. Nguyên tắc xuyên suốt code

- **Controller mỏng, Service dày**: controller chỉ route + DTO + validate; toàn bộ logic ở service. (Pattern NestJS chuẩn.)
- **Không gọi `PrismaClient` trực tiếp**: luôn qua `PrismaService` (singleton, quản lý connection pool).
- **Constraint là code thuần, không phải DB rule**: rule xếp lịch viết bằng TypeScript trong `ConstraintService` + `subject-rules.ts`, không nhúng vào SQL → dễ test, dễ đổi trọng số.
- **DB unique constraint là lưới an toàn cuối cùng**: thuật toán *phải* tự đảm bảo no-conflict, nhưng 3 `@@unique` ở tầng DB chặn mọi sai sót lọt lưới.

---

## 2. Mô hình hóa bài toán — từ nghiệp vụ sang toán học

### 2.1. Phát biểu hình thức

Bài toán xếp TKB là **Constraint Satisfaction + Optimization Problem (CSOP)**, thuộc lớp **NP-Complete** (quy về graph coloring / list coloring).

**Cho:**
- Tập lớp `C = {c₁..c₃₀}`
- Tập giáo viên `T = {t₁..t₅₀}`
- Tập môn `S = {s₁..s₁₇}`
- Tập phòng `R = {r₁..r₃₅}`
- Tập khung giờ `K = D × P` với `D = {2..7}` (6 ngày), `P = {1..10}` (10 tiết) → **|K| = 60 ô/tuần**
- Tập phân công `A = {a₁..aₙ}`, mỗi `aᵢ = (lớp, gv, môn, số_tiết)` — **đây là INPUT** (`teaching_assignments`)

**Tìm:** ánh xạ mỗi tiết của mỗi phân công vào một bộ `(d, p, room)` sao cho:
- **Thỏa mọi ràng buộc cứng** (HC) → nghiệm khả thi (feasible)
- **Tối thiểu hóa tổng phạt mềm** (SC) → nghiệm tối ưu

### 2.2. Không gian tìm kiếm lớn cỡ nào

Mỗi lớp cần lấp ~30 tiết học/tuần vào 60 ô. Riêng 1 lớp đã có cỡ `C(60,30) ≈ 1.18 × 10¹⁷` cách. Với 30 lớp chia sẻ chung GV và phòng, không gian tổ hợp **vượt xa khả năng vét cạn** (brute-force). Đây là lý do bắt buộc dùng metaheuristic thay vì duyệt toàn bộ.

### 2.3. Hàm mục tiêu (Objective Function)

Định nghĩa tại [algorithm.service.ts:1150-1154](BE_TKB/src/algorithm/algorithm.service.ts#L1150-L1154):

```ts
private calculateFitness(slots: any[]): number {
    const hardViolations = this.constraintService.checkHardConstraints(slots);
    const softPenalty = this.constraintService.calculatePenalty(slots);
    return 1000 - (hardViolations * 100) - softPenalty;
}
```

Công thức:
```
Fitness = 1000 − (HardViolations × 100) − SoftPenalty
```

Đặc tính toán học của hàm này:
- **Cận trên = 1000**: đạt khi `HardViolations = 0` và `SoftPenalty = 0`.
- **TKB hợp lệ ⟺ Fitness = 1000** về phần cứng (zero hard violation). Mọi điểm < 1000 do hard đều là nghiệm **bất khả thi**, không được phép xuất chính thức.
- **Phân tầng trọng số**: 1 lỗi cứng = 100 điểm = 10 lỗi mềm SC nặng nhất. Thiết kế này ép thuật toán **luôn ưu tiên dập lỗi cứng trước**, chỉ tinh chỉnh mềm khi đã sạch cứng.
- **Có thể âm**: nhiều lỗi cứng → fitness âm. Không sao, chỉ dùng để so sánh tương đối giữa các lần restart.

### 2.4. Hai "hệ quy chiếu" thời gian — nguồn bug kinh điển

Đây là **mô hình hóa quan trọng nhất phải nắm**:

| Khái niệm | Range | Dùng ở đâu |
| :--- | :--- | :--- |
| **Period tuyệt đối** | 1-10 | `timetable_slots.period`, toàn bộ thuật toán |
| **Period tương đối** | 1-5 (trong buổi) | `teacher_constraints.period` (lịch bận GV) |
| **Session** | 0=Sáng, 1=Chiều | suy ra: `session = period <= 5 ? 0 : 1` |

Phép chuyển đổi đặt tập trung tại [constraint.service.ts:134-149](BE_TKB/src/algorithm/constraint.service.ts#L134-L149):

```ts
public isTeacherBusy(teacherId: string, day: number, period: number): boolean {
    const constraints = this.teacherConstraints.get(teacherId);
    if (!constraints || constraints.length === 0) return false;
    const session = period <= 5 ? 0 : 1;
    const relativePeriod = period <= 5 ? period : period - 5;  // ← 1-10 → 1-5
    return constraints.some(c =>
        c.day_of_week === day &&
        c.period === relativePeriod &&
        (c.session === session || c.session === 2) &&  // 2 = Cả ngày
        c.type === 'BUSY'
    );
}
```

> **Tại sao tách 2 hệ?** Vì GV đăng ký bận theo trực giác "sáng tiết 3", "chiều tiết 2" — tức tương đối trong buổi. Còn TKB lưu tuyệt đối để render lưới 10 dòng. Hàm convert là điểm dịch duy nhất; sai ở đây → lỗi HC4 sai lệch toàn hệ thống.

### 2.5. Quy ước "buổi chính" (main_session) — ràng buộc nghiệp vụ thành tham số

Mỗi lớp có thuộc tính `main_session` quyết định buổi học văn hóa:
- Khối **12, 10** → học chính buổi **SÁNG** (`main_session = 0`)
- Khối **11** → học chính buổi **CHIỀU** (`main_session = 1`)

Quy ước này được "đốt" thành tham số `mainPeriodStart/mainPeriodEnd` ở Phase 2:

```ts
const mainPeriodStart = isMorningMain ? 1 : 6;
const mainPeriodEnd   = isMorningMain ? 5 : 10;
```

Mô hình hóa khéo: thay vì if/else rải khắp nơi, chỉ cần dịch cửa sổ tiết `[1..5]` hoặc `[6..10]` rồi mọi logic xếp đặt dùng chung. Môn được phép học trái buổi (GDTC/GDQP/HDTN/GDDP) tách riêng qua `isSessionExempt()`.

---

## 3. Cấu trúc dữ liệu cốt lõi & kỹ thuật mã hóa

### 3.1. `TimeSlot` — nguyên tử của hệ thống

Định nghĩa tại [constraint.service.ts:12-21](BE_TKB/src/algorithm/constraint.service.ts#L12-L21):

```ts
export interface TimeSlot {
    id?: string;
    day: number;     // 2-7 (Mon-Sat)
    period: number;  // 1-10 (1-5 Sáng, 6-10 Chiều)
    classId: string;
    subjectId: number;
    teacherId: string;
    roomId?: number;   // optional: CHAO_CO không có phòng
    isLocked?: boolean;
}
```

Đây là đối tượng được copy/swap hàng triệu lần. Vì vậy:
- **Phẳng (flat), không lồng object** → copy nông `{...s}` là đủ, rẻ.
- **`roomId` nullable** có chủ đích: Chào cờ + GDTC/GDQP (sân) không gắn phòng → tránh tính HC3 nhầm.
- **`isLocked` quyết định bất biến**: slot khóa không bao giờ bị Phase 2/3 đụng tới (skip ngay đầu vòng lặp).

### 3.2. Kỹ thuật String-Key Hashing — trái tim của O(1)

Toàn bộ kiểm tra xung đột dựa trên **mã hóa tọa độ thành chuỗi key** rồi tra `Set`/`Map`. Đây là kỹ thuật lặp lại dày đặc nhất trong codebase.

Ví dụ build index ở Phase 3 [algorithm.service.ts:785-787](BE_TKB/src/algorithm/algorithm.service.ts#L785-L787):

```ts
const tKey = (tid: string, d: number, p: number) => `${tid}-${d}-${p}`;  // teacher@time
const cKey = (cid: string, d: number, p: number) => `${cid}-${d}-${p}`;  // class@time
const rKey = (rid: number, d: number, p: number) => `${rid}-${d}-${p}`;  // room@time
```

**Vì sao chuỗi mà không phải tuple/array làm key?**
- JS `Map`/`Set` so sánh key bằng *reference* với object/array → `[1,2,3] !== [1,2,3]`. Chuỗi so bằng *value* → `"1-2-3" === "1-2-3"`. Nên muốn key tổ hợp phải serialize ra string.
- Concat template literal cực nhanh, V8 tối ưu tốt cho key ngắn.

**Ý nghĩa ngữ nghĩa của 3 index:**

| Index | Key | Value | Phát hiện |
| :--- | :--- | :--- | :--- |
| `teacherAt` | `tid-day-period` | `Set<slotIndex>` | GV trùng giờ (set.size > 1 → HC1) |
| `classAt` | `cid-day-period` | `Set<slotIndex>` | Lớp trùng giờ (HC2) |
| `roomAt` | `rid-day-period` | `Set<slotIndex>` | Phòng trùng (HC3) |

Khi `Set` tại một key có `size > 1` ⟹ có ≥2 slot cùng chiếm 1 tọa độ ⟹ xung đột. Kiểm tra xung đột rút về **một phép `.get().size`** thay vì quét cả mảng.

### 3.3. Index phụ trợ — chỉ mục theo thực thể

Ngoài index "ai-ở-đâu", còn có index "thực thể-có-những-slot-nào" [algorithm.service.ts:782-783](BE_TKB/src/algorithm/algorithm.service.ts#L782-L783):

```ts
const classSlotsIdx = new Map<string, number[]>();    // classId → [chỉ số slot]
const teacherSlotsIdx = new Map<string, number[]>();  // teacherId → [chỉ số slot]
```

Dùng để: khi cần xét tất cả tiết của 1 lớp (kiểm tra môn block, spread) hoặc 1 GV (đếm tải, tìm tiết trống) → lấy thẳng danh sách index thay vì `.filter()` toàn mảng 1800 phần tử. Đổi O(n) thành O(số_slot_của_lớp) ≈ O(30).

### 3.4. Kỹ thuật maintain index khi swap — `addIdx` / `rmIdx`

Index O(1) chỉ có giá trị nếu **luôn đồng bộ với mảng slot**. Mỗi lần đổi chỗ 2 tiết phải gỡ key cũ, thêm key mới [algorithm.service.ts:789-808](BE_TKB/src/algorithm/algorithm.service.ts#L789-L808):

```ts
const addIdx = (s: any, i: number) => {
    const tk = tKey(s.teacherId, s.day, s.period);
    if (!teacherAt.has(tk)) teacherAt.set(tk, new Set());
    teacherAt.get(tk)!.add(i);
    // ... tương tự classAt, roomAt
};
const rmIdx = (s: any, i: number) => {
    teacherAt.get(tKey(s.teacherId, s.day, s.period))?.delete(i);
    classAt.get(cKey(s.classId, s.day, s.period))?.delete(i);
    if (s.roomId != null) roomAt.get(rKey(s.roomId, s.day, s.period))?.delete(i);
};
```

Và phép swap nguyên tử [algorithm.service.ts:951-957](BE_TKB/src/algorithm/algorithm.service.ts#L951-L957):

```ts
const doSwap = (i: number, j: number) => {
    rmIdx(slots[i], i); rmIdx(slots[j], j);          // 1. gỡ cả 2 khỏi index
    const td = slots[i].day, tp = slots[i].period;   // 2. hoán đổi (day,period)
    slots[i].day = slots[j].day; slots[i].period = slots[j].period;
    slots[j].day = td; slots[j].period = tp;
    addIdx(slots[i], i); addIdx(slots[j], j);         // 3. thêm lại với key mới
};
```

> **Mẹo tinh tế**: swap chỉ đổi `(day, period)`, **giữ nguyên** `classId/teacherId/subjectId`. Tức là "đổi giờ học của 2 tiết trong cùng lớp" (hoặc cùng GV ở strategy 2). Nhờ vậy không phá vỡ phân công gốc, chỉ dịch chuyển thời gian — đúng bản chất nghiệp vụ.

`doSwap` gọi 2 lần để **thử-rồi-hoàn** (probe): swap → đo cost mới → swap lại để khôi phục. Đây là cách "nhìn trước" hệ quả mà không commit:

```ts
const oldCost = currentCost + slotCost(j);
doSwap(badIdx, j);                          // thử
const newCost = slotCost(badIdx) + slotCost(j);
doSwap(badIdx, j);                          // hoàn lại
const delta = newCost - oldCost;            // nếu delta < 0 thì swap thật sự có lợi
```

### 3.5. Cache đọc trong `ConstraintService` — tránh round-trip DB

`initialize(semesterId)` nạp toàn bộ dữ liệu tham chiếu vào Map một lần [constraint.service.ts:40-70](BE_TKB/src/algorithm/constraint.service.ts#L40-L70):

```ts
public roomMap: Map<string, number>;        // tên phòng → id
public subjectMap: Map<string, number>;     // mã môn → id
public teacherMap: Map<string, any>;        // id → object GV
private teacherConstraints: Map<string, any[]>;  // id GV → mảng lịch bận
public classSessionMap: Map<string, number>;     // id lớp → main_session
private subjectCodeMap = new Map<number, string>();  // id môn → mã (UPPERCASE)
```

Trong vòng lặp thuật toán, `getSubjectCode(id)`, `isTeacherBusy(...)` gọi hàng trăm nghìn lần — nếu mỗi lần query DB thì sập. Cache biến chúng thành tra Map thuần. `getSubjectCode` còn dùng **memoization lười** [constraint.service.ts:485-491](BE_TKB/src/algorithm/constraint.service.ts#L485-L491): tra cache trước, miss thì tính + ghi cache.

### 3.6. Sinh khóa & ID

- **Slot mới trong thuật toán**: `crypto.randomUUID()` — UUID v4 chuẩn, chống trùng khi `createMany`.
- **Khóa tổ hợp DB**: 3 `@@unique([timetable_id, X, day, period])` — chính là phiên bản DB của string-key ở mục 3.2, ép unique ở tầng lưu trữ.

---

## 4. Thuật toán lai — tổng quan pipeline 3 pha

### 4.1. Vì sao "lai" (hybrid) chứ không một thuật toán đơn

Không metaheuristic đơn lẻ nào tối ưu cho mọi giai đoạn:

| Giai đoạn | Đặc tính bài toán | Kỹ thuật phù hợp |
| :--- | :--- | :--- |
| Đặt tiết cố định (chào cờ, SHCN) | Xác định 100%, không có lựa chọn | Rule-based seeding (deterministic) |
| Lấp 90% lịch | Cần nhanh, cấu trúc rõ (môn block, ưu tiên) | Greedy + heuristic sort |
| Sửa 10% vi phạm còn lại | Đụng cực trị địa phương, cần thoát bẫy | Hill Climbing + Simulated Annealing + Tabu |

→ **Mỗi pha dùng đúng vũ khí của nó.** Đây là triết lý "construct then improve" (xây thô rồi tinh chỉnh) kinh điển trong tối ưu tổ hợp.

### 4.2. Sơ đồ luồng tổng

Điều phối tại [algorithm.service.ts:23-106](BE_TKB/src/algorithm/algorithm.service.ts#L23-L106):

```
runAlgorithm(semesterId)
│
├─ 0. constraintService.initialize()    ← nạp cache Map (rooms/subjects/teachers/constraints)
├─ 0. loadData()                         ← Promise.all 5 query song song
│
├─ 1. initializeSolution()               ← {slots:[], các Set rỗng}
├─ 1.1 Nạp slot LOCKED từ TKB cũ         ← bảo toàn chỉnh tay của user (chỉ week=1)
│
├─ 2. phase1_FixedSlots()                ← đặt chào cờ/SHCN/GVCN, isLocked=true
│      phase1Slots = clone(solution.slots)   ← snapshot làm điểm xuất phát
│
├─ 3. FOR attempt IN 1..NUM_RESTARTS:    ← multi-restart (hiện =1)
│        attempt = clone(phase1Slots)        ← copy sâu từng phần tử
│        phase2_Heuristic(attempt)           ← greedy lấp đầy
│        phase3_Genetic(attempt)             ← SA tinh chỉnh
│        giữ lại bản fitness cao nhất
│
├─ 4. getFitnessDetails()                ← tính lại điểm + sinh thông điệp lỗi tiếng Việt
└─ 5. saveToDatabase()                   ← expand ×numWeeks + createMany + prune bản cũ
```

### 4.3. Kỹ thuật "snapshot + clone" để multi-restart an toàn

Đây là một pitfall JS điển hình được xử lý đúng tại [algorithm.service.ts:66-74](BE_TKB/src/algorithm/algorithm.service.ts#L66-L74):

```ts
const phase1Slots = solution.slots.map(s => ({ ...s }));   // snapshot SAU phase 1
// ...
for (let attempt = 0; attempt < NUM_RESTARTS; attempt++) {
    const attemptSolution = { slots: phase1Slots.map(s => ({ ...s })), fitness_score: 0 };
    //                                          ^^^^^^^^^^^^^^^^^^^^^^ clone lại mỗi vòng
    this.phase2_Heuristic(attemptSolution, data);
    await this.phase3_Genetic(attemptSolution, data);
    if (attemptSolution.fitness_score > bestSolution.fitness_score) {
        bestSolution = attemptSolution;
    }
}
```

> **Tại sao `.map(s => ({...s}))` chứ không gán thẳng?** Nếu viết `slots: phase1Slots` thì mọi attempt **chia sẻ cùng mảng object**; Phase 2/3 mutate trực tiếp `slot.day/period` → vòng restart sau bắt đầu từ kết quả vòng trước, hỏng tính độc lập. Copy nông từng phần tử cho mỗi attempt một bản riêng. Vì `TimeSlot` phẳng (mục 3.1) nên copy nông là đủ sâu.

### 4.4. Bảo toàn chỉnh sửa thủ công (Lock Preservation)

Cơ chế cho phép admin kéo-thả sửa tay rồi chạy lại mà không mất công sức [algorithm.service.ts:42-62](BE_TKB/src/algorithm/algorithm.service.ts#L42-L62):

```ts
const prevTimetable = await this.prisma.generatedTimetable.findFirst({
    where: { semester_id: semesterId },
    orderBy: { created_at: 'desc' },
    include: { slots: { where: { is_locked: true, week: 1 } } }  // chỉ slot khóa, tuần mẫu
});
if (prevTimetable && prevTimetable.slots.length > 0) {
    prevTimetable.slots.forEach(s => {
        solution.slots.push({ ...s, isLocked: true });  // nạp vào TRƯỚC Phase 1
    });
}
```

Luồng đầy đủ:
1. Run 1 → sinh TKB, fitness 950.
2. Admin kéo-thả 1 tiết → `moveSlot` set `is_locked = true` cho tiết đó.
3. Admin toggle khóa thêm vài tiết cần giữ.
4. Run 2: các slot `is_locked=true` được nạp **trước Phase 1**.
5. Phase 1 gọi `isSlotOccupied()` → bỏ qua ô đã khóa.
6. Phase 2/3 skip mọi slot `isLocked` ngay đầu vòng.

→ Slot khóa là **điểm bất động** (fixed point) mà thuật toán xây xung quanh. Đây là kỹ thuật **warm-start có ràng buộc**.

### 4.5. Tham số `NUM_RESTARTS` và hướng mở rộng

Hiện `NUM_RESTARTS = 1` (hardcoded, [algorithm.service.ts:69](BE_TKB/src/algorithm/algorithm.service.ts#L69)). Vì Phase 2 có thành phần ngẫu nhiên (`shuffleArray`, `Math.random()` khi sort ngày), tăng số restart sẽ lấy mẫu nhiều nghiệm khác nhau rồi giữ bản tốt nhất — **Random Restart Hill Climbing** kinh điển. Production nên tăng + chạy song song qua Worker thread (xem mục tech debt PROJECT.md).

---

## 5. Phase 1 — Đặt slot cố định (Constraint Seeding)

Code: [phase1_FixedSlots — algorithm.service.ts:131-231](BE_TKB/src/algorithm/algorithm.service.ts#L131-L231).

### 5.1. Mục đích & triết lý

Phase 1 đặt trước những tiết **bất biến theo quy định nhà trường** — không có gì để "tối ưu", chỉ là áp luật cứng. Đặt sớm + khóa cứng để Phase 2/3 xây xung quanh.

Loại tiết cố định (quyết định bởi [checkFixedSlot — constraint.service.ts:168-191](BE_TKB/src/algorithm/constraint.service.ts#L168-L191)):

| Vị trí | Subject | GV |
| :--- | :--- | :--- |
| T2, tiết 1 (sáng) | `CHAO_CO` | GVCN (tránh trùng) |
| T2, tiết 2 (sáng) / tiết 6 (chiều) | `GVCN_TEACHING` | GVCN dạy môn của mình |
| T7, tiết 4 (sáng) / tiết 9 (chiều) | `GVCN_TEACHING` | GVCN |
| T7, tiết 5 (sáng) / tiết 10 (chiều) | `SH_CUOI_TUAN` | GVCN |

### 5.2. Kỹ thuật resolve mã môn đa biến thể

Mã môn trong dữ liệu thật lộn xộn (`SHCN`, `SH_CN`, `SINH_HOAT`...). Xử lý bằng hàm resolve có fallback [algorithm.service.ts:137-142](BE_TKB/src/algorithm/algorithm.service.ts#L137-L142):

```ts
const resolveSubjectId = (code: string) => {
    if (subjectCodeMap.has(code)) return subjectCodeMap.get(code);
    if (code === 'SH_CN')     return subjectCodeMap.get('SHCN');
    if (code === 'SINH_HOAT') return subjectCodeMap.get('SHCN');
    return undefined;
};
```

→ Một điểm chuẩn hóa duy nhất, tránh rải `if` mã môn khắp nơi. Đây là pattern **Anti-Corruption Layer** thu nhỏ: cô lập sự bẩn của dữ liệu vào một hàm.

### 5.3. Xử lý đặc biệt "GVCN dạy môn của mình"

Tiết `GVCN_TEACHING` không phải môn cố định — mà là **tiết môn văn hóa do chính GVCN dạy**. Phải tra ngược phân công để biết GVCN dạy môn gì [algorithm.service.ts:171-187](BE_TKB/src/algorithm/algorithm.service.ts#L171-L187):

```ts
if (check.subjectCode === 'GVCN_TEACHING') {
    const homeroomId = cls.homeroom_teacher_id;
    if (homeroomId) {
        const assignment = data.assignments.find((a: any) => {
            if (a.class_id !== cls.id || a.teacher_id !== homeroomId) return false;
            const subj = data.subjects.find((s: any) => s.id === a.subject_id);
            return subj && !subj.is_special;   // phải là môn văn hóa, không phải đặc biệt
        });
        if (assignment) {
            subjId = assignment.subject_id;
            teacherId = homeroomId;
        } else {
            log(`[WARNING] GVCN không dạy môn văn hóa nào cho lớp ${cls.name}`);
        }
    }
}
```

### 5.4. Chuỗi fallback gán giáo viên — defensive programming

Để **không bao giờ** sinh slot thiếu GV (sẽ vỡ ở DB), có chuỗi fallback nhiều tầng [algorithm.service.ts:191-203](BE_TKB/src/algorithm/algorithm.service.ts#L191-L203):

```ts
if (['SHCN','SH_CN','SINH_HOAT','SH_DAU_TUAN','SH_CUOI_TUAN'].includes(check.subjectCode)) {
    teacherId = cls.homeroom_teacher_id;
} else if (check.subjectCode === 'CHAO_CO') {
    teacherId = cls.homeroom_teacher_id || fallbackTeacherId;   // GVCN → BGH
} else if (['GDDP','HDTN'].includes(check.subjectCode)) {
    const assignment = data.assignments.find(a => a.class_id===cls.id && a.subject_id===subjId);
    if (assignment) teacherId = assignment.teacher_id;
}
// Lưới cuối: GVCN → BGH → GV đầu tiên trong DB
if (!teacherId) teacherId = cls.homeroom_teacher_id || fallbackTeacherId || (teachers[0]?.id ?? null);
```

> **Vì sao Chào cờ dùng GVCN chứ không 1 GV chung?** Nếu mọi lớp dùng chung 1 thầy hiệu trưởng cho chào cờ → 30 lớp × cùng T2P1 → GV đó "dạy" 30 lớp cùng lúc → 29 lỗi HC1 giả. Dùng GVCN mỗi lớp triệt tiêu xung đột này ngay từ gốc.

### 5.5. Vòng lặp đặt tiết & skip session sai

```ts
for (let d = 2; d <= 7; d++) {
    for (let p = 1; p <= 10; p++) {
        if (isMorning && p > 5) continue;    // lớp sáng bỏ tiết chiều
        if (!isMorning && p <= 5) continue;  // lớp chiều bỏ tiết sáng
        if (this.isSlotOccupied(solution.slots, cls.id, d, p)) continue;  // tôn trọng lock
        const check = this.constraintService.checkFixedSlot(d, p, grade, session);
        if (check.isFixed && check.subjectCode) { /* resolve + push slot isLocked:true */ }
    }
}
```

Grade lấy bằng regex từ tên lớp: `cls.name.match(/\d+/)` → "10A1" → 10. Kỹ thuật **trích số đầu tiên** đơn giản nhưng hiệu quả với quy ước đặt tên lớp THPT.

Kết quả Phase 1: ~50-150 slot khóa cứng tùy số lớp, làm bộ khung cho các pha sau.

---

## 6. Phase 2 — Greedy heuristic + Pair/Block scheduling

Code: [phase2_Heuristic — algorithm.service.ts:233-637](BE_TKB/src/algorithm/algorithm.service.ts#L233-L637). Đây là pha lấp đầy 90-95% TKB, phức tạp và nhiều heuristic nhất.

### 6.1. Kiến trúc index incremental — xây 1 lần, cập nhật tăng dần

Khác Phase 3 (rebuild full mỗi vòng), Phase 2 build index **một lần** rồi cập nhật mỗi khi thêm slot, qua hàm `addSlot` tập trung [algorithm.service.ts:281-294](BE_TKB/src/algorithm/algorithm.service.ts#L281-L294):

```ts
const addSlot = (slot: any) => {
    solution.slots.push(slot);
    classOccupied.add(`${slot.classId}-${slot.day}-${slot.period}`);
    teacherOccupied.add(`${slot.teacherId}-${slot.day}-${slot.period}`);
    trackBlock(slot.classId, slot.day, slot.period, code);             // đếm môn block
    classSubjectDays.get(csKey)!.add(slot.day);                        // theo dõi spread
    teacherDaySessionCount.set(tdsKey, count+1);                       // đếm tải GV
    classDayTotals.set(dtKey, total+1);                               // đếm để fill-to-5
};
```

6 cấu trúc theo dõi song song, mỗi cái phục vụ một ràng buộc:

| Cấu trúc | Mục đích |
| :--- | :--- |
| `classOccupied` Set | Lớp đã chiếm ô chưa (HC2) |
| `teacherOccupied` Set | GV đã chiếm ô chưa (HC1) |
| `classDaySessionBlock` Map→Map | Đếm môn block theo lớp-ngày-buổi, chia theo mã (R1, R2) |
| `classDaySessionBlockPeriods` Map→Set | Tiết nào có môn block (R3 — chống 3 liên tiếp) |
| `classSubjectDays` Map→Set | Môn đã rải ngày nào (SC1 spread) |
| `teacherDaySessionCount` Map | Tải GV mỗi buổi (SC7 quá tải) |

### 6.2. Step 0 — Tiền xử lý môn xung đột cao (TIN) bằng round-robin

GV Tin học thường dạy nhiều lớp → cực dễ trùng giờ. Giải pháp: đặt TIN **trước tất cả**, phân ngày kiểu xoay vòng [algorithm.service.ts:344-404](BE_TKB/src/algorithm/algorithm.service.ts#L344-L404):

```ts
for (const [teacherId, entries] of tinAssignmentsByTeacher) {
    const allDays = [2, 3, 4, 5, 6, 7];
    this.shuffleArray(allDays);    // xáo trộn để các lần chạy khác nhau
    let dayIdx = 0;
    for (const { cls, assign } of entries) {
        while (remaining > 0) {
            const day = allDays[dayIdx % allDays.length];   // ← xoay vòng ngày
            dayIdx++;
            // thử đặt vào tiết sớm nhất của buổi chính, né mọi xung đột GV
        }
    }
}
```

> **Vì sao round-robin?** Một GV Tin dạy 8 lớp; nếu greedy đặt cả 8 vào cùng vài ngày → trùng giờ liên hoàn. Xoay vòng `dayIdx % 6` rải đều mỗi assignment sang ngày khác → giảm va chạm GV ngay từ đầu, để Phase 3 nhẹ việc. Đây là kỹ thuật **conflict-driven ordering** — xử lý phần tử khó nhất trước (Most Constrained Variable trong CSP).

### 6.3. Step 1 — Phân loại đơn vị đặt (Pair vs Single)

Mỗi phân công được tách thành các "đơn vị đặt" theo bản chất môn [algorithm.service.ts:413-450](BE_TKB/src/algorithm/algorithm.service.ts#L413-L450):

```ts
type PlacementUnit = { assign, size: 1|2, code, isPriority, isBlock };

let r = remaining;
while (r >= 2 && isBlock) {           // môn block: gom thành cặp 2 tiết
    pairs.push({ assign, size: 2, code, isPriority, isBlock });
    r -= 2;
}
while (r > 0) {                        // phần dư + môn thường: tiết lẻ
    singles.push({ assign, size: 1, code, isPriority, isBlock });
    r--;
}
```

Phân loại 3 nhóm:
- **Opposite blocks** (GDQP/GDTC): 2-3 tiết liên tiếp ở **buổi trái**, giờ mát.
- **Pairs**: môn block (TOÁN/VĂN/ANH) cần 2 tiết liền → SC4.
- **Singles**: tiết lẻ còn lại.

### 6.4. Step 2a — Đặt GDTC/GDQP buổi trái, 1 môn/ngày

GDTC/GDQP học buổi trái + giờ mát (tránh nắng — HC5). Cửa sổ tiết tính theo buổi chính của lớp [algorithm.service.ts:466-496](BE_TKB/src/algorithm/algorithm.service.ts#L466-L496):

```ts
const minP = isMorningMain ? 8 : 1;   // lớp sáng → chiều P8-10; lớp chiều → sáng P1-3
const maxP = isMorningMain ? 10 : 3;
const days = [2,3,4,5,6,7].sort((a,b) =>
    (oppDaysUsed.has(a)?1:0) - (oppDaysUsed.has(b)?1:0) || Math.random()-0.5);
//   ưu tiên ngày chưa có môn trái buổi ───┘    └─ tie-break ngẫu nhiên
```

Ràng buộc nghiệp vụ "mỗi ngày chỉ 1 môn trái buổi" cài bằng `oppDaysUsed` Set: ngày nào đã đặt thì skip.

### 6.5. Step 3 — Đặt cặp với sắp xếp ngày thông minh

Đây là heuristic tinh tế nhất. Sắp ngày theo nhiều tiêu chí xếp tầng [algorithm.service.ts:508-518](BE_TKB/src/algorithm/algorithm.service.ts#L508-L518):

```ts
const usedDays = classSubjectDays.get(csKey) || new Set();
const baseDays = [2, 3, 4, 6, 7];                     // T5 (thứ 5) tách riêng vì bị giới hạn
const freshDays = baseDays.filter(d => !usedDays.has(d));   // ngày CHƯA có môn này (ưu tiên — SC1)
const staledays = baseDays.filter(d => usedDays.has(d));    // ngày đã có
freshDays.sort((a, b) =>                                    // trong fresh: ngày ít tiết trước
    (classDayTotals.get(`${cls.id}-${a}`)||0) - (classDayTotals.get(`${cls.id}-${b}`)||0));
this.shuffleArray(staledays);
const sortedDays = [...freshDays, ...staledays, 5];   // T5 luôn cuối
```

3 tầng ưu tiên ngày: **(1) rải môn (SC1)** → (2) lấp đầy ngày trống tới 5 tiết → (3) thứ 5 cuối cùng (vì chỉ 4 tiết/buổi).

Và ưu tiên tiết theo độ quan trọng môn [algorithm.service.ts:524-530](BE_TKB/src/algorithm/algorithm.service.ts#L524-L530):

```ts
const periodsToTry: number[][] = [];
for (let p = mainStart; p < mainEnd; p++) periodsToTry.push([p, p+1]);  // mọi cặp liền kề
if (!unit.isPriority && day !== 5) periodsToTry.reverse();  // môn thường nhường tiết sớm cho môn ưu tiên
```

→ Toán/Văn/Anh được tiết sớm (đầu buổi, học sinh tỉnh táo); môn phụ đẩy về cuối. Riêng thứ 5 luôn thử tiết sớm trước (tránh tạo lỗ hổng đầu buổi vì thứ 5 ít tiết).

### 6.6. Hàm gác cổng `canPlaceAt` & `violatesBlockRule`

Mọi phép đặt đều qua 2 hàm kiểm tra. `canPlaceAt` — ràng buộc cứng cơ bản [algorithm.service.ts:309-320](BE_TKB/src/algorithm/algorithm.service.ts#L309-L320):

```ts
const canPlaceAt = (cls, assign, day, period): boolean => {
    if (classOccupied.has(`${cls.id}-${day}-${period}`)) return false;     // lớp bận
    if (day === 2 && period === 1) return false;                           // chừa chào cờ
    if (day === 5 && [5,10].includes(period)) return false;                // thứ 5 bán trú
    if (teacherOccupied.has(`${assign.teacher_id}-${day}-${period}`)) return false;  // GV bận
    if (this.constraintService.isTeacherBusy(assign.teacher_id, day, period)) return false;  // GV đăng ký bận
    const tdsKey = `${assign.teacher_id}-${day}-${period<=5?0:1}`;
    if ((teacherDaySessionCount.get(tdsKey)||0) >= 5) return false;        // GV quá tải buổi
    return true;
};
```

`violatesBlockRule` — 3 luật môn block (R1/R2/R3) [algorithm.service.ts:323-342](BE_TKB/src/algorithm/algorithm.service.ts#L323-L342):

```ts
// R1: tổng môn block ≤ 3/buổi
if (total >= 3) return true;
// R2: cùng 1 mã môn ≤ 2/buổi
if ((m.get(subjCode) || 0) >= 2) return true;
// R3: không 3 tiết block liên tiếp
const arr = [...periodsSet, period].sort((a,b)=>a-b);
for (let k = 0; k <= arr.length-3; k++)
    if (arr[k+1]===arr[k]+1 && arr[k+2]===arr[k]+2) return true;
```

> Cài ràng buộc **tại điểm đặt** (constraint-at-placement) thay vì để Phase 3 dọn. Greedy chủ động né vi phạm → ít việc cho SA. Đây là "fail fast" cho tổ hợp.

### 6.7. Cơ chế fallback nhiều tầng

Khi không đặt được, không bỏ cuộc mà **giáng cấp** đơn vị đặt:
- Cặp đặt thất bại → tách thành 2 single đẩy vào cuối hàng đợi [algorithm.service.ts:547-551](BE_TKB/src/algorithm/algorithm.service.ts#L547-L551).
- GDTC/GDQP block thất bại → đẩy vào `oppositeSlots[]` xử lý ở Step 5.

→ Thiết kế **degradation graceful**: ưu tiên chất lượng cao (cặp liền) nhưng luôn có đường lui để mọi tiết đều được đặt.

---

## 7. Phase 2c/2d — Post-processing: nén lịch & gán phòng lab

Sau khi Phase 2 lấp đầy, hai bước hậu xử lý chạy nối tiếp [algorithm.service.ts:635-636](BE_TKB/src/algorithm/algorithm.service.ts#L635-L636):

```ts
this.phase2c_CompactMainSession(solution, data);  // dồn tiết về đầu buổi
this.phase2d_AssignLabRooms(solution, data);       // gán phòng thực hành
```

### 7.1. Phase 2c — Nén buổi học (Compaction), chống lỗ hổng đầu buổi

Greedy có thể để trống tiết 1-2 rồi xếp tiết 4-5 → học sinh "thủng" giờ đầu. Phase 2c kéo tiết muộn lấp vào ô trống sớm [phase2c — algorithm.service.ts:697-763](BE_TKB/src/algorithm/algorithm.service.ts#L697-L763):

```ts
for (let target = mainStart; target <= mainEnd; target++) {
    if (slotsByPeriod.has(target)) continue;        // ô đã có tiết, bỏ qua
    if (day === 5 && (target===5 || target===10)) continue;  // thứ 5 chặn
    // Tìm tiết ở period muộn hơn để kéo lên target
    for (let later = mainEnd; later > target; later--) {
        const cand = slotsByPeriod.get(later);
        if (!cand || cand.isLocked) continue;
        if (this.constraintService.isTeacherBusy(cand.teacherId, day, target)) continue;
        if (/* GV trùng giờ tại target */) continue;
        if (isBlock(candCode) && makesThreeConsecutive(...)) continue;  // không tạo 3-liên-tiếp
        if (hasPairPartner(cand)) continue;          // không phá cặp SC4 đang có
        // → kéo cand từ later về target
        cand.period = target;
        moved++;
    }
}
```

3 lớp bảo vệ khi di chuyển — đảm bảo nén **không tạo vi phạm mới**:
1. `isTeacherBusy` + check trùng giờ GV → không tạo HC mới.
2. `makesThreeConsecutive` → không tạo 3 tiết block liên tiếp (R3).
3. `hasPairPartner` → không tách rời một cặp đang liền kề (giữ SC4).

> Đây là **local repair có ràng buộc**: cải thiện một mục tiêu mềm (nén lịch) mà tuyệt đối không hi sinh ràng buộc khác. Mỗi phép move đều kiểm tra side-effect trước khi commit.

### 7.2. Phase 2d — Gán phòng lab dùng chung (Shared Resource Allocation)

Đây là bước **duy nhất** thực sự tôn trọng `period_type === 'PRACTICE'`. Phòng lab ít, dùng chung nhiều lớp → phải theo dõi chiếm dụng theo (phòng, ngày, tiết) [phase2d — algorithm.service.ts:648-694](BE_TKB/src/algorithm/algorithm.service.ts#L648-L694):

```ts
const practicePairs = new Set<string>();          // (lớp,môn) nào cần lab
for (const a of data.assignments)
    if (a.period_type === 'PRACTICE') practicePairs.add(`${a.class_id}-${a.subject_id}`);

const labOccupied = new Set<string>();             // "roomId-day-period" — chống trùng lab
for (const slot of solution.slots) {
    if (slot.isLocked) continue;
    const needsLab = subj.is_practice || practicePairs.has(`${slot.classId}-${slot.subjectId}`);
    if (!needsLab) continue;
    const candidates = this.constraintService.getValidRooms(grade, session, slot.period, 'THUC_HANH', code);
    const free = candidates.find(rid => !labOccupied.has(`${rid}-${slot.day}-${slot.period}`));
    if (free !== undefined) {
        slot.roomId = free;
        labOccupied.add(`${free}-${slot.day}-${slot.period}`);   // chiếm chỗ
    } else if (candidates.length > 0) {
        // hết lab trống → giữ phòng cố định làm fallback (log cảnh báo)
    }
}
```

### 7.3. Logic chọn phòng theo môn — `getValidRooms`

Quy tắc ánh xạ môn → phòng [constraint.service.ts:103-128](BE_TKB/src/algorithm/constraint.service.ts#L103-L128):

```ts
if (['GDTC','GDQP'].includes(code)) return [SAN_BANH, SAN_TDTT];   // sân bãi
if (subjectType === 'THUC_HANH') {
    if (code.includes('TIN'))  return [314, 315];                  // lab Tin
    if (code.includes('LY'))   return [301];                       // lab Lý
    if (code.includes('HOA'))  return [302];                       // lab Hóa
    if (code.includes('SINH')) return [303];                       // lab Sinh
}
// Phòng lý thuyết: theo khối + buổi (khối 12 sáng → tầng 1, khối 10 → tầng 2...)
if (grade===12 && isMorningPeriod) return getRangeRoomIds(101, 114);
```

> **Vì sao `code.includes()` chứ so bằng `===`?** Vì mã môn thật có biến thể: `VAT_LY`, `LY` đều phải khớp lab Lý. Dùng `includes` là **fuzzy match có chủ đích** — đánh đổi độ chính xác lấy độ bền với dữ liệu bẩn. Toàn bộ `subject-rules.ts` theo nguyên tắc này (xem mục 9.5).

---

## 8. Phase 3 — Hill Climbing + Simulated Annealing + Tabu Search

Code: [phase3_Genetic — algorithm.service.ts:765-1148](BE_TKB/src/algorithm/algorithm.service.ts#L765-L1148). Tên hàm là "Genetic" mang tính lịch sử; **thực chất** là tổ hợp 3 metaheuristic: Targeted Hill Climbing + Simulated Annealing + Tabu Search. Đây là pha "tinh chỉnh" — sửa vi phạm còn sót và tối ưu mục tiêu mềm.

### 8.1. Vì sao cần Phase 3 dù Phase 2 đã lấp 95%

Greedy của Phase 2 ra **cực trị địa phương** (local optimum): tốt cục bộ nhưng còn vài vi phạm không thể sửa bằng cách đặt tuần tự — vì sửa chỗ này hỏng chỗ khác, cần **hoán đổi** (swap) chứ không phải đặt mới. Bài toán chuyển từ "construction" sang "improvement":

| | Phase 2 (Construction) | Phase 3 (Improvement) |
| :--- | :--- | :--- |
| Thao tác | Đặt tiết vào ô trống | Swap (day,period) của 2 tiết |
| Mục tiêu | Lấp đầy | Giảm tổng cost |
| Vấn đề | Tham lam, kẹt cực trị | Thoát cực trị bằng SA |

### 8.2. Hàm `slotCost` — lượng hóa "độ tệ" của 1 tiết

Tim của Phase 3. Tính tổng chi phí vi phạm mà **một slot** gây ra [slotCost — algorithm.service.ts:819-948](BE_TKB/src/algorithm/algorithm.service.ts#L819-L948). Bảng trọng số:

| Loại | Vi phạm | Trọng số |
| :--- | :--- | :--- |
| **HARD** | GV trùng giờ (teacherAt.size>1) | +200 |
| | Lớp trùng giờ | +200 |
| | Phòng trùng (lab) | +200 |
| | GV đăng ký bận | +200 |
| | Thứ 5 tiết 5/10 | +200 |
| | GDTC/GDQP giờ nắng | +150 |
| | Sai buổi (HC8) | +500 ← nặng nhất |
| | Môn block R1/R2/R3 | +250 mỗi luật |
| **SOFT** | SC4 cặp bị xé lẻ | +30 |
| | SC1 dồn cục (≥3 cùng ngày) | +10 |
| | SC7 GV quá tải (>4/buổi) | +10 |
| | SC6 GV trống tiết | +5 |
| | Toán/Văn/Anh rơi thứ 5 | +15 |

Đoạn lõi phát hiện xung đột bằng index O(1):

```ts
const slotCost = (idx: number): number => {
    const s = slots[idx];
    let cost = 0;
    // HC: GV trùng — chỉ cần đọc size của Set
    const ts = teacherAt.get(tKey(s.teacherId, s.day, s.period));
    if (ts && ts.size > 1) cost += 200;
    // HC: lớp trùng
    const cs = classAt.get(cKey(s.classId, s.day, s.period));
    if (cs && cs.size > 1) cost += 200;
    // HC8: sai buổi — nặng nhất để ép sửa trước
    if (!isSessionExempt(code)) {
        const mainSess = classMainSession.get(s.classId) ?? 0;
        if ((s.period<=5?0:1) !== mainSess) cost += 500;
    }
    // ... R1/R2/R3 block, SC1/SC4/SC6/SC7 ...
    return cost;
};
```

> **Ý nghĩa thiết kế trọng số trong slotCost vs fitness**: trọng số ở đây (200/500/...) **khác** trọng số fitness (100/10) ở mục 9. `slotCost` là "la bàn" dẫn hướng SA — phải phân biệt mạnh giữa các loại lỗi để swap đi đúng hướng (sai buổi 500 > trùng giờ 200 > mềm 5-30). Còn `fitness` là "thước đo" báo cáo cuối. Hai hệ trọng số phục vụ 2 mục đích khác nhau — đừng nhầm.

> **Tính cost cục bộ, không global**: chỉ tính cost của slot `idx` (và slot `j` khi probe swap), không quét toàn bộ. Nhờ index, đánh giá một swap chỉ O(số tiết cùng lớp/GV) ≈ O(30), không phải O(1800).

---

### 8.3. Vòng lặp chính — Targeted Repair (sửa có chủ đích)

Khác hill-climbing ngây thơ (thử mọi cặp swap — O(n²) bất khả thi với n=1800), Phase 3 chỉ nhắm vào slot **đang vi phạm** [algorithm.service.ts:967-979](BE_TKB/src/algorithm/algorithm.service.ts#L967-L979):

```ts
const MAX_ROUNDS = 60;
for (let round = 0; round < MAX_ROUNDS; round++) {
    // 1. Quét tìm mọi slot có cost > 0
    const violations: {idx, cost}[] = [];
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].isLocked) continue;
        const c = slotCost(i);
        if (c > 0) violations.push({idx: i, cost: c});
    }
    if (violations.length === 0) break;            // sạch hoàn toàn → dừng sớm
    // 2. Sửa slot tệ nhất trước
    violations.sort((a, b) => b.cost - a.cost);
    const toFix = Math.min(violations.length, 3000);
    // 3. Với mỗi vi phạm, thử 3 chiến lược swap...
}
```

**Most-violating-first**: sort giảm dần theo cost, sửa slot tệ nhất trước. Đây là **greedy descent có ưu tiên** — đầu tư công sửa vào nơi giảm cost nhiều nhất. Cap `toFix = 3000` chặn blow-up khi vi phạm quá nhiều.

### 8.4. Ba chiến lược swap xếp tầng

Với mỗi slot vi phạm, thử lần lượt 3 chiến lược, mạnh dần:

**Strategy 1 — Swap trong cùng lớp** [algorithm.service.ts:987-1003](BE_TKB/src/algorithm/algorithm.service.ts#L987-L1003):

```ts
const classIdxs = classSlotsIdx.get(slots[badIdx].classId) || [];
let bestDelta = 0, bestJ = -1;
for (const j of classIdxs) {
    if (j === badIdx || slots[j].isLocked) continue;
    if (tabu.has(tabuKey)) continue;                    // né nước đi cấm
    const oldCost = currentCost + slotCost(j);
    doSwap(badIdx, j);                                  // thử
    const newCost = slotCost(badIdx) + slotCost(j);
    doSwap(badIdx, j);                                  // hoàn
    const delta = newCost - oldCost;
    if (delta < bestDelta) { bestDelta = delta; bestJ = j; }   // nhớ swap tốt nhất
}
```

Chỉ swap trong cùng lớp = đổi giờ 2 tiết của lớp đó. An toàn nhất, không lan sang lớp khác.

**Strategy 2 — Swap chéo lớp theo cùng GV** [algorithm.service.ts:1006-1022](BE_TKB/src/algorithm/algorithm.service.ts#L1006-L1022): chỉ kích hoạt khi Strategy 1 thất bại (`bestDelta >= 0`) **và** là lỗi cứng (`currentCost >= 100`):

```ts
if (bestDelta >= 0 && currentCost >= 100) {
    const teacherIdxs = teacherSlotsIdx.get(slots[badIdx].teacherId) || [];
    for (const j of teacherIdxs) {
        if (slots[j].classId === slots[badIdx].classId) continue;  // phải khác lớp
        // ... probe swap như Strategy 1
    }
}
```

→ Cho phép GV đổi giờ giữa 2 lớp khác nhau — mạnh hơn, dùng để gỡ trùng giờ GV mà nội bộ 1 lớp không sửa được.

**Strategy 3 — Simulated Annealing (chấp nhận nước đi xấu)** [algorithm.service.ts:1025-1040](BE_TKB/src/algorithm/algorithm.service.ts#L1025-L1040):

```ts
if (bestJ < 0 && temperature > 1) {                    // không tìm được swap cải thiện
    const unlocked = classIdxs.filter(j => j!==badIdx && !slots[j].isLocked);
    const randJ = unlocked[Math.floor(Math.random()*unlocked.length)];  // chọn ngẫu nhiên
    const deltaR = /* cost sau swap ngẫu nhiên */;
    // Chấp nhận nước đi XẤU với xác suất exp(-Δ/T)
    if (deltaR <= 0 || Math.random() < Math.exp(-deltaR / temperature)) {
        bestDelta = deltaR; bestJ = randJ;
    }
}
```

> **Đây là tinh túy Simulated Annealing.** Khi kẹt cực trị địa phương (không nước nào cải thiện), thay vì bỏ cuộc, SA **chấp nhận một nước đi làm xấu đi tạm thời** với xác suất `exp(-Δ/T)`. Δ càng nhỏ (xấu ít) và T càng cao (giai đoạn đầu) → càng dễ chấp nhận. Cơ chế này cho phép "leo xuống thung lũng để vượt sang đỉnh cao hơn" — thoát bẫy mà hill-climbing thuần không làm được.

### 8.5. Lịch làm nguội (Cooling Schedule)

[algorithm.service.ts:964-1051](BE_TKB/src/algorithm/algorithm.service.ts#L964-L1051):

```ts
let temperature = 50;            // nhiệt độ ban đầu cao → chấp nhận nhiều nước xấu
const coolingRate = 0.92;
// ... cuối mỗi round:
temperature *= coolingRate;      // làm nguội hình học (geometric cooling)
```

Làm nguội kiểu **nhân hằng số** (geometric): `T₀=50`, sau mỗi round `T *= 0.92`. Đầu chạy T cao → khám phá rộng (exploration); cuối chạy T→0 → chỉ nhận nước tốt, hội tụ (exploitation). Đây là cân bằng explore/exploit kinh điển của SA.

| Round | T xấp xỉ | Hành vi |
| :--- | :--- | :--- |
| 0 | 50.0 | Chấp nhận nước xấu Δ≤~35 với p>30% — khám phá mạnh |
| 10 | 21.7 | Bắt đầu kén chọn |
| 30 | 4.1 | Gần như chỉ nhận nước tốt |
| 50+ | <1 | Tắt SA (điều kiện `temperature > 1`) — thuần hill climbing |

### 8.6. Tabu Search — bộ nhớ chống lặp vô hạn

Không có Tabu, SA có thể swap A↔B rồi B↔A mãi mãi. `tabu` Set ghi nhớ các cặp vừa swap để cấm lặp lại [algorithm.service.ts:1042-1048](BE_TKB/src/algorithm/algorithm.service.ts#L1042-L1048):

```ts
const tabuKey = `${Math.min(badIdx,bestJ)}-${Math.max(badIdx,bestJ)}`;  // chuẩn hóa cặp
tabu.add(tabuKey);
if (tabu.size > 5000) {                              // giới hạn bộ nhớ → quên cái cũ nhất
    const first = tabu.values().next().value;
    if (first) tabu.delete(first);
}
```

Hai chi tiết kỹ thuật:
- **Chuẩn hóa key**: `min-max` đảm bảo cặp (3,7) và (7,3) cùng một key → cấm cả 2 chiều.
- **Tabu tenure bằng FIFO cap 5000**: khi đầy, xóa phần tử cũ nhất (`Set` giữ thứ tự chèn trong JS) → "quên dần" để nước đi cũ có thể tái dùng sau. Đây là **tabu list có thời hạn**, tránh cấm vĩnh viễn làm bí nước.

### 8.7. Điều kiện dừng kép

```ts
let staleCount = 0;
// ... cuối round:
if (roundImproved === 0) {
    staleCount++;
    if (staleCount >= 5) break;     // 5 round liên tiếp không cải thiện → dừng
} else staleCount = 0;
```

Dừng khi: **(1)** sạch vi phạm (`violations.length===0`), **(2)** đủ 60 round, hoặc **(3)** 5 round liền không tiến bộ (stale). Điều kiện stale tránh đốt CPU khi đã hội tụ.

### 8.8. Phase 3b — Pass chuyên trị SC4 (Pair-Merge)

Sau vòng lặp chính, một pass riêng cố ghép các tiết môn block thành cặp liền kề [algorithm.service.ts:1067-1141](BE_TKB/src/algorithm/algorithm.service.ts#L1067-L1141):

```ts
for (const [classId, classIdxList] of classSlotsIdx) {
    // Gom slot theo môn (chỉ môn block)
    // Nếu môn có ≥2 tiết NHƯNG chưa có cặp liền kề nào:
    //   tìm tiết cùng môn ở ngày khác, swap nó vào ô liền kề để tạo cặp
    if (newCost < oldCost) { sc4Fixed++; hasPair = true; }
    else doSwap(idxB, targetIdx);   // không lợi → hoàn lại
}
```

> Vì sao tách pass riêng? SC4 (cặp xé lẻ) là mục tiêu mềm dễ bị vòng chính bỏ qua (cost chỉ +30). Pass chuyên biệt này quét có hệ thống từng môn block, đảm bảo Toán/Văn/Anh được xếp 2 tiết liền — yêu cầu sư phạm quan trọng. Vẫn theo nguyên tắc **probe-then-commit** (chỉ giữ swap nếu giảm cost).

---

## 9. Hàm Fitness & hệ thống Constraint

Code: [constraint.service.ts](BE_TKB/src/algorithm/constraint.service.ts), [subject-rules.ts](BE_TKB/src/algorithm/subject-rules.ts).

### 9.1. Hai vai trò của ConstraintService

`ConstraintService` đóng 2 vai khác nhau, phục vụ 2 pha:
- **Lúc chạy thuật toán**: cung cấp `isTeacherBusy`, `getSubjectCode`, `getValidRooms`, `checkFixedSlot` — các hàm tra cứu O(1).
- **Lúc chấm điểm**: `checkHardConstraints` (đếm lỗi), `calculatePenalty` (tổng phạt mềm), `getFitnessDetails` (sinh báo cáo cho UI).

### 9.2. Danh mục ràng buộc cứng (HC) — 8 luật

| Mã | Tên | Cách phát hiện |
| :--- | :--- | :--- |
| HC1 | GV trùng giờ | `groupBy(teacherId)` → đếm overlap (day,period) |
| HC2 | Lớp trùng giờ | `groupBy(classId)` |
| HC3 | Phòng trùng | `groupBy(roomId)`, skip null/undefined |
| HC4 | GV bị xếp khi bận | `isTeacherBusy()` |
| HC5 | GDTC/GDQP giờ nắng | sáng>3 hoặc chiều<8 |
| HC6 | Môn block R1/R2/R3 | đếm môn nặng/buổi + 3-liên-tiếp |
| HC7 | Thứ 5 tiết 5/10 | `day===5 && period∈{5,10}` |
| HC8 | Sai buổi | `slotSession !== class.main_session` (trừ môn exempt) |

Kỹ thuật đếm overlap dùng lại khắp HC1/2/3 [constraint.service.ts:239-250](BE_TKB/src/algorithm/constraint.service.ts#L239-L250):

```ts
private countTimeOverlaps(slots: TimeSlot[]): number {
    let overlaps = 0;
    const timeMap = new Map<string, number>();
    for (const s of slots) {
        const key = `${s.day}-${s.period}`;
        timeMap.set(key, (timeMap.get(key) || 0) + 1);   // đếm số tiết tại mỗi ô
    }
    for (const count of timeMap.values())
        if (count > 1) overlaps += (count - 1);          // n tiết cùng ô = n-1 lỗi
    return overlaps;
}
```

> Công thức `n-1`: nếu 3 lớp dùng cùng 1 phòng tại 1 ô → 2 lỗi (1 hợp lệ, 2 thừa). Đếm "số phải dời đi" chứ không "số ô bị đụng".

### 9.3. Danh mục ràng buộc mềm (SC) & trọng số

[calculatePenalty — constraint.service.ts:253-264](BE_TKB/src/algorithm/constraint.service.ts#L253-L264):

```ts
score += this.checkSpreadSubjects(classSchedule) * 10;   // SC1 dồn cục
score += this.checkBlock2(classSchedule) * 10;           // SC4 cặp xé lẻ
score += this.checkNoHoles(teacherSchedule) * 5;         // SC6 tiết trống GV
score += this.checkMaxLoad(teacherSchedule) * 10;        // SC7 quá tải GV
```

### 9.4. Thuật toán đếm "spread" thông minh (SC1)

Không phải cứ cùng môn cùng ngày là phạt — **cặp 2 tiết liền là hợp lệ** (đúng yêu cầu block). Ngưỡng phạt dùng `ceil(n/2)` [constraint.service.ts:277-296](BE_TKB/src/algorithm/constraint.service.ts#L277-L296):

```ts
for (const [, days] of subjectMap) {
    if (days.length > 2) {
        const uniqueDays = new Set(days).size;
        // ceil(n/2): mỗi cặp trên 1 ngày = 1 "đơn vị phân bố" hợp lệ
        if (uniqueDays < Math.ceil(days.length / 2)) penalty++;
    }
}
```

Ví dụ: môn 4 tiết, cần rải ≥`ceil(4/2)=2` ngày. Nếu xếp 2 cặp ở 2 ngày → `uniqueDays=2 ≥ 2` → OK. Nếu dồn cả 4 vào 1 ngày → `uniqueDays=1 < 2` → phạt. Phân biệt "block hợp lý" với "dồn cục thật".

### 9.5. `subject-rules.ts` — Single Source of Truth cho phân loại môn

[subject-rules.ts](BE_TKB/src/algorithm/subject-rules.ts) là refactor quan trọng: gom mọi danh sách phân loại môn vào **một nơi**, dùng chung giữa `algorithm.service.ts` và `constraint.service.ts`:

```ts
export const HEAVY_CODES   = ['TOAN','VAN','NGU_VAN','ANH','TIENG_ANH','LY','VAT_LY','HOA','HOA_HOC'];
export const BLOCK_CODES   = ['TOAN','VAN','NGU_VAN','ANH','TIENG_ANH'];
export const OUTDOOR_CODES = ['GDTC','GDQP','QUOC_PHONG'];
export const OPPOSITE_ALLOWED_CODES = ['GDTC','GDQP','QUOC_PHONG','HDTN','GDDP'];

const includesAny = (code, list) => list.some(c => code.includes(c));
export const isBlock = (code) => includesAny(code, BLOCK_CODES);
export const isSessionExempt = (code) => isOppositeAllowed(code) || isSpecialBypass(code);
```

> **Vì sao tách file này ra (bug history)?** Comment đầu file ghi rõ: trước đây các list bị **copy-paste** giữa 2 service với khác biệt tinh vi (nhất là tập "cho phép trái buổi" của HC8) → khiến **fitness lưu, violation hiển thị, và cost Phase 3 mâu thuẫn nhau**. Cùng một TKB nhưng 3 nơi chấm 3 kiểu. Gom về một file diệt tận gốc lớp bug "định nghĩa lệch nhau". Đây là minh họa kinh điển nguyên tắc **DRY cho business rule**.

Kỹ thuật `code.includes(x)` trên mã UPPERCASE: cố ý cho "VAT_LY" khớp "LY", "TIENG_ANH" khớp "ANH" — bền với biến thể đặt mã môn.

### 9.6. `getFitnessDetails` — sinh báo cáo song ngữ cho UI

Khác `checkHardConstraints` (chỉ trả số đếm), `getFitnessDetails` [constraint.service.ts:513-796](BE_TKB/src/algorithm/constraint.service.ts#L513-L796) sinh:

```ts
return {
    score,                    // điểm số
    details: string[],        // ["⛔ [HC1] Giáo viên trùng giờ: -200 điểm (2 lỗi)", ...]
    violations: [{ type, rule, msg }],   // chi tiết từng lỗi, msg tiếng Việt + emoji
    hardViolations, softPenalty
};
```

Mỗi violation kèm thông điệp người-đọc-được, ví dụ: `⛔ GV "Nguyễn Văn A" dạy 2 lớp [10A1, 10A2] cùng lúc tại T2 tiết 3`. Tách biệt **logic chấm điểm** (cho thuật toán) với **diễn giải** (cho người) — cùng dữ liệu, 2 đầu ra.

### 9.7. Nhất quán giữa optimizer và evaluator

Điểm sống còn: `slotCost` (Phase 3, mục 8.2) và `getFitnessDetails`/`checkHardConstraints` (chấm điểm) **phải đồng thuận** về cái gì là vi phạm. Cả hai cùng import từ `subject-rules.ts` và cùng quy ước session/period. Nếu lệch → thuật toán "sửa" theo `slotCost` nhưng `fitness` vẫn báo lỗi → loop vô nghĩa. Đây là lý do mục 9.5 tồn tại.

---

## 10. Kỹ thuật tối ưu hiệu năng

Tổng hợp mọi kỹ thuật làm thuật toán chạy giây thay vì phút.

### 10.1. Bảng tổng kết các kỹ thuật

| Kỹ thuật | Vị trí | Hiệu quả |
| :--- | :--- | :--- |
| String-key hash index (Set/Map) | toàn bộ Phase 2/3 | Kiểm tra xung đột O(n) → O(1) |
| Index theo thực thể (`classSlotsIdx`) | Phase 3 | Quét tiết-của-1-lớp O(n) → O(30) |
| Incremental index maintain (`addSlot`/`addIdx`) | Phase 2/3 | Không rebuild toàn bộ mỗi thao tác |
| Probe-then-commit (`doSwap` ×2) | Phase 3 | Đánh giá swap không cần copy mảng |
| Targeted repair (chỉ slot vi phạm) | Phase 3 | Tránh O(n²) thử mọi cặp |
| Cap `toFix=3000`, `tabu=5000` | Phase 3 | Chặn blow-up bộ nhớ/thời gian |
| Lazy memoization (`getSubjectCode`) | ConstraintService | Tính 1 lần, cache mãi |
| `Promise.all` load 5 query | `loadData` | Query song song thay vì tuần tự |
| Batch insert `createMany` | save | 1 round-trip thay vì N |
| Dừng sớm (stale/zero-violation) | Phase 3 | Không đốt CPU khi đã hội tụ |

### 10.2. Load dữ liệu song song

[loadData — algorithm.service.ts:108-120](BE_TKB/src/algorithm/algorithm.service.ts#L108-L120):

```ts
const [teachers, rooms, assignments, classes, subjects] = await Promise.all([
    this.prisma.teacher.findMany({ include: { constraints: true } }),
    this.prisma.room.findMany(),
    this.prisma.teachingAssignment.findMany({ where: { semester_id }, include: { subject: true } }),
    this.prisma.class.findMany({ include: { fixed_room: true, homeroom_teacher: true } }),
    this.prisma.subject.findMany()
]);
```

5 query độc lập chạy đồng thời. Thời gian = max(5 query) thay vì tổng. Eager-load quan hệ (`include`) để tránh N+1 query về sau.

### 10.3. Template-week expansion — tách compute khỏi storage

Thuật toán làm việc trên **1 tuần mẫu** (~60 slot/lớp). Lúc lưu mới nhân ra đủ tuần [saveToDatabase — algorithm.service.ts:1167-1242](BE_TKB/src/algorithm/algorithm.service.ts#L1167-L1242):

```ts
let numWeeks = 18;   // tính từ ngày bắt đầu/kết thúc học kỳ
if (semester?.start_date && semester?.end_date) {
    numWeeks = Math.max(1, Math.ceil(
        (semester.end_date - semester.start_date) / (7*24*3600*1000)));
}
// Nhân slot mẫu × số tuần
for (let week = 1; week <= numWeeks; week++)
    for (const s of solution.slots)
        slotsToCreate.push({ ...s, week });

await this.prisma.timetableSlot.createMany({ data: slotsToCreate, skipDuplicates: true });
```

> Tối ưu kép: **(1)** thuật toán chỉ xử lý 1800 slot thay vì 1800×18; **(2)** lưu DB qua 1 lệnh `createMany` batch. `skipDuplicates:true` tận dụng 3 unique constraint làm lưới chống trùng tầng DB.

### 10.4. Prune bản cũ — chống phình DB

Mỗi lần chạy sinh 1800×18 ≈ 32k slot. Không dọn thì DB phình vô hạn. Kỹ thuật: **lưu bản mới trước, xóa bản cũ sau** [algorithm.service.ts:1187-1235](BE_TKB/src/algorithm/algorithm.service.ts#L1187-L1235):

```ts
const oldTimetables = await this.prisma.generatedTimetable.findMany({
    where: { semester_id }, select: { id: true }
});
// ... tạo timetable mới + createMany slots ...
if (oldTimetables.length > 0) {
    await this.prisma.generatedTimetable.deleteMany({
        where: { id: { in: oldTimetables.map(t => t.id) } }
    });   // slot con cascade-delete theo
}
```

Thứ tự **save-then-prune** (không phải prune-then-save) đảm bảo: nếu save lỗi giữa chừng, bản cũ vẫn còn → không mất dữ liệu. An toàn giao dịch thủ công.

### 10.5. moveSlot — né unique constraint bằng vị trí tạm

Kéo-thả đổi chỗ 2 tiết: nếu update trực tiếp sẽ vi phạm `unique_class_slot` (2 tiết cùng (class,day,period) nửa chừng). Giải bằng vị trí tạm `(0,0)` trong transaction [algorithm.service.ts:1263-1277](BE_TKB/src/algorithm/algorithm.service.ts#L1263-L1277):

```ts
await this.prisma.$transaction(async (tx) => {
    await tx.timetableSlot.update({ where:{id:sourceSlot.id}, data:{ day:0, period:0 }});   // 1. nguồn → tạm
    await tx.timetableSlot.update({ where:{id:targetSlot.id}, data:{ day:sourceSlot.day, period:sourceSlot.period, is_locked:true }});  // 2. đích → chỗ nguồn cũ
    await tx.timetableSlot.update({ where:{id:sourceSlot.id}, data:{ day:newDay, period:newPeriod, is_locked:true }});  // 3. nguồn → chỗ mới
});
```

Vị trí `(0,0)` không hợp lệ về nghiệp vụ nên không bao giờ đụng slot thật → dùng làm "bãi đỗ tạm". Kinh điển khi swap dưới ràng buộc unique. Cả 3 bước trong 1 transaction → atomic, lỗi thì rollback toàn bộ.

---

## 11. Bảo mật — Captcha HMAC, JWT, bcrypt, Guards

Code: [auth.service.ts](BE_TKB/src/auth/auth.service.ts), [jwt-auth.guard.ts](BE_TKB/src/auth/jwt-auth.guard.ts), [admin.guard.ts](BE_TKB/src/auth/admin.guard.ts).

### 11.1. Captcha stateless bằng HMAC-SHA256 — kỹ thuật đáng chú ý nhất

Captcha thường cần lưu đáp án ở server (session/Redis). Ở đây dùng **HMAC để stateless** — không lưu gì [auth.service.ts:18-42](BE_TKB/src/auth/auth.service.ts#L18-L42):

```ts
createCaptcha() {
    const captcha = svgCaptcha.create({ size: 4, noise: 2, color: true });
    const hash = crypto.createHmac('sha256', this.SECRET)
        .update(captcha.text.toLowerCase())     // băm đáp án với secret
        .digest('hex');
    return { img: captcha.data, sessionId: hash };   // gửi ảnh + hash cho client
}

validateCaptcha(code: string, sessionId: string): boolean {
    const hash = crypto.createHmac('sha256', this.SECRET)
        .update(code.toLowerCase())             // băm input người dùng
        .digest('hex');
    return hash === sessionId;                   // khớp = đúng captcha
}
```

> **Cơ chế**: server không lưu đáp án. Nó gửi `hash = HMAC(secret, đáp_án)` cho client làm "sessionId". Khi submit, client gửi lại `code` (đáp án người gõ) + `sessionId`. Server băm `code` rồi so với `sessionId`. Khớp ⟹ đúng. Vì client không biết `secret`, **không thể giả mạo** một cặp (code, hash) hợp lệ.
>
> **Đánh đổi**: đơn giản, scale ngang vô tư (không cần shared session store), nhưng **không có hạn dùng/one-time** — cùng một sessionId tái dùng được. Chấp nhận được cho captcha chống bot cơ bản. `toLowerCase()` cả 2 đầu → captcha không phân biệt hoa thường.

### 11.2. Mật khẩu — bcrypt với salt tự sinh

[auth.service.ts:44-70, 105-121](BE_TKB/src/auth/auth.service.ts#L44-L70):

```ts
const isMatch = await bcrypt.compare(pass, user.password_hash);   // so sánh constant-time
// ... đổi mật khẩu:
const hashedNew = await bcrypt.hash(newPassword, 10);   // 10 rounds = 2^10 lần lặp
```

- `bcrypt.hash(pw, 10)`: salt ngẫu nhiên nhúng trong hash, 2¹⁰ vòng → chậm có chủ đích, chống brute-force.
- `bcrypt.compare`: so sánh **constant-time**, chống timing attack.
- Fallback plain-text **đã được gỡ** (comment ghi rõ ở dòng 52-55) — tech debt đã xử lý.

### 11.3. JWT — token có ký số, hết hạn 1 ngày

[auth.service.ts:72-78](BE_TKB/src/auth/auth.service.ts#L72-L78):

```ts
async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return { access_token: this.jwtService.sign(payload), user };
}
```

Payload chứa `sub` (userId), `role`, `username`. Ký bằng `JWT_SECRET`, hết hạn `1d` (cấu hình ở module). Client gửi kèm `Authorization: Bearer <jwt>` mỗi request.

### 11.4. Guard pattern — phân tầng phân quyền

Hai guard implement `CanActivate` của NestJS. `JwtAuthGuard` — xác thực + nạp `req.user` [jwt-auth.guard.ts:27-42](BE_TKB/src/auth/jwt-auth.guard.ts#L27-L42):

```ts
canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Thiếu Authorization header');
    try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        request.user = payload;    // gắn payload vào request cho downstream dùng
        return true;
    } catch {
        throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
}
```

`AdminGuard` — kế thừa ý tưởng + thêm tầng role [admin.guard.ts:21-39](BE_TKB/src/auth/admin.guard.ts#L21-L39):

```ts
payload = this.jwtService.verify<JwtPayload>(token);
request.user = payload;
if (payload.role !== 'ADMIN')
    throw new ForbiddenException('Chỉ quản trị viên mới có quyền thực hiện thao tác này');
return true;
```

> **Phân biệt 401 vs 403**: token sai/thiếu → `UnauthorizedException` (401, "anh là ai?"). Token đúng nhưng không phải admin → `ForbiddenException` (403, "anh không đủ quyền"). Đúng chuẩn HTTP semantics. Áp guard bằng decorator `@UseGuards(AdminGuard)` trên route quản trị (tạo/xóa user) → chặn teacher leo thang đặc quyền.

### 11.5. Chiến lược phòng thủ theo lớp (Defense in Depth)

| Lớp | Biện pháp |
| :--- | :--- |
| Nhập liệu | Captcha HMAC chống bot |
| Xác thực | bcrypt hash + constant-time compare |
| Phiên | JWT ký số, hết hạn 1d |
| Phân quyền | JwtAuthGuard → AdminGuard (role check) |
| Tầng DB | unique constraint, FK, cascade |

---

## 12. Worker/Queue — BullMQ + fallback đồng bộ

Code: [algorithm.producer.ts](BE_TKB/src/worker/algorithm.producer.ts), [algorithm.processor.ts](BE_TKB/src/worker/algorithm.processor.ts).

### 12.1. Vì sao cần queue

Thuật toán chạy vài giây tới vài chục giây. Nếu chạy thẳng trong HTTP handler:
- Block event loop → các request khác chờ.
- Timeout HTTP (thường 30-60s) có thể cắt giữa chừng.
- Không theo dõi tiến độ được.

→ Đẩy vào **BullMQ** (queue trên Redis): HTTP trả `jobId` ngay, worker xử lý nền, client poll tiến độ.

### 12.2. Kỹ thuật đáng giá nhất — Graceful Fallback khi không có Redis

Hệ thống **không bắt buộc** Redis. Nếu Redis chết, tự động chạy đồng bộ [algorithm.producer.ts:19-45](BE_TKB/src/worker/algorithm.producer.ts#L19-L45):

```ts
async startOptimization(semesterId: string) {
    const isRedisAvailable = await this.checkRedis();
    if (isRedisAvailable) {
        try {
            const job = await this.optimizationQueue.add('optimize-schedule', { semesterId, params });
            return { message: 'Optimization started', jobId: job.id, semesterId };
        } catch (error) {
            this.logger.warn('Queue add failed, falling back to direct mode');
        }
    }
    // FALLBACK: chạy trực tiếp, không queue
    const result = await this.algorithmService.runAlgorithm(semesterId);
    return { jobId: 'direct-' + Date.now(), directResult: true, success: result.success };
}
```

### 12.3. Health-check Redis với timeout race

Không thể chờ Redis vô hạn. Dùng `Promise.race` đặt deadline 1s [algorithm.producer.ts:47-59](BE_TKB/src/worker/algorithm.producer.ts#L47-L59):

```ts
private async checkRedis(): Promise<boolean> {
    try {
        const client = await (this.optimizationQueue as any).client;
        if (!client) return false;
        const result = await Promise.race([
            client.ping(),                                                    // ping thật
            new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000))  // deadline
        ]);
        return result === 'PONG';
    } catch {
        return false;
    }
}
```

> **`Promise.race` làm timeout**: hai promise đua nhau — `ping()` trả 'PONG' hoặc timeout reject sau 1s. Cái nào xong trước thắng. Nếu Redis treo, không chờ mãi mà bỏ sau 1s → fallback ngay. Đây là pattern timeout chuẩn trong JS khi API gốc không hỗ trợ timeout.

### 12.4. Marker `direct-` — phân biệt job nền vs đồng bộ

Vì 2 chế độ, cần phân biệt khi client hỏi trạng thái [algorithm.producer.ts:61-74](BE_TKB/src/worker/algorithm.producer.ts#L61-L74):

```ts
async getJobStatus(jobId: string) {
    if (jobId.startsWith('direct-')) {
        return { id: jobId, state: 'completed', progress: 100, result: { success: true } };
    }
    const job = await this.optimizationQueue.getJob(jobId);
    const state = await job.getState();
    return { id: job.id, state, progress: job.progress, result: job.returnvalue };
}
```

Job `direct-*` đã chạy xong đồng bộ ngay lúc gọi → luôn trả `completed`. Job thật → tra trạng thái BullMQ. FE chỉ cần một API `getJobStatus`, không cần biết chế độ nào. **Encapsulation**: che giấu sự khác biệt sau interface chung.

### 12.5. Processor — consumer pattern của NestJS BullMQ

`AlgorithmProcessor` extends `WorkerHost`, auto-instantiate khi register queue. Decorator `@Processor('optimization')` gắn vào queue. Method `process(job)` được BullMQ gọi cho mỗi job, ủy thác về `algorithmService.runAlgorithm()`. Hiện 1 worker concurrent — tăng `concurrency` trong decorator để chạy song song.

### 12.6. Sơ đồ luồng đầy đủ

```
POST /algorithm/start
   │
   ▼
Producer.startOptimization()
   ├─ checkRedis() ── ping vs timeout 1s ──┐
   │                                        │
   ├─ Redis OK ──► queue.add() ──► return {jobId}
   │                  │                     
   │                  ▼ (nền)               
   │            Processor.process(job)      
   │                  └─► runAlgorithm()    
   │                                        
   └─ Redis chết ─► runAlgorithm() đồng bộ ─► return {jobId:'direct-...', directResult:true}

FE: nếu directResult → load kết quả ngay; nếu có jobId → poll getJobStatus mỗi 2s
```

---

## 13. Pipeline Excel — parse, alias, validate, transaction

Code: [excel.service.ts](BE_TKB/src/excel/excel.service.ts), [excel.utils.ts](BE_TKB/src/excel/excel.utils.ts), [excel.constants.ts](BE_TKB/src/excel/excel.constants.ts). Thư viện: **ExcelJS 4.4**.

### 13.1. Bài toán — dữ liệu người dùng nhập tay rất bẩn

GV nhập Excel theo trăm kiểu: "Mã GV"/"MGV"/"Ma"; "Toán"/"TOANHOC"/"MATH"; sheet "Phân công"/"Bảng phân công giảng dạy". Pipeline phải **chuẩn hóa khoan dung** (lenient normalization) trước khi map vào schema cứng.

### 13.2. `normalizeKey` — vũ khí chuẩn hóa chuỗi tiếng Việt

Hàm nền tảng, gọi ở mọi nơi cần so khớp [excel.utils.ts:3-10](BE_TKB/src/excel/excel.utils.ts#L3-L10):

```ts
export function normalizeKey(value: string): string {
  return (value ?? '')
    .normalize('NFD')                          // tách dấu khỏi chữ (é → e + ´)
    .replace(/[̀-ͯ]/g, '')           // xóa toàn bộ dấu thanh/mũ
    .replace(/[đĐ]/g, 'd')                      // đ → d (NFD không tách được đ)
    .replace(/[^a-zA-Z0-9]/g, '')              // bỏ space, gạch, ký tự đặc biệt
    .toLowerCase();
}
```

> **Kỹ thuật Unicode NFD**: "Tiếng Việt" → chuẩn hóa NFD tách "ế" thành "e" + ký tự dấu tổ hợp (U+0300-036F) → regex xóa dấu → "Tieng Viet". Riêng "đ" không tách được bằng NFD nên thay tay. Kết quả: "Mã GV", "MÃ GV ", "ma_gv" đều → `"magv"`. Mọi so khớp diễn ra trên dạng đã chuẩn hóa → bất biến với hoa/thường/dấu/space.

### 13.3. Hệ alias 3 tầng

Ba lớp alias map biến thể người dùng → khóa chuẩn:

**Tầng 1 — Sheet alias** [excel.service.ts:1590-1594](BE_TKB/src/excel/excel.service.ts#L1590-L1594): match tên sheet ("Phan_cong" / "Bảng phân công giảng dạy..." đều ra sheet phân công) qua `SHEET_ALIASES`.

**Tầng 2 — Header alias**: match tên cột. `HEADER_ALIASES.teachers` map `magv|mgv|ma|teachercode → code`. Đọc header row, `normalizeKey` từng cell, tra alias → biết cột nào là gì, **bất kể thứ tự cột**.

**Tầng 3 — Subject alias** [excel.service.ts:1686-1704](BE_TKB/src/excel/excel.service.ts#L1686-L1704): mỗi môn trong `SUBJECT_CATALOG` có mảng `aliases`. Build map ngược:

```ts
subjectAliasMap.set(normalizeKey(item.code), item.code);   // "toan" → "TOAN"
subjectAliasMap.set(normalizeKey(item.name), item.code);   // "toán" → "TOAN"
item.aliases?.forEach(a => subjectAliasMap.set(normalizeKey(a), item.code));  // "math" → "TOAN"
```

→ "Toán", "TOANHOC", "MATH" đều resolve về mã chuẩn "TOAN". Catalog cố định 17 môn GDPT 2018, mỗi môn nhiều alias.

### 13.4. Import an toàn — toàn bộ trong 1 transaction

Validate trước, ghi sau, **all-or-nothing** [excel.service.ts:278-412](BE_TKB/src/excel/excel.service.ts#L278-L412):

```ts
async importWorkbook(academicYearId: string, buffer: Buffer) {
    // 1. Parse + validate (KHÔNG đụng DB)
    //    - check 4 sheet bắt buộc tồn tại
    //    - dedupe, cross-ref (GV chủ nhiệm có tồn tại?), tổng số tiết hợp lệ?
    //    - nếu errors > 0 → return {success:false, errors} + notifyImportFailed()
    // 2. Ghi DB trong MỘT transaction
    const summary = await this.prisma.$transaction(async (tx) => {
        const teacherMap = await this.upsertTeachers(tx, parsed.teachers);
        const classMap   = await this.upsertClasses(tx, parsed.classes, teacherMap);
        await this.upsertRooms(tx, parsed.rooms, classMap);
        // ... replace combinations, delete+create assignments cho cả HK1+HK2
    });
    await this.notificationService.notifyImportSuccess(summary);
}
```

> **Vì sao transaction?** Import đụng 5 bảng liên quan (teachers → classes → rooms → combinations → assignments) với FK chéo. Nếu ghi nửa chừng lỗi (vd assignment trỏ GV chưa kịp tạo) → DB ở trạng thái bẩn. `$transaction` đảm bảo **hoặc tất cả thành công, hoặc rollback sạch**. Validate-trước-ghi-sau giảm xác suất rollback (bắt lỗi logic trước khi chạm DB).

### 13.5. `upsert` — idempotent import

Dùng `prisma.upsert` (update nếu có, insert nếu chưa) thay vì insert thuần → **import lại nhiều lần an toàn**. Khóa định danh là mã đã chuẩn hóa (GV theo `code`, lớp theo `name`). Chạy import 2 lần cùng file → kết quả y hệt, không nhân đôi. Đây là tính chất **idempotency** quan trọng cho thao tác nhập liệu.

### 13.6. Export — ExcelJS styling & merge

Chiều ngược (xuất TKB/template) dùng helper style tập trung trong `excel.utils.ts`: `applyTitleRow` (merge + tô màu tiêu đề), `applyHeaderRow` (header xanh, wrap text, border), `thinBorder`. Export TKB: 1 dòng = (Thứ, Buổi, Tiết), cột = lớp, mỗi ô `tên_môn\n(tên_GV_ngắn)`, merge theo Thứ/Buổi, freeze 3 cột đầu. Tên file qua `buildAttachmentDisposition` xử lý cả ASCII fallback lẫn UTF-8 (`filename*=UTF-8''...`) để tên tiếng Việt không vỡ trên mọi browser.

### 13.7. Upload — Multer memory + validate

Controller dùng Multer `memoryStorage`, giới hạn 10MB, chỉ `.xlsx`. File vào buffer RAM (không ghi đĩa) → parse thẳng bằng ExcelJS → xử lý xong giải phóng. Phù hợp file nhỏ, tránh rác đĩa.

---

## 14. Frontend — Drag & Drop, Redux, optimistic update

Code: [TimetableGrid.tsx](FE_TKB/app/components/admin/TimetableGrid.tsx), [scheduleSlice.ts](FE_TKB/lib/features/schedule/scheduleSlice.ts), [api.ts](FE_TKB/lib/api.ts). Stack: Next 16 (App Router), React 19, Redux Toolkit, @dnd-kit, Tailwind 4.

### 14.1. Kéo-thả với @dnd-kit — kiến trúc draggable/droppable

@dnd-kit tách 2 vai bằng hook. Draggable [TimetableGrid.tsx:116-121](FE_TKB/app/components/admin/TimetableGrid.tsx#L116-L121):

```ts
const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-${slot.id}`,
    data: slot,                                  // gắn nguyên slot vào sự kiện drag
    disabled: !isEditable || !!slot.is_locked    // slot khóa KHÔNG kéo được
});
```

Droppable [TimetableGrid.tsx:153-156](FE_TKB/app/components/admin/TimetableGrid.tsx#L153-L156):

```ts
const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day}-${session}-${period}`,
    data: { day, session, period }               // gắn tọa độ đích
});
```

> **`data` payload là chìa khóa**: draggable mang theo cả object slot, droppable mang tọa độ đích. Khi thả, handler đọc `active.data` (nguồn) + `over.data` (đích) → đủ thông tin xử lý mà không cần tra cứu thêm. `disabled` ở draggable thực thi quy tắc "slot khóa bất biến" ngay tầng UI.

### 14.2. Phản hồi xung đột thời gian thực khi đang kéo

Điểm tinh tế: tính xung đột **liên tục trong lúc kéo** (`onDragOver`), tô xanh/đỏ ô đích trước khi thả [TimetableGrid.tsx:204-217](FE_TKB/app/components/admin/TimetableGrid.tsx#L204-L217):

```ts
const handleDragOver = (event: DragOverEvent) => {
    const over = event.over.data.current;
    const actualPeriod = over.session === 1 ? over.period + 5 : over.period;   // tương đối → tuyệt đối
    const conflicts = computeConflicts(activeSlotRef.current, { day: over.day, period: actualPeriod }, schedule);
    dragConflictsRef.current = conflicts;
    setDragConflicts(conflicts);
};
```

Ô đích đổi màu theo kết quả [TimetableGrid.tsx:159-163](FE_TKB/app/components/admin/TimetableGrid.tsx#L159-L163):

```ts
if (isOver) {
    cellClass = hasConflict
        ? 'bg-red-50 ring-2 ring-inset ring-red-500'      // đỏ: thả vào sẽ xung đột
        : 'bg-green-50 ring-2 ring-inset ring-green-500'; // xanh: an toàn
}
```

→ User thấy **trước** hậu quả, không cần thả rồi mới báo lỗi. UX phòng ngừa.

### 14.3. Kỹ thuật `useRef` song song `useState` — tránh stale closure

Chú ý có cả `dragConflicts` (state) lẫn `dragConflictsRef` (ref) [TimetableGrid.tsx:176-177](FE_TKB/app/components/admin/TimetableGrid.tsx#L176-L177):

```ts
const activeSlotRef = useRef<ScheduleSlot | null>(null);
const dragConflictsRef = useRef<string[]>([]);
```

> **Vì sao cần cả hai?** Event handler của @dnd-kit (`handleDragEnd`) là closure bắt giá trị state **tại thời điểm tạo** — có thể "cũ" (stale) khi sự kiện bắn. State dùng để **render** (đổi màu ô); ref dùng để **đọc giá trị mới nhất trong handler** (`handleDragEnd` đọc `dragConflictsRef.current` chứ không `dragConflicts`). Đây là pattern kinh điển né stale-closure trong React khi cần giá trị tức thời trong callback bất đồng bộ.

### 14.4. Chuyển đổi hệ tọa độ ở tầng UI

Lưới hiển thị 5 dòng/buổi (tương đối), nhưng dữ liệu lưu 1-10 (tuyệt đối). UI convert qua lại [TimetableGrid.tsx:226, 249](FE_TKB/app/components/admin/TimetableGrid.tsx#L226):

```ts
const actualToPeriod = toData.session === 1 ? toData.period + 5 : toData.period;   // hiển thị → lưu
const lookupPeriod  = session === 1 ? period + 5 : period;                          // tra slotMap
```

Cùng quy ước 2-hệ-quy-chiếu ở mục 2.4, lặp lại ở FE. Nhất quán BE↔FE là điều kiện bắt buộc.

### 14.5. Redux Toolkit — state lịch dùng chung + Immer

[scheduleSlice.ts:29-45](FE_TKB/lib/features/schedule/scheduleSlice.ts#L29-L45):

```ts
export const scheduleSlice = createSlice({
    name: 'schedule',
    initialState,
    reducers: {
        setSchedule: (state, action) => { state.data = action.payload; },
        moveLesson: (state, action) => {
            const lesson = state.data.find(s => s.id === action.payload.id);
            if (lesson) { lesson.day = action.payload.day; lesson.period = action.payload.period; }
            //          ^^^ "mutate" trực tiếp — Immer biến thành update bất biến
        },
    },
});
```

> **Immer dưới nắp**: Redux Toolkit nhúng Immer nên viết `lesson.day = ...` trông như mutate nhưng thực chất Immer tạo bản sao bất biến mới. Code ngắn gọn mà vẫn giữ nguyên tắc immutability của Redux. `moveLesson` cập nhật store cục bộ tức thì khi user kéo-thả (**optimistic update**), song song gọi API `/algorithm/move-slot` ghi DB.

### 14.6. Luồng optimistic update khi kéo-thả

```
User thả tiết
   │
   ├─► dispatch(moveLesson)        ← cập nhật Redux NGAY → UI nhảy tức thì (optimistic)
   │
   └─► POST /algorithm/move-slot   ← ghi DB nền (swap qua vị trí tạm, set is_locked)
            │
            └─ thành công → slot khóa lại, lần chạy sau bảo toàn
```

UI không chờ server → cảm giác mượt. DB đồng bộ sau. Đây là **optimistic UI** — đánh đổi rủi ro hiếm (server lỗi → lệch) lấy độ phản hồi tức thì.

### 14.7. Memo hóa lưới — `useMemo` cho slotMap

[TimetableGrid.tsx:187-193](FE_TKB/app/components/admin/TimetableGrid.tsx#L187-L193): build `slotMap` (key `day-session-period` → slot) bằng `useMemo`, chỉ rebuild khi `filteredSlots` đổi. Render ô O(1) tra map thay vì `.find()` toàn mảng mỗi ô × 60 ô. Cùng triết lý index O(1) như BE, áp cho render.

---

## 15. Tổng hợp Design Pattern toàn dự án

### 15.1. Pattern kiến trúc (Architectural)

| Pattern | Nơi áp dụng | Mục đích |
| :--- | :--- | :--- |
| **Layered (Controller-Service-Repository)** | toàn BE NestJS | Controller mỏng → Service (logic) → PrismaService (data) |
| **Dependency Injection** | mọi `@Injectable()` | NestJS IoC container tự tiêm `PrismaService`, `JwtService`... |
| **Module pattern** | 13 feature module | Đóng gói theo domain, `imports/providers/exports` rõ ràng |
| **Producer-Consumer** | Worker (BullMQ) | Tách enqueue (producer) khỏi xử lý (processor) |
| **Singleton** | `PrismaService`, cache trong `ConstraintService` | Một instance dùng chung, quản lý connection/cache |
| **Global module** | `NotificationModule` | Service dùng khắp nơi không cần import lặp |

### 15.2. Pattern thuật toán (Algorithmic)

| Pattern | Nơi | Ý nghĩa |
| :--- | :--- | :--- |
| **Construct-then-Improve** | Phase 2 → Phase 3 | Xây thô bằng greedy, tinh chỉnh bằng metaheuristic |
| **Greedy with heuristics** | Phase 2 | Tham lam có sắp xếp ưu tiên thông minh |
| **Simulated Annealing** | Phase 3 strategy 3 | Chấp nhận nước xấu `exp(-Δ/T)` để thoát cực trị |
| **Tabu Search** | Phase 3 `tabu` Set | Bộ nhớ cấm lặp nước đi |
| **Hill Climbing (targeted)** | Phase 3 vòng chính | Sửa slot vi phạm tệ nhất trước |
| **Most Constrained First** | Phase 2 step 0 (TIN) | Xử lý phần tử khó nhất trước (CSP) |
| **Probe-then-Commit** | `doSwap` ×2 | Thử-đo-hoàn rồi mới quyết |
| **Constraint-at-placement** | `canPlaceAt`, `violatesBlockRule` | Né vi phạm ngay lúc đặt |
| **Warm-start có ràng buộc** | Lock preservation | Khởi tạo từ nghiệm cũ + điểm bất động |

### 15.3. Pattern dữ liệu & hiệu năng

| Pattern | Nơi | Ý nghĩa |
| :--- | :--- | :--- |
| **String-key hash index** | toàn thuật toán | Tọa độ → chuỗi → tra Set/Map O(1) |
| **Incremental index** | `addSlot`/`addIdx`/`rmIdx` | Cập nhật tăng dần, không rebuild |
| **Lazy memoization** | `getSubjectCode` | Tính 1 lần, cache mãi |
| **Read-through cache** | `ConstraintService.initialize` | Nạp DB → Map một lần đầu pha |
| **Batch operation** | `createMany`, `Promise.all` | Gộp nhiều thao tác thành một |
| **Template expansion** | save (×numWeeks) | Tách compute (1 tuần) khỏi storage (N tuần) |
| **Save-then-prune** | `saveToDatabase` | Ghi mới trước, xóa cũ sau → an toàn |

### 15.4. Pattern chống lỗi & bền vững

| Pattern | Nơi | Ý nghĩa |
| :--- | :--- | :--- |
| **Graceful degradation** | Redis fallback, pair→single fallback | Hỏng nhánh tốt → tự lui nhánh an toàn |
| **Timeout race** | `checkRedis` `Promise.race` | Đặt deadline cho thao tác có thể treo |
| **Anti-corruption layer** | `resolveSubjectId`, alias system | Cô lập dữ liệu bẩn vào một điểm dịch |
| **Single source of truth** | `subject-rules.ts` | Diệt bug "định nghĩa lệch nhau" |
| **Defensive fallback chain** | gán GV Phase 1 | GVCN → BGH → GV[0], không bao giờ null |
| **Transaction all-or-nothing** | import Excel, moveSlot | Rollback sạch khi lỗi giữa chừng |
| **Idempotent upsert** | import Excel | Chạy lại nhiều lần cho cùng kết quả |
| **DB constraint backstop** | 3 `@@unique` | Lưới an toàn cuối tầng lưu trữ |

### 15.5. Pattern Frontend

| Pattern | Nơi | Ý nghĩa |
| :--- | :--- | :--- |
| **Optimistic update** | kéo-thả + `moveLesson` | Cập nhật UI ngay, đồng bộ DB sau |
| **Ref-alongside-state** | `dragConflictsRef` | Né stale-closure trong callback async |
| **Memoized derivation** | `useMemo` slotMap | Cache dữ liệu dẫn xuất giữa các render |
| **Immer immutable update** | Redux slice | Viết "mutate" mà giữ immutability |
| **Data-payload on DnD** | @dnd-kit `data` | Mang context theo sự kiện kéo-thả |
| **Preview-before-commit** | `onDragOver` tô màu | Cho thấy hậu quả trước khi thả |

### 15.6. Bản đồ công nghệ — tóm tắt vai trò

```
┌─────────────────── FRONTEND (FE_TKB) ───────────────────┐
│ Next.js 16 (App Router)  → routing, SSR/standalone build │
│ React 19                  → UI declarative               │
│ Redux Toolkit + Immer     → state lịch dùng chung        │
│ @dnd-kit                  → kéo-thả slot                 │
│ Tailwind 4 + CSS vars     → styling + theme dark/light   │
│ axios / fetch             → HTTP client                  │
└─────────────────────────────────────────────────────────┘
                          │ HTTP/JSON (Bearer JWT)
┌─────────────────── BACKEND (BE_TKB) ────────────────────┐
│ NestJS 11                 → framework, DI, module        │
│ Prisma 5                  → ORM, migration, type-safe    │
│ BullMQ 5                  → queue thuật toán (Redis)     │
│ Passport + JWT            → xác thực                     │
│ bcrypt                    → hash mật khẩu                │
│ svg-captcha + HMAC        → captcha stateless            │
│ ExcelJS 4.4               → import/export workbook       │
│ class-validator           → validate DTO                │
└─────────────────────────────────────────────────────────┘
                │ Prisma            │ BullMQ
┌──────────────────────┐   ┌──────────────────────┐
│ PostgreSQL 17        │   │ Redis 7              │
│ → lưu trữ chính      │   │ → job queue + cache  │
└──────────────────────┘   └──────────────────────┘
```

---

## Phụ lục — Bản đồ đọc code theo chủ đề

| Muốn hiểu... | Đọc file | Mục tài liệu này |
| :--- | :--- | :--- |
| Toàn cảnh thuật toán | [algorithm.service.ts](BE_TKB/src/algorithm/algorithm.service.ts) | §4-§8 |
| Định nghĩa ràng buộc | [constraint.service.ts](BE_TKB/src/algorithm/constraint.service.ts) | §9 |
| Phân loại môn học | [subject-rules.ts](BE_TKB/src/algorithm/subject-rules.ts) | §9.5 |
| Xác thực & phân quyền | [auth.service.ts](BE_TKB/src/auth/auth.service.ts), [admin.guard.ts](BE_TKB/src/auth/admin.guard.ts) | §11 |
| Queue & worker | [algorithm.producer.ts](BE_TKB/src/worker/algorithm.producer.ts) | §12 |
| Import/Export Excel | [excel.service.ts](BE_TKB/src/excel/excel.service.ts), [excel.utils.ts](BE_TKB/src/excel/excel.utils.ts) | §13 |
| Kéo-thả & state FE | [TimetableGrid.tsx](FE_TKB/app/components/admin/TimetableGrid.tsx), [scheduleSlice.ts](FE_TKB/lib/features/schedule/scheduleSlice.ts) | §14 |

---

**Phiên bản tài liệu**: 1.0
**Phạm vi**: kỹ thuật code, thuật toán, cấu trúc dữ liệu, design pattern, công nghệ.
**Bổ trợ**: [PROJECT.md](PROJECT.md) (tra cứu nhanh API/schema/setup).
