# Deploy lên Railway

Một project Railway gồm 4 service: **Postgres**, **Redis**, **backend** (`BE_TKB`), **frontend** (`FE_TKB`).
Postgres và Redis chỉ nằm trong mạng nội bộ của Railway, không mở cổng ra ngoài.

## 1. Tạo project

1. Railway → New Project → **Deploy from GitHub repo** → chọn repo này.
2. Railway tạo một service từ repo. Đổi tên thành `backend`, vào Settings:
   - **Root Directory**: `BE_TKB`
   - Builder tự nhận `railway.toml` trong thư mục đó.
3. New → **Database → PostgreSQL**. Đặt tên `Postgres`.
4. New → **Database → Redis**. Đặt tên `Redis`.
5. New → **GitHub Repo** (cùng repo) → đổi tên `frontend` → Root Directory: `FE_TKB`.

Tên service dùng trong biến tham chiếu bên dưới (`${{Postgres...}}`, `${{Redis...}}`) phải khớp tên bạn đặt.

## 2. Biến môi trường — service `backend`

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}

JWT_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>
TEACHER_INITIAL_PASSWORD=<mật khẩu khởi tạo cho giáo viên>

# Địa chỉ công khai
CORS_ORIGIN=https://gettimetable.cloud
CORS_ORIGINS=https://gettimetable.cloud
PUBLIC_WEB_URL=https://gettimetable.cloud
BETTER_AUTH_URL=https://api.gettimetable.cloud

# OTP đăng nhập (xem .env.example để biết đủ nhóm SMTP_*)
OTP_ENABLED=true
ADMIN_EMAIL=<email nhận mã của admin>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<API key>
SMTP_FROM=MiKiTimetable <no-reply@gettimetable.cloud>

# Trợ lý AI (để trống LLM_API_KEY thì trợ lý tắt)
LLM_BASE_URL=https://airouter.mikitech.io/api/v1
LLM_API_KEY=<khoá>
LLM_MODEL=cxgptsol
```

Không đặt `PORT`: Railway tự cấp và backend đọc `PORT`.

> Tên biến Redis (`REDISHOST`, `REDISPORT`, `REDISPASSWORD`) lấy theo template Redis của Railway. Khi gõ
> `${{` trong ô giá trị, Railway gợi ý đúng tên các biến của service `Redis`; hãy chọn từ gợi ý
> thay vì tin tên ở đây.

## 3. Biến môi trường — service `frontend`

```env
NEXT_PUBLIC_API_URL=https://api.gettimetable.cloud
```

Biến này được nướng vào lúc build; đổi xong phải **Redeploy**.

## 4. Mạng và tên miền

1. `backend` → Settings → Networking → **Generate Domain** (để thử) → sau đó **Custom Domain**: `api.gettimetable.cloud`.
2. `frontend` → Networking → Custom Domain: `gettimetable.cloud`.
3. Railway hiện bản ghi DNS cần tạo (CNAME, hoặc A/ALIAS cho tên miền gốc). Tạo ở nơi quản lý DNS.
   **Chỉ đổi DNS sau khi đã thử bản `*.up.railway.app` chạy tốt.** Đổi DNS là lúc trang cũ ngừng phục vụ.
4. Socket.io chạy bình thường qua domain của Railway (WebSocket được hỗ trợ).

## 5. Dữ liệu

Lần đầu backend khởi động, `startup.sh` đồng bộ schema và nạp dữ liệu trường mẫu. Bước nạp này
**xoá mọi dữ liệu trừ tài khoản admin**, nên chỉ phù hợp với database trống.

Nếu muốn giữ dữ liệu đang chạy ở VPS/Coolify, chép sang **trước khi** backend chạy lần đầu:

```bash
# trên máy có quyền vào DB cũ
pg_dump --no-owner --no-acl -Fc "<URL DB cũ>" -f tkb.dump
# URL public của Postgres trên Railway: service Postgres → Connect → Public Network
pg_restore --no-owner --no-acl -d "<URL public Railway>" tkb.dump
```

Sau đó mới deploy backend. Bảng `_app_data_migrations` đi theo bản dump nên các bước nạp mẫu sẽ được bỏ qua.

## 6. Kiểm tra sau deploy

- `https://api.gettimetable.cloud/api/docs` mở được.
- `https://gettimetable.cloud` mở được, đăng nhập có captcha, OTP về email.
- Chạy một lần xếp thời khóa biểu, thấy tiến độ cập nhật trực tiếp (kiểm tra WebSocket + worker).
