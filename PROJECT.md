# PROJECT GUIDE — Hệ thống Xếp Thời Khóa Biểu THPT (TKB Pro)

> Tài liệu onboarding **đầy đủ và chi tiết** cho dev mới. Đọc xong là có thể clone, chạy, sửa code, hiểu thuật toán, và deploy được mà không cần hỏi ai.

---

## 0. Mục lục

1. [Tổng quan & Bối cảnh](#1-tổng-quan--bối-cảnh)
2. [Stack Công nghệ](#2-stack-công-nghệ)
3. [Cấu trúc thư mục đầy đủ](#3-cấu-trúc-thư-mục-đầy-đủ)
4. [Quy ước thời gian (CỰC QUAN TRỌNG)](#4-quy-ước-thời-gian-cực-quan-trọng)
5. [Database Schema chi tiết](#5-database-schema-chi-tiết)
6. [Thuật toán xếp lịch — Hybrid GA](#6-thuật-toán-xếp-lịch--hybrid-ga)
7. [Hàm Fitness & Constraints](#7-hàm-fitness--constraints)
8. [Backend — Module Map đầy đủ](#8-backend--module-map-đầy-đủ)
9. [API Reference đầy đủ](#9-api-reference-đầy-đủ)
10. [Frontend — Routes & Components](#10-frontend--routes--components)
11. [Auth flow](#11-auth-flow)
12. [Worker/Queue flow](#12-workerqueue-flow)
13. [Excel Import/Export pipeline](#13-excel-importexport-pipeline)
14. [Setup & Run](#14-setup--run)
15. [Environment Variables](#15-environment-variables)
16. [Migrations](#16-migrations)
17. [Scripts hỗ trợ](#17-scripts-hỗ-trợ)
18. [Deployment (Coolify)](#18-deployment-coolify)
19. [Quy ước & Best practices khi maintain](#19-quy-ước--best-practices-khi-maintain)
20. [Bug pattern & Pitfall](#20-bug-pattern--pitfall)
21. [Tech debt & Roadmap](#21-tech-debt--roadmap)
22. [Tham chiếu](#22-tham-chiếu)

---

## 1. Tổng quan & Bối cảnh

### Bài toán
Xếp Thời Khóa Biểu (Timetabling) là bài toán **NP-Complete**. Phải phân bổ:
- **Tài nguyên**: giáo viên (GV), phòng học.
- **Vào khung thời gian**: Thứ × Tiết.
- **Cho đối tượng**: lớp học.
- **Thỏa mãn**: ràng buộc cứng (bắt buộc) + ràng buộc mềm (tối ưu).

### Mục tiêu
- Tự động hóa 100% xếp lịch trường THPT.
- Giảm thời gian từ vài tuần xuống vài phút.
- Tối ưu thuận tiện cho GV (ít trống tiết, không quá tải).
- Hỗ trợ chương trình GDPT 2018 (Thông tư 32/2018, 13/2022).

### Quy mô mẫu
- 30 lớp (khối 10/11/12, mỗi khối 10 lớp).
- ~50 GV.
- ~17 môn học (theo SUBJECT_CATALOG).
- 30+ phòng (CLASSROOM × 28, LAB × 5, YARD).
- 6 ngày × 10 tiết = **60 ô/tuần/lớp**.
- 30 lớp × 60 ô = **1800 slots/tuần** cần xếp.

### Tác nhân & Quyền

| Vai trò | Mô tả | Quyền chính |
| :--- | :--- | :--- |
| **Admin (BGH)** | Ban Giám Hiệu, người quản trị | Cấu hình năm học/học kỳ, môn, lớp, GV, phòng; phân công chuyên môn; chạy thuật toán; chốt và xuất TKB chính thức |
| **Teacher (GV)** | Giáo viên | Xem TKB cá nhân; đăng ký lịch bận (BUSY/AVOID); gửi feedback yêu cầu điều chỉnh; đổi mật khẩu |

### Workflow nghiệp vụ
```
[Admin]
   │
   ├─► (1) Tạo Năm học → tự sinh HK1 + HK2
   ├─► (2) Import Excel: GV, lớp, tổ hợp, phân công
   │       hoặc CRUD thủ công qua UI
   ├─► (3) (Optional) Chạy Auto-Assign GV → môn → lớp
   │
   │   ── Lúc này GV login ──
   │       └─► GV đăng ký lịch BẬN (TeacherConstraint)
   │
   ├─► (4) Bấm "Xếp TKB" → backend chạy 3-phase algorithm
   │       ↓
   │   Job qua BullMQ (hoặc fallback direct mode)
   │       ↓
   │   Phase 1 → Phase 2 → Phase 3 → save vào DB
   │
   ├─► (5) Xem kết quả + fitness details + violations
   ├─► (6) Drag-drop chỉnh thủ công (slot bị move sẽ auto LOCK)
   ├─► (7) Toggle lock các slot cần giữ nguyên
   ├─► (8) Chạy lại nếu cần (slots locked được preserve)
   └─► (9) Export Excel TKB chính thức
```

---

## 2. Stack Công nghệ

### Backend (`BE_TKB/`)
| Lib | Version | Vai trò |
| :--- | :--- | :--- |
| `@nestjs/core` | 11.x | Framework chính |
| `@nestjs/common` | 11.x | Decorators, pipes |
| `@nestjs/platform-express` | 11.x | HTTP server |
| `@nestjs/bullmq` | 11.x | Queue integration |
| `@nestjs/jwt` | 11.x | JWT tokens |
| `@nestjs/passport` | 11.x | Auth strategy |
| `@prisma/client` | 5.x | ORM client |
| `prisma` | 5.x | Migration tool |
| `bullmq` | 5.x | Redis-backed queue |
| `bcrypt` | 6.x | Password hashing |
| `passport-jwt`, `passport-local` | — | Strategies |
| `exceljs` | 4.4.0 | Excel I/O |
| `svg-captcha` | 1.4.0 | Captcha generator |
| `class-validator`, `class-transformer` | — | DTO validation |

### Frontend (`FE_TKB/`)
| Lib | Version | Vai trò |
| :--- | :--- | :--- |
| `next` | 16.1.4 | App Router |
| `react`, `react-dom` | 19.2.3 | UI lib |
| `@reduxjs/toolkit` | 2.11.x | State management |
| `react-redux` | 9.2.x | React bindings |
| `axios` | 1.13.x | HTTP client |
| `@dnd-kit/core`, `sortable`, `utilities` | 6.3 / 10 / 3.2 | Drag & Drop |
| `tailwindcss` | 4.x | Styling |
| `@tailwindcss/postcss` | 4 | PostCSS plugin |
| `lucide-react` | 0.562 | Icons |
| `clsx`, `tailwind-merge` | — | className utils |

### Infra
| Service | Version | Mục đích |
| :--- | :--- | :--- |
| PostgreSQL | 17-alpine | Primary DB |
| Redis | 7-alpine | BullMQ queue + cache |
| Docker Compose | — | Orchestration |
| Node | 22-alpine | Runtime cho cả FE+BE container |

---

## 3. Cấu trúc thư mục đầy đủ

```
NCKH/
├── .claude/                     # Claude Code config (gitignored)
├── .env.example                 # Template biến môi trường
├── .gitattributes
├── .gitignore
├── docker-compose.yml           # Compose cả stack
├── generate-data.js             # Script Node sinh dữ liệu giả 30 lớp
├── dulieu.xlsx                  # ⭐ Dữ liệu mẫu chính (active)
├── dulieu_backup.xlsx           # Backup
├── Du_lieu_mau_GDPT2018_30lop.xlsx  # Template GDPT 2018
├── LICENSE
├── readme.md                    # Báo cáo phân tích nghiệp vụ
├── readme1.md                   # Tài liệu giải thuật
├── readmedb.md                  # Báo cáo schema DB
├── PROJECT.md                   # File này
│
├── DB_TKB/                      # Compose DB-only (dev tách riêng)
│   └── docker-compose.yml
│
├── BE_TKB/                      # Backend NestJS
│   ├── Dockerfile               # Multi-stage build (deps → builder → runner)
│   ├── README.md
│   ├── eslint.config.mjs
│   ├── nest-cli.json
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── seed_system.ts           # System-level seed
│   │
│   ├── prisma/
│   │   ├── schema.prisma        # ⭐ Single source of truth
│   │   ├── seed.ts              # Workbook-based seed (truncate + import)
│   │   ├── seed_custom.sql      # SQL tùy biến (manual run)
│   │   └── migrations/
│   │       ├── 20260120072546_init_vietnamese_schema/
│   │       ├── 20260120105357_add_phan_hoi_table_v2/
│   │       ├── 20260120184347_add_hoc_ky_to_assignment/
│   │       ├── 20260121174242_init_moet_norms/
│   │       ├── 20260121180438_init_phase6_final/
│   │       ├── 20260123095318_remove_system_settings_table/
│   │       ├── 20260312223000_add_excel_workbook_support/
│   │       ├── add_notifications/
│   │       └── migration_lock.toml
│   │
│   ├── scripts/
│   │   ├── add_teachers.mjs            # Thêm bulk GV
│   │   ├── debug-fitness.ts            # Debug fitness function
│   │   ├── generate-sample-data.js     # Gen dữ liệu test
│   │   ├── rebalance.mjs               # Cân bằng phân công GV
│   │   ├── redistribute.mjs            # Phân phối lại
│   │   ├── seed-admin.js               # Tạo admin mặc định (chạy trong Docker)
│   │   ├── startup.sh                  # Entrypoint container
│   │   └── upload_excel.mjs            # Upload Excel qua CLI
│   │
│   ├── tools/
│   │   └── run-seed.ts                 # Wrapper chạy seed
│   │
│   └── src/
│       ├── main.ts                     # Bootstrap (port 4000, CORS, ValidationPipe)
│       ├── app.module.ts               # Root module — import toàn bộ feature modules + BullMQ
│       ├── app.controller.ts           # GET / → "Hello World"
│       ├── app.service.ts
│       ├── app.controller.spec.ts
│       │
│       ├── algorithm/                  # ⭐ Logic xếp lịch (Hybrid GA)
│       │   ├── algorithm.module.ts
│       │   ├── algorithm.controller.ts
│       │   ├── algorithm.service.ts    # 1032 dòng — Phase 1/2/3
│       │   ├── algorithm.service.spec.ts
│       │   ├── algorithm.controller.spec.ts
│       │   ├── constraint.service.ts   # Constraints + fitness details
│       │   ├── greedy.solver.ts        # Greedy solver phụ (hiện ít dùng)
│       │   ├── export.service.ts       # Export TKB ra Excel
│       │   └── dto/
│       │
│       ├── auth/                       # JWT + Captcha
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   └── auth.service.ts
│       │
│       ├── auto-assign/                # Phân công GV ↔ môn ↔ lớp tự động
│       │   ├── auto-assign.module.ts
│       │   ├── auto-assign.controller.ts
│       │   └── auto-assign.service.ts
│       │
│       ├── assignments/                # CRUD teaching_assignments
│       │   ├── assignments.module.ts
│       │   ├── assignments.controller.ts
│       │   └── assignments.service.ts
│       │
│       ├── constraints/                # Định nghĩa rule (đang refactor)
│       │   ├── constraints.module.ts
│       │   ├── constraint-config.controller.ts  # In-memory config (no DB)
│       │   ├── teacher-busy-time.constraint.ts
│       │   ├── index.ts
│       │   ├── interfaces/
│       │   │   └── constraint.interface.ts      # Violation/Constraint interfaces
│       │   ├── hard/                            # 10 hard rule classes
│       │   │   ├── correct-assignment.constraint.ts
│       │   │   ├── daily-limit-class.constraint.ts
│       │   │   ├── daily-limit-teacher.constraint.ts
│       │   │   ├── no-class-conflict.constraint.ts
│       │   │   ├── no-room-conflict.constraint.ts
│       │   │   ├── no-teacher-conflict.constraint.ts
│       │   │   ├── opposite-session.constraint.ts
│       │   │   ├── room-suitability.constraint.ts
│       │   │   ├── time-slot-validity.constraint.ts
│       │   │   └── weekly-limit-teacher.constraint.ts
│       │   └── soft/                            # 8 soft rule classes
│       │       ├── avoid-heavy-topics.constraint.ts
│       │       ├── balance-load.constraint.ts
│       │       ├── main-subject-morning.constraint.ts
│       │       ├── minimize-idle-class.constraint.ts
│       │       ├── minimize-idle-teacher.constraint.ts
│       │       ├── spread-subjects.constraint.ts
│       │       ├── stability.constraint.ts
│       │       └── teacher-preference.constraint.ts
│       │
│       ├── excel/                      # Import/Export workbook
│       │   ├── excel.module.ts
│       │   ├── excel.controller.ts
│       │   ├── excel.service.ts        # Logic parse/build workbook
│       │   ├── excel.constants.ts      # SUBJECT_CATALOG, GUIDE_ROWS, HEADER_ALIASES, SHEET_ALIASES, …
│       │   └── excel.utils.ts          # applyHeaderRow, thinBorder, normalizeKey, …
│       │
│       ├── notifications/              # @Global module
│       │   ├── notification.module.ts
│       │   ├── notification.controller.ts
│       │   └── notification.service.ts
│       │
│       ├── organization/               # Quản lý lớp
│       │   ├── organization.module.ts
│       │   ├── organization.controller.ts
│       │   └── class.service.ts
│       │
│       ├── prisma/                     # Singleton PrismaClient
│       │   ├── prisma.module.ts
│       │   └── prisma.service.ts
│       │
│       ├── resources/                  # Phòng + Môn + GV
│       │   ├── resources.module.ts
│       │   ├── resources.controller.ts        # CRUD chính (/resources/*)
│       │   ├── teacher-alias.controller.ts    # Alias /giao-vien/:id (FE legacy)
│       │   ├── room.service.ts
│       │   ├── subject.service.ts
│       │   └── teacher.service.ts
│       │
│       ├── system/                     # Năm học + Học kỳ
│       │   ├── system.module.ts
│       │   ├── system.controller.ts
│       │   ├── academic-year.service.ts
│       │   └── semester.service.ts
│       │
│       ├── timetables/                 # Read-only TKB
│       │   ├── timetables.module.ts
│       │   ├── timetables.controller.ts
│       │   └── timetables.service.ts
│       │
│       ├── users/                      # User management
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   └── users.service.ts
│       │
│       └── worker/                     # BullMQ
│           ├── worker.module.ts
│           ├── algorithm.producer.ts   # Enqueue + fallback direct
│           └── algorithm.processor.ts  # Consumer
│
└── FE_TKB/                              # Frontend Next.js
    ├── Dockerfile                       # Standalone build
    ├── README.md
    ├── eslint.config.mjs
    ├── next.config.ts
    ├── next-env.d.ts
    ├── postcss.config.mjs               # @tailwindcss/postcss
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    │
    ├── public/                          # static assets
    │
    ├── lib/
    │   ├── api.ts                       # axios instance, API_URL constant
    │   ├── store.ts                     # Redux store factory
    │   ├── hooks.ts                     # useAppDispatch, useAppSelector
    │   └── features/
    │       └── schedule/
    │           └── scheduleSlice.ts     # setSchedule, moveLesson actions
    │
    └── app/                             # Next App Router
        ├── globals.css                  # Tailwind + CSS vars (theme)
        ├── layout.tsx                   # Root: ThemeProvider + StoreProvider
        ├── page.tsx                     # Login + redirect by role
        ├── favicon.ico
        ├── StoreProvider.tsx            # Redux Provider wrapper
        │
        ├── components/
        │   ├── AppLogo.tsx
        │   ├── ConstraintConfig.tsx     # UI cấu hình ràng buộc
        │   ├── Login.tsx                # Form đăng nhập + captcha
        │   ├── TeacherRegistration.tsx  # Đăng ký lịch bận
        │   ├── ThemeProvider.tsx        # Dark/Light context
        │   ├── ThemeToggle.tsx
        │   ├── TimetableGrid.tsx        # Grid dùng chung (legacy)
        │   ├── admin/
        │   │   ├── AccountModal.tsx
        │   │   ├── AssignmentDetailModal.tsx
        │   │   ├── AssignmentModal.tsx
        │   │   ├── ClassModal.tsx
        │   │   ├── MonthlyTimetableGrid.tsx  # View tháng
        │   │   ├── Sidebar.tsx               # 8 menu items
        │   │   ├── SubjectModal.tsx
        │   │   ├── TeacherModal.tsx
        │   │   └── TimetableGrid.tsx         # Grid tuần (chính)
        │   └── dnd/
        │       ├── DraggableLesson.tsx       # @dnd-kit useDraggable
        │       └── DroppableCell.tsx         # @dnd-kit useDroppable
        │
        ├── admin/
        │   ├── layout.tsx               # Sidebar + Header (Bell, Profile, ThemeToggle) + auth guard
        │   ├── page.tsx                 # Dashboard (4 stat cards)
        │   ├── accounts/page.tsx
        │   ├── assignments/page.tsx
        │   ├── classes/page.tsx
        │   ├── configuration/page.tsx
        │   ├── subjects/page.tsx
        │   ├── teachers/page.tsx
        │   └── timetable/page.tsx       # ⭐ Trang chính: chạy thuật toán + drag-drop
        │
        └── teacher/
            ├── layout.tsx               # Teacher sidebar (4 menu) + auth guard
            ├── page.tsx                 # Dashboard cá nhân
            ├── feedback/page.tsx        # Đăng ký bận / feedback
            ├── profile/page.tsx         # Đổi mật khẩu
            └── schedule/page.tsx        # Xem TKB cá nhân
```

---

## 4. Quy ước thời gian (CỰC QUAN TRỌNG)

Đây là **quy ước cốt lõi** xuyên suốt toàn project. Hiểu sai → bug khắp nơi.

### Day (Thứ)
- Range: `2 → 7` (T2 đến T7).
- T2 = Monday, T7 = Saturday.
- **Không** có T1 (Chủ nhật) — system bỏ qua.

### Period (Tiết)
- Range tuyệt đối: `1 → 10`.
- **Sáng**: tiết `1-5` (session = 0).
- **Chiều**: tiết `6-10` (session = 1).
- Helper: `session = period <= 5 ? 0 : 1`.
- "Relative period" trong session: `period <= 5 ? period : period - 5` (1-5).

### Session
- `0` = Sáng, `1` = Chiều, `2` = Cả ngày (chỉ dùng trong `teacher_constraints.session`).

### Main session của lớp
- Lớp khối **12, 10**: học chính buổi SÁNG (`main_session = 0`).
- Lớp khối **11**: học chính buổi CHIỀU (`main_session = 1`).
- Quy tắc: môn văn hóa phải xếp vào main session; GDQP/GDTC/HDTN/GDDP có thể xếp buổi trái.

### Slot đặc biệt cố định
| Vị trí | Subject | Teacher | Source |
| :--- | :--- | :--- | :--- |
| T2, P1 (sáng) | CHAO_CO | GVCN của lớp | `checkFixedSlot` |
| T2, P2 (sáng) hoặc P6 (chiều) | GVCN_TEACHING | GVCN dạy môn của mình | `checkFixedSlot` |
| T7, P4 (sáng) hoặc P9 (chiều) | GVCN_TEACHING | GVCN | `checkFixedSlot` |
| T7, P5 (sáng) hoặc P10 (chiều) | SH_CUOI_TUAN | GVCN | `checkFixedSlot` |

### Thursday Restriction
- T5 (Thứ 5) chỉ có 4 tiết/buổi (bán trú) → **P5 và P10 LUÔN BỊ CHẶN** (HC7).

### Subject categories
| Loại | Codes | Behavior |
| :--- | :--- | :--- |
| **Heavy** | TOAN, VAN, NGU_VAN, ANH, TIENG_ANH, LY, VAT_LY, HOA, HOA_HOC | Max 1 môn nặng/buổi/lớp (HC6) |
| **Block** | TOAN, VAN, NGU_VAN, ANH, TIENG_ANH | Cần 2 tiết liên tiếp (SC4) |
| **Priority** | TOAN, VAN, NGU_VAN, ANH, TIENG_ANH | Ưu tiên xếp tiết sớm |
| **Opposite-allowed** | GDTC, GDQP, HDTN, GDDP | Cho phép buổi trái |
| **Special** | CHAO_CO, SH_CUOI_TUAN, SHCN | Bypass session check |
| **Hot-time-restricted** | GDTC, GDQP, QUOC_PHONG | Sáng chỉ P1-3, chiều chỉ P8-10 (HC5 — tránh giờ nắng) |
| **Practice** | TIN, LY, HOA, SINH (tùy `is_practice`) | Yêu cầu lab phòng chuyên dụng |

---

## 5. Database Schema chi tiết

Define tại [BE_TKB/prisma/schema.prisma](BE_TKB/prisma/schema.prisma).

### 5.1. Group 1 — System & Config

#### `academic_years`
| Field | Type | Constraint |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `name` | String | "2024-2025" |
| `start_date` | DateTime | NOT NULL |
| `end_date` | DateTime | NOT NULL |
| `weeks` | Int | DEFAULT 35 |
| `status` | YearStatus enum | DEFAULT ACTIVE; values: `ACTIVE \| ARCHIVED` |

Relation: `1—N → semesters`.

Khi tạo: tự sinh **HK1 + HK2** (xem `AcademicYearService.create`).

Khi xóa: chặn nếu có `teaching_assignments` hoặc `generated_timetables` ràng buộc.

#### `semesters`
| Field | Type | Constraint |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `year_id` | String | FK → `academic_years.id` |
| `name` | String | "HK1" / "HK2" |
| `is_current` | Boolean | DEFAULT false |
| `term_order` | Int | DEFAULT 1 |

Relations:
- `N—1 → academic_years`
- `1—N → teaching_assignments`
- `1—N → generated_timetables`

`setCurrent(id)`: set toàn bộ `is_current=false`, sau đó chỉ một semester được set true.

### 5.2. Group 2 — Resources

#### `rooms`
| Field | Type | Constraint |
| :--- | :--- | :--- |
| `id` | Int | PK autoincrement |
| `name` | String | "101", "Lab Ly" |
| `type` | RoomType enum | DEFAULT CLASSROOM |
| `floor` | Int | NOT NULL |
| `capacity` | Int | DEFAULT 45 |

Enum `RoomType`: `CLASSROOM | LAB_PHYSICS | LAB_CHEM | LAB_BIO | LAB_IT | YARD | MULTI_PURPOSE`.

Quy ước seed (xem `prisma/seed.ts`):
- `101-114`, `115` (tầng 1, CLASSROOM) — 15 phòng.
- `201-214`, `215` (tầng 2, CLASSROOM) — 15 phòng.
- `301` LAB_PHYSICS, `302` LAB_CHEM, `303` LAB_BIO, `314/315` LAB_IT.
- `SAN_BANH`, `SAN_TDTT` cho YARD (GDTC/GDQP).

Logic chọn phòng (`ConstraintService.getValidRooms`):
- Khối 12 sáng / khối 11 chiều: tầng 1 (101-114).
- Khối 10 sáng / chiều: tầng 2 (201-214).
- Thực hành TIN: 314, 315.
- Thực hành LY/HOA/SINH: 301, 302, 303.
- GDTC/GDQP: SAN_BANH, SAN_TDTT.

#### `subjects`
| Field | Type | Constraint |
| :--- | :--- | :--- |
| `id` | Int | PK autoincrement |
| `code` | String | UNIQUE — "TOAN", "LY", … |
| `name` | String | "Toán", "Vật lý" |
| `color` | String | hex "#FF5733" — UI rendering |
| `is_special` | Boolean | DEFAULT false |
| `is_practice` | Boolean | DEFAULT false |

Catalog fixed: 17 môn theo GDPT 2018. Chi tiết tại `BE_TKB/src/excel/excel.constants.ts:SUBJECT_CATALOG`.

### 5.3. Group 3 — Human Resources

#### `users`
| Field | Type | Constraint |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `username` | String | UNIQUE |
| `password_hash` | String | bcrypt hash (rounds=10) |
| `role` | UserRole enum | DEFAULT TEACHER; `ADMIN \| TEACHER` |
| `teacher_profile_id` | String? | UNIQUE FK → teachers.id (nullable; admin không cần) |
| `created_at` | DateTime | DEFAULT now() |

Relation: `1—1 → teachers` (nullable).

Default password khi tạo via `UsersService.create`: `123456` nếu không truyền.

Auth fallback: nếu bcrypt compare fail, thử plain text (legacy data). Cần loại bỏ trong tương lai.

#### `teachers`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `code` | String | UNIQUE — "GV001", "BGH" |
| `full_name` | String | "Nguyễn Văn A" |
| `short_name` | String? | "Huong Van" — hiển thị trên ô nhỏ TKB |
| `email`, `phone` | String? | Optional |
| `major_subject` | String? | Code môn chính: "TOAN", "LY" |
| `teachable_grades` | String? | JSON `[10,11,12]` — khối có thể dạy |
| `position` | String | DEFAULT "GV"; values: GV/HT/PHT/TT/TP |
| `max_periods_per_week` | Int | DEFAULT 20 |
| `department` | String? | Tổ chuyên môn |
| `status` | String | DEFAULT "Dang_day" |
| `workload_reduction` | Int | DEFAULT 0 — số tiết được giảm |
| `notes` | String? | |

Relations:
- `1—1 → users` (optional)
- `1—N → homeroom_classes` (làm GVCN)
- `1—N → constraints` (lịch bận)
- `1—N → teaching_assignments`
- `1—N → timetable_slots`

#### `teacher_constraints`
Bảng đăng ký lịch bận của GV. **Đây là bảng tối ưu hóa quan trọng** — index phức hợp.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Int | PK autoincrement |
| `teacher_id` | String UUID | FK → teachers.id, ON DELETE CASCADE |
| `day_of_week` | Int | 2-7 |
| `period` | Int | 1-5 (relative to session) |
| `session` | Int | 0=Sáng / 1=Chiều / 2=Cả ngày |
| `type` | ConstraintType enum | `BUSY` (hard) hoặc `AVOID` (soft) |

Index: `@@index([teacher_id, day_of_week, period])`.

⚠️ **CAVEAT**: `period` trong bảng này là **relative** (1-5 trong session), khác với `timetable_slots.period` (1-10 absolute). `ConstraintService.isTeacherBusy(teacherId, day, absolutePeriod)` tự convert.

### 5.4. Group 4 — Organization

#### `classes`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `name` | String | "10A1" |
| `grade_level` | Int | 10/11/12 |
| `main_session` | Int | 0=Sáng, 1=Chiều |
| `student_count` | Int? | Sĩ số |
| `combination_code` | String? | Mã tổ hợp môn tự chọn |
| `notes` | String? | |
| `fixed_room_id` | Int? | FK → rooms.id — phòng cố định |
| `homeroom_teacher_id` | String? | FK → teachers.id — GVCN |

#### `curriculum_combinations`
Tổ hợp môn tự chọn THPT 2018. UNIQUE `[code, grade_level]`.
| Field | Type |
| :--- | :--- |
| `id` | String UUID PK |
| `code` | String |
| `grade_level` | Int |
| `elective_subject_code_1..4` | String |
| `special_topic_code_1..3` | String? |
| `notes` | String? |

### 5.5. Group 5 — Assignments (INPUT)

#### `teaching_assignments` — ⭐ BẢNG INPUT QUAN TRỌNG NHẤT
"Ai dạy lớp nào, môn gì, bao nhiêu tiết". Đây là input cho thuật toán.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `semester_id` | String | FK → semesters.id |
| `class_id` | String | FK → classes.id |
| `teacher_id` | String | FK → teachers.id |
| `subject_id` | Int | FK → subjects.id |
| `total_periods` | Int | Tổng tiết/tuần (vd: 3) |
| `period_type` | PeriodType enum | DEFAULT THEORY; `THEORY \| PRACTICE \| SPECIAL` |
| `required_room_type` | RoomType? | NULL nếu THEORY; bắt buộc set nếu PRACTICE |
| `block_config` | String? | "2+1" — cấu hình xếp tiết (block 2 + lẻ 1) |

### 5.6. Group 6 — Timetable (OUTPUT)

#### `generated_timetables` — Header
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `name` | String | "TKB 5/4/2026 14:30" |
| `semester_id` | String | FK |
| `is_official` | Boolean | DEFAULT false — bản chính thức |
| `fitness_score` | Float? | Score 0-1000 |
| `created_at` | DateTime | DEFAULT now() |

Relation `1—N → slots`. `onDelete: Cascade` (xóa header → xóa hết slots).

#### `timetable_slots` — Detail
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `timetable_id` | String | FK → generated_timetables.id, CASCADE |
| `class_id` | String | FK |
| `subject_id` | Int | FK |
| `teacher_id` | String | FK |
| `room_id` | Int? | FK (nullable: CHAO_CO không có phòng) |
| `day` | Int | 2-7 |
| `period` | Int | 1-10 ABSOLUTE |
| `is_locked` | Boolean | DEFAULT false |

**3 unique constraints DB-level — backstop chống xung đột:**
```prisma
@@unique([timetable_id, class_id,   day, period], name: "unique_class_slot")
@@unique([timetable_id, teacher_id, day, period], name: "unique_teacher_slot")
@@unique([timetable_id, room_id,    day, period], name: "unique_room_slot")
```

Insert vi phạm → throw. Thuật toán **phải** đảm bảo no-conflict trước khi save.

### 5.7. Group 7 — Notifications

#### `notifications`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String UUID | PK |
| `user_id` | String? | NULL = broadcast cho tất cả ADMIN |
| `category` | NotificationCategory | `IMPORT \| TIMETABLE \| FEEDBACK \| BUSY_SCHEDULE \| SYSTEM` |
| `title` | String | |
| `message` | String | |
| `metadata` | Json? | Extra payload |
| `is_read` | Boolean | DEFAULT false |
| `created_at` | DateTime | DEFAULT now() |

Index: `@@index([user_id, is_read, created_at])`.

Helpers (NotificationService):
- `notifyImportSuccess(summary)`
- `notifyImportFailed(errorCount)`
- `notifyTimetableComplete(name, fitness)`
- `notifyTimetableFailed(name, reason)`
- `notifyBusyScheduleUpdate(name, code, slotCount)`
- `notifyTeacherFeedback(name, code, text)`

---

## 6. Thuật toán xếp lịch — Hybrid GA

Code: [BE_TKB/src/algorithm/algorithm.service.ts](BE_TKB/src/algorithm/algorithm.service.ts).

### Pipeline
```
runAlgorithm(semesterId)
  ├─ initialize cache (rooms, subjects, teachers, constraints)
  ├─ loadData() — Promise.all 5 queries
  ├─ initializeSolution() → {slots: [], busy sets}
  ├─ load locked slots từ TKB cũ (preserve user changes)
  │
  ├─ phase1_FixedSlots(solution, data, log)
  ├─ saveSnapshot phase1Slots
  │
  ├─ FOR attempt IN 1..NUM_RESTARTS:
  │     attemptSolution = clone(phase1Slots)
  │     phase2_Heuristic(attemptSolution, data)
  │     phase3_Genetic(attemptSolution, data)
  │     keep BEST by fitness_score
  │
  ├─ recalculate fitness with details
  └─ saveToDatabase(timetable header + slots batch)
```

### Phase 1 — Fixed Slots
**Mục đích**: đặt các tiết bất biến trước, lock cứng.

Logic (`phase1_FixedSlots`):
1. Build `subjectCodeMap: code → id`.
2. Lookup `BGH` teacher làm fallback cho CHAO_CO.
3. Loop qua từng class:
   - Xác định grade từ regex tên lớp (`/\d+/`).
   - Xác định session (12, 10 → SANG; còn lại → CHIEU).
   - Loop d ∈ [2..7], p ∈ [1..10]:
     - Skip nếu sai session của class (`isMorning && p > 5` hoặc `!isMorning && p <= 5`).
     - Skip nếu slot đã occupied (locked từ TKB cũ).
     - Gọi `ConstraintService.checkFixedSlot(d, p, grade, session)` → có fixed không.
     - Nếu fixed: resolve `subjectId` (handle CHAO_CO, SHCN, GVCN_TEACHING, GDDP, HDTN), gán teacherId (GVCN ưu tiên), gán roomId (`undefined` cho CHAO_CO, fixed_room_id cho lớp khác), push slot với `isLocked=true`.

Output: ~50-150 fixed slots tùy số lớp.

### Phase 2 — Heuristic Greedy + Block Scheduling
**Mục đích**: lấp đầy 90-95% TKB nhanh, dùng greedy có thông minh.

Index O(1) build từ Phase 1 slots:
- `classOccupied: Set<"classId-day-period">`
- `teacherOccupied: Set<"teacherId-day-period">`
- `classDaySessionHeavy: Map<"classId-day-session", Set<subjectCode>>`
- `classSubjectDays: Map<"classId-subjectId", Set<day>>` (cho SC1 spread)
- `teacherDaySessionCount: Map<"teacherId-day-session", count>` (cho SC7 overload)

Helper `addSlot(slot)`: push slot + update tất cả index.

Loop từng class:
1. **Phân loại assignments** thành:
   - **Opposite blocks (GDQP/GDTC)**: 2-3 tiết liên tiếp ở buổi trái.
   - **Activities (HDTN/GDDP)**: tiết lẻ buổi trái.
   - **Pairs**: môn block (TOAN/VAN/ANH) — split thành các pair size=2.
   - **Singles**: tiết lẻ còn lại.
2. **Sort**: priority subjects (TOAN/VAN/ANH) trước.
3. **Step 2a — GDTC/GDQP blocks**: thử mọi day random, tìm range tiết liên tiếp ở "buổi trái + giờ mát" (sáng → P8-10, chiều → P1-3). Nếu fail → fallback đẩy vào `oppositeSlots[]`.
4. **Step 2b — HDTN/GDDP activities**: xếp lẻ ở buổi trái.
5. **Step 3 — Pairs**:
   - Sort days: prefer days chưa có môn này (`freshDays`).
   - Try từng pair `[p, p+1]` trong main session.
   - Priority subjects → ưu tiên tiết sớm; non-priority → ưu tiên tiết muộn.
   - Check: `canPlaceAt` (no conflict + not Thursday P5/P10 + teacher not busy + not overload >4/session) + no `hasHeavyConflict`.
   - Fail → split thành 2 singles.
6. **Step 4 — Singles**:
   - Sort days: prefer days có ít môn cùng loại nhất (greedy spread).
   - Loop period theo priority.
7. **Step 5 — Fallback opposite**: place GDQP/GDTC còn dư.

`canPlaceAt(cls, assign, day, period)`:
- not classOccupied
- not (T2, P1) — reserved CHAO_CO
- not (T5, P5/P10) — Thursday block
- not teacherOccupied
- not teacher busy
- teacher session count < 5

`hasHeavyConflict(classId, day, period, code)`: heavy code conflict với heavy code khác trong cùng session.

### Phase 3 — Stochastic Hill Climbing + Simulated Annealing
**Mục đích**: sửa vi phạm còn sót, tối ưu soft constraints.

Build full O(1) indexes:
- `teacherAt: Map<"tid-d-p", Set<idx>>`
- `classAt: Map<"cid-d-p", Set<idx>>`
- `classSlotsIdx: Map<classId, idx[]>`
- `teacherSlotsIdx: Map<teacherId, idx[]>`

`addIdx(s, i)` / `rmIdx(s, i)`: maintain indexes khi swap.

`slotCost(idx)` — full cost cho một slot:

```
HC weights:
- Teacher conflict (set size > 1): +200
- Class conflict: +200
- Teacher busy: +200
- T5 P5/P10: +200
- GDTC/GDQP wrong time: +150
- Wrong session: +500
- Heavy subject conflict in session: +500

SC weights:
- SC4 block 2 not paired: +30
- SC1 same subject 3+ on same day: +10
- SC7 teacher >4/session: +10
- SC6 teacher gap: +5
```

Main loop — `MAX_ROUNDS = 60`:
1. Find all slots with `slotCost > 0` (skip locked).
2. Sort desc by cost.
3. For each violation (top 3000):
   - **Strategy 1**: swap trong cùng class. Tính best delta.
   - **Strategy 2**: nếu HC cost ≥ 100, swap cross-class theo cùng teacher.
   - **Strategy 3 (SA)**: nếu không tìm được tốt hơn, thử random swap với prob `exp(-Δ/T)`.
4. Apply best swap, update indexes, add to `tabu` set (size cap 5000).
5. Decrease `temperature *= 0.92` (cooling rate, start T=50).
6. Stale 5 rounds liên tiếp → break.

**Phase 3b — SC4 Pair-Merge Repair**:
- Loop từng class, group slots by subjectId (chỉ block subjects).
- Nếu subject có ≥2 slots nhưng không có pair adjacent → tìm cách swap để tạo pair.

### Multi-Restart
`NUM_RESTARTS = 1` (hardcoded). Production nên tăng + parallelize.

### Save
```ts
const timetable = await prisma.generatedTimetable.create({ ... });
await prisma.timetableSlot.createMany({
  data: slots,
  skipDuplicates: true  // backstop với 3 unique constraints
});
```

### Lock preservation flow
1. Run 1: tạo TKB1, fitness=950.
2. Admin drag-drop → `moveSlot` → slot bị move có `is_locked=true`.
3. Admin toggle lock thêm vài slot.
4. Run 2: `prevTimetable.slots` (where `is_locked=true`) được load vào solution **trước** Phase 1.
5. Phase 1 check `isSlotOccupied` → skip những ô đã locked.
6. Phase 2/3 không touch slot có `isLocked=true`.

### moveSlot logic
- Nếu target slot empty: update day/period + `is_locked=true`.
- Nếu có target slot (cùng class, cùng day-period): **swap** trong transaction:
  1. Move source → temp `(0, 0)` (tránh unique conflict).
  2. Move target → source's old position, set lock.
  3. Move source → new position, set lock.

---

## 7. Hàm Fitness & Constraints

```
Fitness = 1000 - (HardViolations × 100) - SoftPenalty
```

TKB **VALID** chỉ khi `fitness = 1000` (zero hard violations).

### Hard Constraints (HC) — weight 100

| Code | Tên | Mô tả | Detection |
| :--- | :--- | :--- | :--- |
| HC1 | `HC1_GV_TRÙNG_GIỜ` | Một GV dạy 2+ lớp cùng lúc | groupBy teacher_id, count overlaps |
| HC2 | `HC2_LỚP_TRÙNG_GIỜ` | Một lớp học 2+ môn cùng lúc | groupBy class_id |
| HC3 | `HC3_PHÒNG_TRÙNG` | Một phòng có 2+ lớp cùng lúc | groupBy room_id |
| HC4 | `HC4_GV_BẬN` | GV bị xếp dạy khi đã đăng ký BUSY | `isTeacherBusy()` |
| HC5 | `HC5_GDTC_GIỜ_NẮNG` | GDTC/GDQP sáng > P3 hoặc chiều < P8 | period range check |
| HC6 | `HC6_MÔN_NẶNG` | ≥2 môn nặng trong cùng buổi/lớp | distinct heavy codes per session |
| HC7 | `HC7_THỨ_5` | T5 P5 hoặc P10 (bán trú) | day=5 && period∈{5,10} |
| HC8 | `HC8_SAI_BUỔI` | Môn văn hóa xếp khác main_session của lớp | session vs class.main_session |

### Soft Constraints (SC)

| Code | Tên | Weight | Mô tả |
| :--- | :--- | :--- | :--- |
| SC1 | `SC1_DỒN_CỤC` | 10 | Môn ≥3 tiết/tuần nhưng rải <3 ngày |
| SC4 | `SC4_BLOCK_XÉ_LẺ` | 10 | Môn block (TOAN/VAN/...) không được xếp 2 tiết liên tiếp |
| SC6 | `SC6_TIẾT_TRỐNG_GV` | 5 | GV trống tiết giữa 2 tiết dạy cùng buổi |
| SC7 | `SC7_QUÁ_TẢI_GV` | 10 | GV >4 tiết/buổi |

`getFitnessDetails(schedule, classMap?)` trả về:
```ts
{
  score: number,
  details: string[],         // Bullet list "[HC1] Giáo viên trùng giờ: -200 (2 lỗi)"
  violations: {
    type: 'HARD' | 'SOFT',
    rule: string,
    msg: string               // emoji + message tiếng Việt
  }[],
  hardViolations: number,
  softPenalty: number
}
```

### Constraint config (in-memory)
`ConstraintConfigController` (`/cau-hinh-rang-buoc`) cho phép Admin enable/disable rule, đổi weight. **Hiện chưa được áp dụng vào thuật toán** — chỉ là UI placeholder.

---

## 8. Backend — Module Map đầy đủ

`AppModule` import 13 module + `BullModule.forRoot`:

| Module | Path | Provides | Imports |
| :--- | :--- | :--- | :--- |
| `AppModule` | `src/app.module.ts` | Root | All below + BullModule |
| `PrismaModule` | `src/prisma/` | `PrismaService` | — |
| `BullModule` (root) | — | Redis connection | — |
| `SystemModule` | `src/system/` | AcademicYearService, SemesterService | Prisma |
| `ResourcesModule` | `src/resources/` | RoomService, SubjectService, TeacherService | Prisma, NotificationModule |
| `UsersModule` | `src/users/` | UsersService | Prisma |
| `OrganizationModule` | `src/organization/` | ClassService | Prisma |
| `AssignmentsModule` | `src/assignments/` | AssignmentsService | Prisma |
| `TimetablesModule` | `src/timetables/` | TimetablesService | Prisma |
| `AlgorithmModule` | `src/algorithm/` | AlgorithmService, ExportService, ConstraintService | Prisma, System, Resources, Assignments, Timetables, forwardRef(Worker) |
| `WorkerModule` | `src/worker/` | AlgorithmProducer, AlgorithmProcessor | BullModule.registerQueue('optimization'), forwardRef(Algorithm), Prisma |
| `AuthModule` | `src/auth/` | AuthService, JwtModule | Prisma, Passport, JWT |
| `ExcelModule` | `src/excel/` | ExcelService | Prisma |
| `ConstraintsModule` | `src/constraints/` | (chỉ ConstraintConfigController) | — |
| `NotificationModule` (Global) | `src/notifications/` | NotificationService | Prisma |
| `AutoAssignModule` | `src/auto-assign/` | AutoAssignService | Prisma |

**Bootstrap** (`main.ts`):
```ts
const app = await NestFactory.create(AppModule);
app.useGlobalPipes(new ValidationPipe());
app.enableCors();
await app.listen(process.env.PORT ?? 4000);
```

⚠️ CORS hiện đang `enableCors()` — accept all origin. Production cần whitelist.

⚠️ **Auth chưa có guard**: phần lớn endpoint chưa được bảo vệ bởi `JwtAuthGuard`. Authorization header có nhưng FE chỉ gửi, BE không enforce. Tech debt lớn.

---

## 9. API Reference đầy đủ

Tổng cộng **~64 endpoints** trên 13 controllers. Base URL: `http://localhost:4000`.

### `/auth` — AuthController
| Method | Path | Body / Params | Response |
| :--- | :--- | :--- | :--- |
| POST | `/auth/captcha` | — | `{ img: svg, sessionId: hash }` |
| POST | `/auth/login` | `{ username, password, captchaCode, captchaSessionId }` | `{ access_token, user }` |
| GET | `/auth/profile` | header `Bearer <jwt>` | `{ id, username, role, full_name, teacherId?, teacher_profile? }` |
| PATCH | `/auth/change-password` | `{ oldPassword, newPassword }` | `{ success, message }` |

### `/system` — SystemController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/system/years` | List years (include semesters) |
| POST | `/system/years` | Create year (auto-create HK1+HK2) |
| PUT | `/system/years/:id` | Update year |
| DELETE | `/system/years/:id` | Delete (chặn nếu có data) |
| GET | `/system/years/active` | Get active year |
| GET | `/system/semesters` | List semesters |
| POST | `/system/semesters` | Create |
| PUT | `/system/semesters/:id/set-current` | Set is_current=true (unset others) |

### `/resources` — ResourcesController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/resources/stats` | `{ teachers, classes, subjects, rooms }` count |
| GET | `/resources/rooms` | List |
| POST | `/resources/rooms` | Create |
| PUT | `/resources/rooms/:id` | Update |
| DELETE | `/resources/rooms/:id` | Delete |
| GET | `/resources/subjects` | List |
| POST | `/resources/subjects` | Create |
| PUT | `/resources/subjects/:id` | Update |
| DELETE | `/resources/subjects/:id` | Delete |
| GET | `/resources/teachers` | List (include constraints, homeroom_classes) |
| GET | `/resources/teachers/:id` | Detail |
| POST | `/resources/teachers` | Create |
| PUT | `/resources/teachers/:id` | Update |
| DELETE | `/resources/teachers/:id` | Delete |
| PUT | `/resources/teachers/:id/constraints` | Replace constraints (delete-all + insert) |

### `/giao-vien` — TeacherAliasController (legacy alias for FE)
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/giao-vien/:id` | Get with `ho_ten`, `ngay_nghi_dang_ky` mapped |
| PATCH | `/giao-vien/:id` | Update; xử lý `ngay_nghi_dang_ky` (có thể là string `"2_0"` hoặc object) |
| PATCH | `/giao-vien/:id/busy-time` | `{ busySlots: [{day, period, session}] }` → set BUSY constraints + notify admin |

### `/organization` — OrganizationController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/organization/classes` | List (include fixed_room, homeroom_teacher) |
| GET | `/organization/classes/:id` | Detail |
| POST | `/organization/classes` | Create |
| PUT | `/organization/classes/:id` | Update |
| DELETE | `/organization/classes/:id` | Delete |

### `/assignments` — AssignmentsController
| Method | Path | Query / Body | Description |
| :--- | :--- | :--- | :--- |
| GET | `/assignments` | `?semester_id=` | List for semester (include subject, teacher, class) |
| POST | `/assignments` | TeachingAssignment fields | Create |
| PUT | `/assignments/:id` | partial fields | Update |
| DELETE | `/assignments/:id` | — | Delete |

### `/timetables` — TimetablesController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/timetables?semester_id=` | List timetables (include slots) |
| GET | `/timetables/:id` | Detail |

### `/algorithm` — AlgorithmController
| Method | Path | Body / Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/algorithm/start` | `{ semesterId }` | Enqueue job (or direct fallback) |
| GET | `/algorithm/status/:jobId` | — | `{ id, state, progress, result }` |
| GET | `/algorithm/result/:semesterId` | — | TKB chi tiết + fitnessDetails + violations |
| GET | `/algorithm/export/:semesterId` | — | Stream Excel (.xlsx) |
| POST | `/algorithm/move-slot` | `{ slotId, newDay, newPeriod, newRoomId? }` | Move/swap slot, set lock |
| POST | `/algorithm/toggle-lock` | `{ slotId }` | Toggle is_locked |
| POST | `/algorithm/clear/:semesterId` | — | Delete all timetables for semester |

Response `/algorithm/result/:semesterId`:
```json
{
  "bestSchedule": [{ id, classId, className, subjectId, subjectName, subject: {name, code, color},
                      teacherId, teacherName, roomId, roomName, day, period, session, is_locked }],
  "fitness_score": 950,
  "fitnessDetails": ["⛔ [HC1] Giáo viên trùng giờ: -100 (1 lỗi)", ...],
  "fitnessViolations": [{ type, rule, msg }],
  "hardViolations": 1,
  "softPenalty": 50,
  "is_official": false,
  "generated_at": "2026-05-04T10:00:00Z"
}
```

### `/excel` — ExcelController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/excel/workbook/template/:academicYearId` | Download template |
| GET | `/excel/workbook/export/:academicYearId` | Export full data |
| POST | `/excel/workbook/import/:academicYearId` | Multipart upload `.xlsx` (max 10MB), import 4 sheets |

### `/auto-assign` — AutoAssignController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/auto-assign/template` | Download template Excel danh sách GV |
| POST | `/auto-assign/generate/:yearId` | Upload Excel + chạy thuật toán phân công |
| GET | `/auto-assign/export/:yearId` | Export kết quả phân công ra Excel |

### `/users` — UsersController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/users` | List |
| POST | `/users` | Create (default password "123456") |
| PUT | `/users/:id` | Update (re-hash password nếu có) |
| DELETE | `/users/:id` | Delete |

### `/notifications` — NotificationController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/notifications` | List for current user (admin: + broadcast) — top 50 |
| GET | `/notifications/unread-count` | `{ count }` |
| PUT | `/notifications/read-all` | Mark all read |
| PUT | `/notifications/:id/read` | Mark one read |

⚠️ Lưu ý: route `/read-all` phải khai báo TRƯỚC `/:id/read` để tránh NestJS match `:id="read-all"`.

### `/cau-hinh-rang-buoc` — ConstraintConfigController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/cau-hinh-rang-buoc` | List 11 constraints (5 hard + 6 soft) — in-memory |
| PATCH | `/cau-hinh-rang-buoc/:id` | Update weight/active flag |

### `/` — AppController
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/` | "Hello World" — healthcheck |

---

## 10. Frontend — Routes & Components

### Routes overview

| Path | Component | Mục đích |
| :--- | :--- | :--- |
| `/` | `app/page.tsx` | Login + auto-redirect by role |
| `/admin` | `app/admin/page.tsx` | Dashboard 4 stat cards |
| `/admin/timetable` | `app/admin/timetable/page.tsx` | ⭐ Trang xếp lịch |
| `/admin/classes` | `app/admin/classes/page.tsx` | CRUD lớp + ClassModal |
| `/admin/teachers` | `app/admin/teachers/page.tsx` | CRUD GV + TeacherModal |
| `/admin/subjects` | `app/admin/subjects/page.tsx` | CRUD môn + SubjectModal |
| `/admin/assignments` | `app/admin/assignments/page.tsx` | Phân công CRUD + import Excel |
| `/admin/configuration` | `app/admin/configuration/page.tsx` | Năm học, học kỳ, phòng |
| `/admin/accounts` | `app/admin/accounts/page.tsx` | User CRUD + AccountModal |
| `/teacher` | `app/teacher/page.tsx` | Teacher dashboard |
| `/teacher/schedule` | `app/teacher/schedule/page.tsx` | Xem TKB cá nhân |
| `/teacher/feedback` | `app/teacher/feedback/page.tsx` | Đăng ký bận / feedback |
| `/teacher/profile` | `app/teacher/profile/page.tsx` | Đổi mật khẩu |

### Layouts

#### `app/layout.tsx` (root)
- `lang="vi"`, `suppressHydrationWarning` để tránh mismatch theme.
- Wrap: `ThemeProvider > StoreProvider > children`.
- Font: Inter (Google).

#### `app/admin/layout.tsx`
- Auth guard: check `localStorage.token` + `user.role === 'ADMIN'`, redirect `/` nếu fail.
- Sidebar (8 menu) + Header.
- Header có:
  - Bell icon: notifications dropdown — fetch `/notifications` mỗi 30s polling.
  - Profile avatar: dropdown đăng xuất / quản lý tài khoản / cấu hình.
  - ThemeToggle.

#### `app/teacher/layout.tsx`
- Auth guard: `user.role === 'TEACHER'`.
- Sidebar 4 menu (Tổng quan, TKB, Đăng ký bận, Đổi mật khẩu).

### Components dùng chung (`app/components/`)
| File | Mục đích |
| :--- | :--- |
| `AppLogo.tsx` | Logo TKB Pro |
| `Login.tsx` | Form login + captcha SVG |
| `TimetableGrid.tsx` | Grid tuần generic (legacy) |
| `TeacherRegistration.tsx` | UI đăng ký lịch bận |
| `ConstraintConfig.tsx` | UI cấu hình ràng buộc |
| `ThemeProvider.tsx` | Context dark/light, lưu vào localStorage |
| `ThemeToggle.tsx` | Button đổi theme |

### Admin components (`app/components/admin/`)
| File | Dùng ở |
| :--- | :--- |
| `Sidebar.tsx` | admin/layout.tsx |
| `TimetableGrid.tsx` | admin/timetable/page.tsx (chính) |
| `MonthlyTimetableGrid.tsx` | admin/timetable/page.tsx (mode MONTH) |
| `ClassModal.tsx` | admin/classes |
| `TeacherModal.tsx` | admin/teachers |
| `SubjectModal.tsx` | admin/subjects |
| `AssignmentModal.tsx`, `AssignmentDetailModal.tsx` | admin/assignments |
| `AccountModal.tsx` | admin/accounts |

### Drag-and-Drop (`app/components/dnd/`)
| File | Hook |
| :--- | :--- |
| `DraggableLesson.tsx` | `useDraggable` từ `@dnd-kit/core` |
| `DroppableCell.tsx` | `useDroppable` |

DnD context wrap trong TimetableGrid: `DndContext` với `MouseSensor` + `TouchSensor`. `onDragEnd` dispatch `moveLesson` action + gọi API `/algorithm/move-slot`.

### Redux store (`lib/`)
- `store.ts`: `configureStore({ reducer: { schedule: scheduleReducer } })`.
- `hooks.ts`: typed `useAppDispatch`, `useAppSelector`.
- `features/schedule/scheduleSlice.ts`:
  - State: `{ data: ScheduleSlot[], status, error }`.
  - Actions: `setSchedule(slots)`, `moveLesson({ id, day, period })`.

### API client
- `lib/api.ts`: `axios` instance với baseURL = `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'`.
- ⚠️ Phần lớn pages dùng `fetch()` trực tiếp với `Authorization: Bearer ${token}` từ localStorage, không qua axios instance. Cần thống nhất.

### Trang xếp lịch flow (`/admin/timetable`)
1. `useEffect` → `fetchYears()` lấy years + semesters.
2. Khi chọn `semesterId` → `checkExistingResult` (GET `/algorithm/result/:id`) + `fetchMetadata` (classes + teachers).
3. Bấm "Xếp lịch" → POST `/algorithm/start` → nếu `directResult` (no Redis) → `checkExistingResult` ngay; nếu có jobId → `pollResult(jobId)` mỗi 2s gọi `/algorithm/status/:jobId`.
4. Khi `state === 'completed'` → reload result.
5. Drag-drop → `moveSlot` API.
6. Toggle lock → `toggle-lock` API.
7. Export → GET `/algorithm/export/:id` → trigger download.

---

## 11. Auth flow

```
User                FE                         BE
 │                   │                          │
 │── Open /          │                          │
 │   <─ Login form ──┤                          │
 │                   │── POST /auth/captcha ───►│
 │                   │   <── { img, sessionId } │
 │   <─ render SVG ──┤                          │
 │                   │                          │
 │── Submit ────────►│                          │
 │   {u,p,code}      │── POST /auth/login ─────►│
 │                   │   {u,p,code,sessionId}   │
 │                   │                          │── verifyCaptcha (HMAC-SHA256)
 │                   │                          │── findUser by username
 │                   │                          │── bcrypt.compare(p, hash)
 │                   │                          │       (fallback plain text)
 │                   │                          │── jwtService.sign({sub,role,username})
 │                   │   <── { access_token,    │
 │                   │         user }           │
 │   <─ redirect ────┤── localStorage.setItem  │
 │     /admin or     │── localStorage.setItem  │
 │     /teacher      │                          │
 │                   │                          │
 │                   │── GET /xxx ─────────────►│
 │                   │   header Bearer <jwt>    │
 │                   │                          │── (NOT YET enforced — tech debt)
 │                   │                          │
```

JWT payload: `{ username, sub: userId, role }`, expires `1d`.

Captcha: HMAC-SHA256 của text với secret `JWT_SECRET`. SessionId chính là hash → stateless.

---

## 12. Worker/Queue flow

```
[POST /algorithm/start]
     │
     ▼
AlgorithmProducer.startOptimization(semesterId)
     │
     ├─► checkRedis() — race ping vs 1s timeout
     │
     ├─► IF Redis OK:
     │     queue.add('optimize-schedule', { semesterId, params })
     │     return { jobId }
     │
     └─► ELSE (fallback):
           algorithmService.runAlgorithm(semesterId) [synchronous]
           return { jobId: 'direct-<ts>', directResult: true }


[BullMQ worker]
     │
     ▼
AlgorithmProcessor.process(job)
     │
     ▼
algorithmService.runAlgorithm(job.data.semesterId)
     │
     ▼
return { success, timetableId, debugLogs, error }
```

`AlgorithmProcessor` extends `WorkerHost` (NestJS BullMQ pattern). Auto-instantiate khi register queue `'optimization'`.

`getJobStatus(jobId)`:
- If startsWith `'direct-'`: return mock `{ state: 'completed', progress: 100 }`.
- Else: `queue.getJob(jobId)` + `getState()` + `progress` + `returnvalue`.

⚠️ Hiện chỉ 1 worker concurrent. Để parallel: tăng `concurrency` trong `@Processor` decorator.

---

## 13. Excel Import/Export pipeline

### Workbook structure
9 sheets (xem `excel.constants.ts:WORKBOOK_SHEET_NAMES`):
- `Huong_dan` — guide rows (read-only)
- `Nguon_tham_khao` — references (read-only)
- `DM_Mon_GDPT2018` — subjects catalog (read-only)
- `DM_Giao_vien` — teachers (import target)
- `DM_Lop` — classes (import target)
- `DM_Phong` — rooms (import target)
- `DM_To_hop` — combinations (import target)
- `Phan_cong` — assignments (import target)
- `Tong_hop_GV` — teacher summary (export only)

### Header alias system
File `excel.constants.ts:HEADER_ALIASES` chứa map cột — cho phép user dùng nhiều cách viết:
- `magv | mgv | ma | teachercode` → `code`
- `hoten | htn | hovaten | giaovien` → `fullName`
- ...

`normalizeKey(text)` (`excel.utils.ts`): bỏ dấu, lowercase, bỏ ký tự đặc biệt → match alias.

### Sheet alias
`SHEET_ALIASES` — match tên sheet bằng nhiều biến thể:
- `phancong | bangphanconggiangdaymonhocgiaovienthpt | bangphanconggiangday` → sheet `Phan_cong`.

### Subject catalog
17 môn fixed:
TOAN, VAN, ANH, LS, GDTC, GDQP, HDTN, GDDP, LY, HOA, SINH, DIA, GDKT, CNCN, CNNN, TIN, MT + special: CHAO_CO, SH_CUOI_TUAN.

Mỗi môn có `aliases: string[]` cho user viết tự do.

### Import flow
```
POST /excel/workbook/import/:academicYearId
      │
      ▼ Multer memoryStorage, max 10MB, .xlsx only
      │
      ▼ ExcelService.importWorkbook(yearId, buffer)
      │
      ├─► Parse Workbook (ExcelJS)
      ├─► Validate 4 sheets present (DM_Giao_vien, DM_Lop, DM_To_hop, Phan_cong)
      ├─► Parse rows → typed objects (TeacherImportRow, ClassImportRow, ...)
      ├─► Validate (dedupe, cross-ref, period sums)
      │
      ├─► IF errors > 0:
      │     return { success: false, errors }
      │     notifyImportFailed(errorCount)
      │
      └─► ELSE (transaction):
            upsert subjects
            upsert teachers
            upsert classes
            replace combinations
            delete + create assignments (cho cả HK1+HK2)
            notifyImportSuccess(summary)
            return { success: true, summary }
```

### Export TKB Excel
`/algorithm/export/:semesterId` → `ExportService.exportScheduleToExcel`:
- Sheet 1: "Thời khóa biểu", 1 row = 1 (Day, Session, Period), columns = classes.
- Mỗi cell: `subject_name\n(short_teacher_name)`.
- Row height 42, wrap text, freeze 3 cột đầu.
- Merge cells theo Day và Session.
- File name: `thoi-khoa-bieu-{year_name}-{semester_name}.xlsx`.

### Auto-Assign flow
`AutoAssignService.generateAssignments(yearId, buffer)`:
- Parse Excel danh sách GV (code, fullName, majorSubject, baseLoad, reduction, …).
- Tính demand từng class × subject (theo SUBJECT_CATALOG GDPT 2018).
- Match GV với môn dạy được, ưu tiên load thấp.
- Output: `{ summary, assignments, warnings }`.

---

## 14. Setup & Run

### Yêu cầu
- Node.js 22+ (Docker dùng `node:22-alpine`).
- npm hoặc pnpm.
- Docker + Docker Compose.
- Git.
- (Windows) Git Bash hoặc WSL khuyến nghị (project có script `.sh`, `.mjs`).

### Quick Start (Docker — toàn stack)
```bash
# 1. Clone
git clone <repo>
cd NCKH

# 2. Cấu hình env
cp .env.example .env
# Sửa POSTGRES_PASSWORD, JWT_SECRET (>=32 chars), NEXT_PUBLIC_API_URL

# 3. Chạy
docker compose up -d

# 4. Theo dõi logs
docker compose logs -f backend
docker compose logs -f frontend
```

Endpoints:
- BE: http://localhost:4000
- FE: http://localhost:3000
- Postgres: 5432 (chỉ internal mặc định)
- Redis: 6379 (chỉ internal)

Healthchecks tự động:
- `postgres`: `pg_isready` mỗi 5s.
- `redis`: `redis-cli ping` mỗi 5s.
- `backend`: `wget http://127.0.0.1:4000` mỗi 10s, start_period 60s.
- `frontend`: `wget http://127.0.0.1:3000` mỗi 10s, start_period 20s.

### Dev local (recommended)
Tách BE/FE chạy local, chỉ dùng Docker cho DB+Redis:

```bash
# Terminal 1: Database services
docker compose up -d postgres redis

# Terminal 2: Backend
cd BE_TKB
npm ci
npx prisma generate                    # Generate Prisma client
npx prisma migrate deploy              # Apply migrations
# hoặc dev mode:
# npx prisma migrate dev
npx ts-node prisma/seed.ts             # Seed dữ liệu mẫu
npm run start:dev                      # Watch mode, port 4000

# Terminal 3: Frontend
cd FE_TKB
npm ci
npm run dev                            # Port 3000
```

### Default credentials
Seed admin (chạy `prisma/seed.ts` hoặc `scripts/seed-admin.js`):
- Username: `admin`
- Password: `123456`

⚠️ Đổi ngay khi prod.

### Build production
```bash
# Backend
cd BE_TKB
npm run build                          # → dist/
npm run start:prod                     # node dist/main.js

# Frontend
cd FE_TKB
npm run build                          # → .next/standalone (Next 16)
npm run start                          # next start
```

### Troubleshooting
- `prisma generate` fail trong Docker: cần `openssl` (Dockerfile đã `apk add openssl`).
- BE không thấy Redis: check `REDIS_HOST`. Trong compose là `redis`, local là `localhost`.
- FE call API sai domain: `NEXT_PUBLIC_API_URL` được **bake vào build**, không phải runtime. Đổi → rebuild image.
- Migration conflict: `npx prisma migrate resolve --rolled-back <migration>` rồi run lại.

---

## 15. Environment Variables

Xem `.env.example`:

| Var | Default | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | ✓ | DB user |
| `POSTGRES_PASSWORD` | `changeme_strong_password` | ✓ | **PHẢI ĐỔI** |
| `POSTGRES_DB` | `tkb_db` | ✓ | DB name |
| `DATABASE_URL` | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public` | ✓ | Prisma URL (compose tự build) |
| `REDIS_HOST` | `redis` (compose) / `localhost` (dev) | ✓ | |
| `REDIS_PORT` | `6379` | | |
| `JWT_SECRET` | `changeme_jwt_secret_at_least_32_chars` | ✓ | **MIN 32 CHARS** |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | ✓ | Build-time, baked vào FE bundle |
| `BE_PORT` | `4000` | | |
| `FE_PORT` | `3000` | | |
| `PORT` | (override BE_PORT in container) | | NestJS bootstrap đọc |

⚠️ FE `NEXT_PUBLIC_*` env không phải runtime — phải pass qua `ARG` trong Dockerfile và rebuild.

---

## 16. Migrations

8 migrations trong `BE_TKB/prisma/migrations/`:

| Timestamp | Tên | Nội dung chính |
| :--- | :--- | :--- |
| 20260120072546 | `init_vietnamese_schema` | Initial schema (tên cột tiếng Việt) |
| 20260120105357 | `add_phan_hoi_table_v2` | Bảng feedback (sau bị drop) |
| 20260120184347 | `add_hoc_ky_to_assignment` | Add `semester_id` to teaching_assignments |
| 20260121174242 | `init_moet_norms` | MoET (Bộ GD) chuẩn — định mức tiết |
| 20260121180438 | `init_phase6_final` | Phase 6 — finalize schema |
| 20260123095318 | `remove_system_settings_table` | Drop system_settings |
| 20260312223000 | `add_excel_workbook_support` | Add fields cho Excel import (curriculum_combinations, …) |
| (no timestamp) | `add_notifications` | Bảng notifications + enum |

`migration_lock.toml`: provider lock = postgresql.

### Quy ước khi sửa schema
1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <descriptive_name>` (dev) hoặc `migrate deploy` (prod).
3. **KHÔNG** edit migration files đã commit.
4. Update services dùng field mới + types FE.
5. Test với `prisma studio` (visual DB browser).

### Reset DB hoàn toàn
```bash
npx prisma migrate reset            # Drop + re-apply all + run seed
# hoặc
npx prisma db push --accept-data-loss   # Force sync schema (skip migrations)
```

---

## 17. Scripts hỗ trợ

### `BE_TKB/scripts/`
| File | Mục đích |
| :--- | :--- |
| `seed-admin.js` | Tạo user admin (username=admin, password=123456 hash bcrypt). Auto-run trong `startup.sh` |
| `startup.sh` | Container entrypoint: `prisma db push` → `seed-admin.js` → `node dist/main.js` |
| `add_teachers.mjs` | Thêm bulk GV qua Prisma |
| `rebalance.mjs` | Cân bằng lại load các GV |
| `redistribute.mjs` | Phân phối lại assignments |
| `upload_excel.mjs` | Upload Excel qua HTTP API từ CLI |
| `debug-fitness.ts` | Tính + in chi tiết fitness của TKB hiện tại |
| `generate-sample-data.js` | Sinh dữ liệu giả 30 lớp |

### Root scripts
- `generate-data.js`: Node script tạo Excel mẫu 30 lớp GDPT 2018.

### NPM scripts (BE_TKB/package.json)
```bash
npm run start         # nest start
npm run start:dev     # nest start --watch (HMR)
npm run start:debug   # --debug --watch
npm run start:prod    # node dist/main
npm run build         # nest build
npm run lint          # eslint --fix
npm run format        # prettier
npm test              # jest
npm run test:watch
npm run test:cov
npm run test:e2e
```

### NPM scripts (FE_TKB/package.json)
```bash
npm run dev           # next dev (port 3000)
npm run build         # next build
npm run start         # next start
npm run lint          # eslint
```

---

## 18. Deployment (Coolify)

Production deploy bằng **Coolify** (self-hosted PaaS, alternative cho Heroku/Vercel) với Build Pack `Docker Compose`.

### Domain production

| Service | URL | Container |
| :--- | :--- | :--- |
| **Frontend** | https://gettimetable.cloud | `frontend` (Next.js, port 3000) |
| **Backend API** | https://api.gettimetable.cloud | `backend` (NestJS, port 4000) |
| Postgres | (internal) | `postgres:5432` |
| Redis | (internal) | `redis:6379` |

### Coolify project info
- **Project name**: `Timetable`
- **Environment**: `production`
- **Resource name**: `khoidev-01/-timetable_-gen:main-z04w0kwwswkk40wosgs4ksc4` (auto-generated từ git branch `main`)
- **Internal name**: `testy-tarsier-h4ocsgkkko4kcg8ssc4cowks`
- **Git source**: branch `main` của repo `khoidev-01/timetable_-gen`
- **Status**: Running (healthy)

### Quy trình deploy
1. Push code lên branch `main` → Coolify auto-detect (webhook) hoặc bấm `Redeploy` thủ công.
2. Coolify clone repo → build từ `docker-compose.yml` ở root → start 4 services (postgres, redis, backend, frontend).
3. Traefik (built-in Coolify) tự gen SSL Let's Encrypt + route domain → container theo label.
4. `scripts/startup.sh` của BE container chạy:
   - `prisma db push --skip-generate --accept-data-loss` — sync schema
   - `node scripts/seed-admin.js` — tạo admin nếu chưa có
   - `node dist/src/main.js` — bootstrap NestJS

### Env trên Coolify
Set tại tab **Environment Variables** (UI Coolify), KHÔNG commit `.env`:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `JWT_SECRET` (≥32 chars)
- `NEXT_PUBLIC_API_URL=https://api.gettimetable.cloud` ⭐ (bake vào build, đổi domain → phải Redeploy)

### CORS
BE đang `enableCors()` allow-all → FE từ `gettimetable.cloud` call API OK. Production nên whitelist:
```ts
app.enableCors({ origin: ['https://gettimetable.cloud'], credentials: true });
```

### Common ops
- **Redeploy**: tab Configuration → button `Redeploy` (góc phải).
- **Stop**: button `Stop` (cạnh Redeploy).
- **Logs**: tab `Logs` (filter theo service).
- **Terminal**: tab `Terminal` → exec vào container.
- **Rollback**: tab `Rollback` → chọn deployment cũ.
- **Manual DB ops**: tab Terminal → service `postgres` → `psql -U postgres tkb_db`.
- **Webhook deploy**: tab `Webhooks` → có URL gọi từ GitHub Actions.

### DNS
DNS records (provider domain `gettimetable.cloud`) phải trỏ:
- `gettimetable.cloud` → IP server Coolify (A record)
- `api.gettimetable.cloud` → cùng IP (A record hoặc CNAME)

Coolify Traefik handle phần routing dựa trên Host header.

### Troubleshoot deploy
- Build fail: check `Logs` → tab build, thường do `npm ci` hoặc `prisma generate` thiếu OS package.
- FE call API sai (CORS / 404): check `NEXT_PUBLIC_API_URL` đã set đúng và **đã Redeploy** (không phải Restart).
- DB connect fail: tên service trong `DATABASE_URL` phải là `postgres` (đúng với `services.postgres` trong compose), không phải `localhost`.
- SSL fail: chờ Traefik renew Let's Encrypt; check DNS đã propagate chưa (`dig gettimetable.cloud`).
- Health check fail: BE startup mất ~60s do `prisma db push`, đảm bảo `start_period: 60s` trong compose.

---

## 19. Quy ước & Best practices khi maintain

### Code style
- **BE**: NestJS module-based pattern.
  - Controller: chỉ route + DTO + delegate to service.
  - Service: business logic + Prisma calls.
  - Không gọi PrismaClient trực tiếp; luôn qua `PrismaService`.
- **FE**: App Router conventions.
  - Server components default; thêm `'use client'` khi cần state/effect.
  - Auth state ở `localStorage` (không Redux — đơn giản).
  - Schedule data ở Redux (cross-component sync khi DnD).

### Khi thêm endpoint mới
1. Thêm method vào controller (decorator `@Get`/`@Post`/`@Put`/`@Delete`).
2. Thêm method service tương ứng.
3. Update `app.module.ts` nếu là module mới.
4. (FE) Thêm fetch call trong page tương ứng.
5. Cập nhật mục [9. API Reference](#9-api-reference-đầy-đủ) trong file này.

### Khi sửa schema
1. Edit `schema.prisma`.
2. `npx prisma migrate dev --name <name>`.
3. Update DTO/types ở BE + FE.
4. Cập nhật mục [5. Database Schema](#5-database-schema-chi-tiết).

### Khi sửa thuật toán
- **Phase 1** (`phase1_FixedSlots`): chỉ sửa khi thêm/bớt slot cố định mới (vd: học bán trú).
- **Phase 2** (`phase2_Heuristic`): sửa logic greedy / sort / classify.
- **Phase 3** (`phase3_Genetic`): sửa cost weights, swap strategies, SA params.
- **Constraint mới**: thêm vào `ConstraintService`:
  - `checkHardConstraints` (count violations)
  - `calculatePenalty` (sum SC)
  - `getFitnessDetails` (UI message)
  - **VÀ** `slotCost` trong Phase 3 (để optimization fix được)
- Test bằng `scripts/debug-fitness.ts` trước commit.

### Lock semantics
- `is_locked = true`:
  - Auto: Phase 1 fixed slots, slots bị `moveSlot`.
  - Manual: Admin toggle qua UI.
- Slots locked được **preserve** khi run lại thuật toán.
- Phase 2/3 không touch slots có `isLocked=true`.

### Performance
- Phase 2/3 dùng `Set`/`Map` index O(1), tránh scan array O(n²).
- `loadData` parallel `Promise.all` 5 queries.
- Save: `createMany({ skipDuplicates: true })` để batch insert + tận dụng 3 unique constraints.
- DB index: `teacher_constraints[teacher_id, day, period]`, `notifications[user_id, is_read, created_at]`.

### Naming conventions
- DB: snake_case (`teacher_id`, `created_at`).
- Prisma model: PascalCase (`TeacherConstraint`).
- TS code: camelCase (`teacherId`, `createdAt`).
- Const: SCREAMING_SNAKE_CASE (`MAX_ROUNDS`, `NUM_RESTARTS`).
- File: kebab-case (`algorithm.service.ts`).

### Vietnamese vs English
- DB: tiếng Anh (chuẩn quốc tế).
- API alias: tiếng Việt cho FE legacy (`/giao-vien`, `/cau-hinh-rang-buoc`) — đang dần rút bỏ.
- UI text: tiếng Việt (toàn bộ FE).
- Error messages: tiếng Việt cho user-facing.

---

## 20. Bug pattern & Pitfall

### Subject code mismatch
- Có nhiều variant: `SHCN`, `SH_CN`, `SINH_HOAT`, `SH_CUOI_TUAN`, `SH_DAU_TUAN`.
- Always dùng helper `resolveSubjectId` (Phase 1) hoặc check qua `aliases[]` trong SUBJECT_CATALOG.

### Period 1-10 (absolute) vs 1-5 (relative)
- `timetable_slots.period`: **absolute 1-10**.
- `teacher_constraints.period`: **relative 1-5** (within session).
- `ConstraintService.isTeacherBusy(t, d, absP)` tự convert: `absP <= 5 ? absP : absP - 5`.
- ⚠️ Khi seed/insert constraints thủ công phải nhớ format relative.

### Session 0/1/2
- Class: 0=Sáng, 1=Chiều (chỉ 2 values).
- TeacherConstraint: 0/1/2 (2 = Cả ngày).

### Multi-restart shallow copy
```ts
// SAI: reference share, mutate phase1Slots
const attemptSolution = { slots: phase1Slots, ... };

// ĐÚNG: clone từng element
const attemptSolution = { slots: phase1Slots.map(s => ({...s})), ... };
```

### Thursday block
T5 P5 và P10 luôn HC7. Đừng quên check trong heuristic mới.

### Move slot — unique constraint trap
Direct update day/period gây violation `unique_class_slot`. Phải swap qua temp position `(0, 0)` trong transaction.

### Slot có roomId nullable
- CHAO_CO không có phòng (`room_id = null`).
- `unique_room_slot` skip khi `room_id` null.
- Filter `groupBy(roomId)`: skip `'undefined'` và `'null'` strings.

### NestJS route order
`PUT /notifications/read-all` **phải** declare TRƯỚC `PUT /notifications/:id/read`. Otherwise `:id` matches `"read-all"`.

### Captcha case-insensitive
HMAC dùng `text.toLowerCase()`. Nếu user nhập "ABC" thì verify "abc". Đừng đổi.

### bcrypt fallback
`auth.service.ts` có fallback so plain text khi bcrypt fail. **Tech debt** — cần migrate hết legacy users sang bcrypt rồi xóa.

### Prisma "skipDuplicates"
Chỉ skip duplicate trên 3 unique constraints. KHÔNG skip duplicate ID hay FK violation.

### CORS allow-all
`enableCors()` không có config → accept all origin. Production nên whitelist.

### Auth chưa enforce
Endpoints chưa có `@UseGuards(JwtAuthGuard)`. FE gửi Bearer token nhưng BE không verify trên route khác `/auth/profile`. **Tech debt nghiêm trọng**.

---

## 21. Tech debt & Roadmap

### Critical (cần fix sớm)
- [ ] **JWT guard chưa apply** trên các route /resources, /system, /assignments, …
- [ ] **CORS whitelist** thay vì allow-all.
- [ ] Bỏ fallback plain-text password.
- [ ] Rate-limit `/auth/login` (chống brute-force).
- [ ] Validate file Excel size hơn 10MB → 413 thay vì cứng 400.

### Algorithm
- [ ] `NUM_RESTARTS = 1` — tăng + parallel (Worker thread).
- [ ] Module `constraints/hard|soft` (8+10 file rời) hiện không được dùng — đang trùng lặp với `constraint.service.ts`. Cần thống nhất.
- [ ] `ConstraintConfigController` (in-memory) chưa được hook vào fitness calculation.
- [ ] Greedy solver `greedy.solver.ts` legacy, ít dùng.

### FE
- [ ] Thay nhiều `fetch()` rời bằng axios `api` instance thống nhất.
- [ ] Error boundary global.
- [ ] Loading skeleton cho các page.
- [ ] Toast system thống nhất (đang dùng local state).
- [ ] i18n nếu cần multilingual.

### Test
- [ ] Coverage thấp — chỉ vài `*.spec.ts`. Cần unit test cho `ConstraintService`, integration test cho `/algorithm/start`.
- [ ] E2E với Playwright cho FE.

### DevOps
- [ ] CI/CD pipeline (GitHub Actions).
- [ ] Lint + typecheck pre-commit (husky).
- [ ] Backup DB schedule.
- [ ] Monitoring (Sentry / Prometheus).

### Future features
- [ ] Genetic algorithm thực sự (crossover giữa nhiều cá thể).
- [ ] WebSocket cho real-time progress thay vì polling.
- [ ] Mobile app GV (React Native).
- [ ] Multi-school support (multi-tenant).

---

## 22. Tham chiếu

### Tài liệu dự án
- [readme.md](readme.md) — Báo cáo phân tích nghiệp vụ.
- [readme1.md](readme1.md) — Tài liệu giải thuật Hybrid Algorithm.
- [readmedb.md](readmedb.md) — Báo cáo thiết kế CSDL.
- [BE_TKB/README.md](BE_TKB/README.md) — README Nest mặc định.
- [FE_TKB/README.md](FE_TKB/README.md) — README Next mặc định.

### Code paths quan trọng
- Schema: [BE_TKB/prisma/schema.prisma](BE_TKB/prisma/schema.prisma)
- Algorithm: [BE_TKB/src/algorithm/algorithm.service.ts](BE_TKB/src/algorithm/algorithm.service.ts)
- Constraints: [BE_TKB/src/algorithm/constraint.service.ts](BE_TKB/src/algorithm/constraint.service.ts)
- Auth: [BE_TKB/src/auth/auth.service.ts](BE_TKB/src/auth/auth.service.ts)
- Excel logic: [BE_TKB/src/excel/excel.service.ts](BE_TKB/src/excel/excel.service.ts)
- Excel constants: [BE_TKB/src/excel/excel.constants.ts](BE_TKB/src/excel/excel.constants.ts)
- Worker: [BE_TKB/src/worker/algorithm.producer.ts](BE_TKB/src/worker/algorithm.producer.ts), [BE_TKB/src/worker/algorithm.processor.ts](BE_TKB/src/worker/algorithm.processor.ts)
- Bootstrap: [BE_TKB/src/main.ts](BE_TKB/src/main.ts)
- App module: [BE_TKB/src/app.module.ts](BE_TKB/src/app.module.ts)
- FE main timetable page: [FE_TKB/app/admin/timetable/page.tsx](FE_TKB/app/admin/timetable/page.tsx)
- FE store: [FE_TKB/lib/features/schedule/scheduleSlice.ts](FE_TKB/lib/features/schedule/scheduleSlice.ts)
- Compose: [docker-compose.yml](docker-compose.yml)
- Env: [.env.example](.env.example)

### Tham chiếu pháp lý (chương trình giáo dục)
- Thông tư 32/2018/TT-BGDĐT — Chương trình GDPT 2018.
- Thông tư 13/2022/TT-BGDĐT — Lịch sử bắt buộc THPT.
- Thông tư 05/2025/TT-BGDĐT — Chế độ làm việc GV.
- Công văn 5512/BGDĐT-GDTrH — Hướng dẫn xây dựng kế hoạch giáo dục.

### Git
- Branch chính: `main`.
- User commit recent: `khoidev2001`.
- Commits gần đây (xem `git log`): feat-style commits cho algorithm/constraint refactor.

### Liên hệ nội bộ
- Khi gặp vấn đề thuật toán: đọc kỹ mục [6](#6-thuật-toán-xếp-lịch--hybrid-ga) + [7](#7-hàm-fitness--constraints) trước.
- Khi import Excel fail: check `excel.constants.ts:HEADER_ALIASES` xem header có match không.
- Khi DB lỗi unique constraint: chắc chắn `(timetable_id, day, period)` không trùng cho cùng class/teacher/room.

---

**Document version**: 1.1 (chi tiết đầy đủ).
**Last updated**: 2026-05-04.
