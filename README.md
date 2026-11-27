# MiKiTimetable — Hệ thống xếp thời khóa biểu THPT

Xếp thời khóa biểu tự động cho trường THPT theo chương trình GDPT 2018: nhập giáo viên, lớp, môn,
phân công, ràng buộc → chạy thuật toán → chỉnh tay, đổi tiết, xuất Excel.

| Phần | Thư mục | Công nghệ | Cổng mặc định |
|---|---|---|---|
| Backend (API) | [BE_TKB](BE_TKB) | NestJS 11, Prisma 5, BullMQ | 4000 |
| Frontend | [FE_TKB](FE_TKB) | Next.js 16, React 19, Tailwind 4 | 3000 (dev) / 3001 (Docker) |
| Cơ sở dữ liệu | [docker-compose.yml](docker-compose.yml) | PostgreSQL 17, Redis 7 | 5435 / 6381 (Docker) |

Có hai cách chạy. **Cách 1 (Docker)** ít bước nhất, nên dùng nếu chỉ muốn xem hệ thống chạy.
**Cách 2 (chạy từng phần)** dành cho người sửa code.

---

## Cách 1 — Docker (khuyến nghị)

Cần: [Docker](https://www.docker.com/) có Docker Compose v2.

```bash
git clone https://github.com/Khoidev-01/Timetable_Gen.git
cd Timetable_Gen

cp .env.example .env
```

Mở `.env` và sửa **tối thiểu** các dòng sau:

```env
# Bắt buộc, từ 32 ký tự trở lên. Sinh nhanh: openssl rand -base64 48
JWT_SECRET=<chuỗi-ngẫu-nhiên-dài>

# Bắt buộc: mật khẩu Redis. Thiếu thì docker compose từ chối chạy.
REDIS_PASSWORD=<chuỗi-ngẫu-nhiên>

# Chạy thử trên máy cá nhân, chưa có SMTP thì tắt bước OTP (xem mục "Đăng nhập" bên dưới)
OTP_ENABLED=false
```

Rồi chạy:

```bash
docker compose up -d --build
```

Lần đầu mất vài phút, phần lớn là build hai image. Sau khi build, backend đồng bộ schema và nạp dữ liệu
mẫu mất khoảng chục giây (healthcheck cho phép tối đa 4 phút trên máy yếu). Theo dõi:

```bash
docker compose ps                 # đợi backend và frontend đều "healthy"
docker compose logs -f backend    # xem backend khởi động
```

Khi xong:

| Địa chỉ | Là gì |
|---|---|
| http://localhost:3001 | Giao diện web |
| http://localhost:4000/api/docs | Tài liệu API (Swagger) |

PostgreSQL và Redis **không** mở cổng ra máy chủ, chỉ backend trong mạng Docker nối được tới chúng.

> Frontend ở Docker nằm cổng **3001** (không phải 3000). Địa chỉ API được nướng vào frontend lúc
> build qua `NEXT_PUBLIC_API_URL`; đổi biến này thì phải build lại: `docker compose up -d --build frontend`.

Dừng: `docker compose down` (giữ dữ liệu). Xóa cả dữ liệu: `docker compose down -v`.

---

## Cách 2 — Chạy từng phần để phát triển

Cần: Node.js 22 (CI dùng 20, Docker dùng 22), npm, và Docker (chỉ để chạy PostgreSQL + Redis).

### 2.1 PostgreSQL và Redis

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
```

File [docker-compose.dev.yml](docker-compose.dev.yml) mở hai dịch vụ này ra máy bạn ở cổng **5435**
(Postgres) và **6381** (Redis), chỉ bind `127.0.0.1`. **Không dùng file này trên máy chủ deploy.**
Redis yêu cầu mật khẩu `REDIS_PASSWORD` trong `.env` gốc.
Thông tin đăng nhập DB lấy từ `.env` gốc (xem `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

### 2.2 Backend

```bash
cd BE_TKB
cp .env.example .env
```

Sửa `BE_TKB/.env`:

```env
JWT_SECRET=<chuỗi-ngẫu-nhiên-từ-32-ký-tự>
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5435/tkb_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6381
REDIS_PASSWORD=<trùng REDIS_PASSWORD trong .env gốc>
OTP_ENABLED=false
```

> `<POSTGRES_PASSWORD>` phải trùng giá trị trong `.env` gốc (mặc định của compose nếu không đặt là
> `changeme`).

Khởi tạo cơ sở dữ liệu rồi chạy (đúng thứ tự mà [startup.sh](BE_TKB/scripts/startup.sh) dùng trong Docker):

```bash
npm ci
npx prisma generate
npx prisma db push                  # tạo bảng theo prisma/schema.prisma
node scripts/run-data-migrations.js # nạp dữ liệu trường mẫu ("happy case")
node scripts/seed-admin.js          # tạo tài khoản admin nếu chưa có
npm run start:dev                   # chạy có watch, cổng 4000
```

### 2.3 Frontend

Mở terminal khác:

```bash
cd FE_TKB
npm ci
npm run dev                         # cổng 3000
```

Frontend gọi API ở `http://localhost:4000` (mặc định). Backend không ở địa chỉ đó thì đặt
`NEXT_PUBLIC_API_URL` trước khi chạy.

Mở http://localhost:3000.

---

## Đăng nhập

Tài khoản quản trị tạo sẵn: **`admin` / `123456`**. Hãy đổi mật khẩu ngay nếu đưa lên máy chủ thật.

Đăng nhập có hai lớp:

1. **Captcha**: nhập mã trong ảnh ở form đăng nhập.
2. **Mã OTP 6 số gửi qua email** (bước 2). Mặc định bật (`OTP_ENABLED=true`).
   - **Chạy thử trên máy**: đặt `OTP_ENABLED=false` để bỏ bước này.
   - **Muốn dùng OTP thật**: điền `ADMIN_EMAIL` (email nhận mã của admin) và nhóm `SMTP_*`
     (mặc định mẫu dùng [Resend](https://resend.com): `SMTP_PASS` là API key, domain trong `SMTP_FROM`
     phải được xác minh). Thiếu `ADMIN_EMAIL` thì admin không đăng nhập được.

Giáo viên đăng nhập bằng tài khoản được tạo trong trang quản trị; mật khẩu khởi tạo lấy từ
`TEACHER_INITIAL_PASSWORD` (mặc định `123456`).

> Đăng nhập sai quá 5 lần/phút từ một địa chỉ sẽ bị chặn tạm thời.

---

## Dữ liệu mẫu

Lần khởi động đầu tiên, backend tự nạp một trường mẫu (giáo viên, lớp, tổ bộ môn, phân công) từ
[BE_TKB/scripts/data](BE_TKB/scripts/data). Việc này chạy **một lần** và được ghi vào bảng
`_app_data_migrations`, các lần sau bỏ qua.

> ⚠️ Bước nạp mẫu đầu tiên **xóa toàn bộ dữ liệu cũ trừ tài khoản admin**. Đừng trỏ backend vào một
> cơ sở dữ liệu đang có dữ liệu thật mà bạn muốn giữ.

Ngoài ra ở thư mục gốc có file Excel mẫu [Du_lieu_mau_GDPT2018_30lop.xlsx](Du_lieu_mau_GDPT2018_30lop.xlsx)
(30 lớp) để thử chức năng nhập từ Excel trên giao diện.

---

## Biến môi trường

Đầy đủ và có chú thích: [.env.example](.env.example) (Docker) và [BE_TKB/.env.example](BE_TKB/.env.example) (chạy tay).

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `JWT_SECRET` | Có | Khóa ký token, ≥ 32 ký tự. Thiếu hoặc ngắn thì backend **không khởi động**. |
| `REDIS_PASSWORD` | Có | Mật khẩu Redis (compose bắt buộc; backend dùng cho captcha, OTP, hàng đợi). |
| `DATABASE_URL` | Có (Cách 2) | Chuỗi kết nối PostgreSQL. Docker tự dựng. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Docker | Thông tin DB do compose tạo. |
| `OTP_ENABLED` | Không | `false` để bỏ OTP khi chạy thử. |
| `ADMIN_EMAIL`, `SMTP_*` | Khi bật OTP | Email nhận mã và máy chủ gửi thư. |
| `NEXT_PUBLIC_API_URL` | Không | Địa chỉ API mà trình duyệt gọi. Mặc định `http://localhost:4000`. |
| `CORS_ORIGIN`, `CORS_ORIGINS` | Không | Origin được gọi API. Phải chứa địa chỉ frontend bạn đang mở. |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Không | Trợ lý AI. Để trống `LLM_API_KEY` thì trợ lý tự tắt, phần còn lại vẫn chạy. |
| `TKB_SEARCH_MAIN` | Không | Số nước đi mỗi lần xếp (mặc định 2,4 triệu). Giảm thì xếp nhanh hơn nhưng kém chất lượng. |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Backend thoát ngay, log nhắc `JWT_SECRET` | Chưa đặt hoặc ngắn hơn 32 ký tự. |
| Đăng nhập báo "Hệ thống chưa cấu hình email quản trị" | `OTP_ENABLED` đang `true` mà thiếu `ADMIN_EMAIL`. Tắt OTP hoặc điền email. |
| Đăng nhập chờ mã OTP mãi không thấy | SMTP chưa đúng hoặc domain gửi chưa xác minh. Xem `docker compose logs backend`. |
| Trình duyệt báo lỗi CORS | Địa chỉ trang web chưa nằm trong `CORS_ORIGIN`/`CORS_ORIGINS`. |
| Frontend gọi nhầm API sau khi đổi `NEXT_PUBLIC_API_URL` | Biến này nướng lúc build; build lại frontend. |
| `docker compose up` báo `port is already allocated` | Cổng 4000, 3001 (hoặc 5435, 6381 khi dùng file dev) đã có chương trình khác dùng. Container bị trùng sẽ ở trạng thái `Created` và không chạy. Với Postgres/Redis chỉ gặp khi dùng `docker-compose.dev.yml`. Đổi vế trái của dòng `ports:` tương ứng trong [docker-compose.yml](docker-compose.yml) (ví dụ `"3101:3000"`), rồi chạy lại. Nếu đổi cổng frontend, thêm địa chỉ mới (ví dụ `http://localhost:3101`) vào `CORS_ORIGINS` trong `.env`, nếu không trình duyệt sẽ bị chặn CORS. |
| Backend `unhealthy` lúc mới chạy | Đang đồng bộ schema và nạp dữ liệu; đợi rồi xem `docker compose ps` lại. |
| Chạy tay: không kết nối được DB/Redis | Cổng Docker là 5435 và 6381, không phải 5432/6379 như `BE_TKB/.env.example`. Cũng phải chạy kèm `docker-compose.dev.yml` và đặt `REDIS_PASSWORD`. |
| Backend báo `NOAUTH` / `WRONGPASS` | `REDIS_PASSWORD` của backend khác với của Redis. |
| `docker compose up` báo thiếu `REDIS_PASSWORD` | Chưa đặt trong `.env`. |

---

## Lệnh hữu ích

```bash
# Backend (trong BE_TKB)
npx tsc --noEmit -p tsconfig.json   # kiểm tra kiểu
npx jest --ci                       # chạy test (CI chạy bộ này)
npm run build                       # build production

# Frontend (trong FE_TKB)
npx tsc --noEmit -p tsconfig.json
npm run build
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy kiểm tra kiểu, test và build cho cả hai
phía, và kiểm tra các migration Prisma không bị `.gitignore` bỏ sót.
