# Kịch bản demo trước ban giám khảo

Viết cho người ngồi bấm máy trong buổi demo. Mỗi bước là một thao tác cụ thể, kèm thứ
sẽ hiện ra để biết mình đang đi đúng.

Toàn bộ kịch bản mất khoảng 15–20 phút, trong đó có một quãng chờ máy xếp lịch (được lấp
bằng Cảnh 2b). Đọc mục **Chuẩn bị** trước ngày demo, đừng để đến lúc lên sân khấu mới làm.

**Đường dẫn:** `gettimetable.cloud` giờ là **trang giới thiệu**, không còn là màn đăng nhập.
Muốn đăng nhập thì bấm nút **Đăng nhập** ở góc phải trên, hoặc mở thẳng
`gettimetable.cloud/login`.

---

## Chuẩn bị (làm trước, không làm trên sân khấu)

| Việc | Cách kiểm |
|---|---|
| Đã deploy bản mới nhất | Mở https://gettimetable.cloud, thấy trang giới thiệu có ảnh 3D |
| Đăng nhập được | Bấm **Đăng nhập** góc phải trên, vào bằng `admin` |
| File Excel của Tổ Toán nằm trên máy demo | `Desktop\ExcelNCKH\phan-cong-tổ-toán-2026-2027.xlsx` |
| Tài khoản gv004 đã khai email nhận OTP | Đăng nhập thử một lần trước, xem mục dưới |
| Trợ lý AI trả lời được | Đăng nhập, mở khung chat, hỏi "tôi dạy môn gì" |
| Mã QR trỏ đúng tên miền | Xem Cảnh 5; link dưới mã phải bắt đầu bằng `https://gettimetable.cloud` |

**Tài khoản**

| Vai | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin` | `123456` |
| Cô Võ Ngọc An — tổ trưởng Tổ Toán | `gv004` | `123456` |

Đăng nhập lần đầu sẽ hỏi email để nhận mã 6 số. Làm bước này trước buổi demo cho cả hai
tài khoản, để trên sân khấu chỉ còn gõ mật khẩu.

---

## Cảnh 0 — Trang giới thiệu (30 giây, tuỳ chọn)

Mở `gettimetable.cloud` và cuộn chậm một lượt: khối mở đầu, ba tính năng, quy trình ba
bước, trợ lý Miki, rồi dừng ở khối kêu gọi đăng nhập.

Cuộn xuống thì thanh menu trên cùng tự ẩn đi cho rộng màn hình, cuộn ngược lên là nó hiện
lại ngay. Các hình minh họa 3D nhúc nhích nhẹ như đang thở.

Xong thì bấm **Đăng nhập** ở góc phải trên để sang Cảnh 1.

---

## Cảnh 1 — Tổ trưởng nộp bảng phân công (2 phút)

Câu dẫn: *"Mỗi tổ chuyên môn tự phân công giáo viên cho tổ mình. Hệ thống phát mẫu Excel
điền sẵn, tổ trưởng chỉ điền mã giáo viên."*

1. Từ trang giới thiệu, bấm **Đăng nhập** (hoặc mở thẳng `gettimetable.cloud/login`), rồi
   đăng nhập `gv004`.
2. Menu trái, bấm **Phân công tổ**.
3. Chỉ cho ban giám khảo thấy: đây là Tổ Toán, 30 dòng lớp – môn, chưa nộp lần nào.
4. Bấm **Tải mẫu phân công** — mở file vừa tải, cho thấy các cột đã điền sẵn lớp, môn, số
   tiết; tổ trưởng chỉ điền cột *GV HK1 Mã*, có sẵn danh sách chọn.
   *(Nếu muốn nhanh, bỏ qua bước mở file này.)*
5. Bấm **Chọn file .xlsx**, chọn `Desktop\ExcelNCKH\phan-cong-tổ-toán-2026-2027.xlsx`.
6. Bấm **Nộp**.

Sẽ thấy: báo nộp thành công, **30/30 dòng có giáo viên, không lỗi, không cảnh báo**.

---

## Cảnh 2 — Admin tổng hợp và để máy xếp lịch (chờ 5–7 phút mỗi học kỳ)

Câu dẫn: *"Sáu tổ còn lại đã nộp từ trước. Giờ nhà trường gộp lại và để hệ thống xếp."*

1. Đăng nhập `admin` (nên mở sẵn ở một cửa sổ khác từ trước).
2. Menu trái, bấm **Tổng hợp**.
3. Bảng **Bài nộp của các tổ**: cả 7 tổ đều đã nộp, Tổ Toán là bài vừa nộp xong.
4. Bấm **Tổng hợp**. Sẽ thấy: *"Không có lỗi: mọi lớp – môn đều có giáo viên, không ai
   vượt định mức."*
   - Nói rõ điểm đáng chú ý: những dòng tổ trưởng để trống, hệ thống tự điền đúng chuyên
     môn; chào cờ và sinh hoạt tự giao cho giáo viên chủ nhiệm.
5. Bấm **Phân công tự động**.

Sẽ thấy: hệ thống nhập bảng hoàn chỉnh (khoảng 968 phân công) rồi bắt đầu xếp thời khóa
biểu cả hai học kỳ. **Việc xếp mất vài phút** — trên máy thử của mình HK1 mất khoảng 6
phút.

> Đừng đứng im chờ. Dùng quãng này cho **Cảnh 2b** ngay dưới. Thỉnh thoảng liếc trang
> **Thời khóa biểu** của admin; xếp xong, trang này hiện thời khóa biểu và bậc chất lượng.

---

## Cảnh 2b — Trong lúc chờ xếp lịch: hỏi trợ lý AI (3–4 phút)

Câu dẫn: *"Trong lúc máy xếp lịch, giáo viên vẫn hỏi được trợ lý. Trợ lý chỉ trả lời từ
dữ liệu thật của trường, và chỉ trong phạm vi thời khóa biểu."*

Chuyển sang cửa sổ `gv004`, bấm khung chat trợ lý ở góc dưới bên phải. Gõ lần lượt:

**1. Trợ lý biết mình đang nói chuyện với ai**

> Tôi thuộc tổ chuyên môn nào?

Sẽ thấy: *Tổ Toán, Tổ trưởng chuyên môn.*

> Định mức của tôi mỗi tuần là bao nhiêu tiết, được giảm bao nhiêu và vì sao?

Sẽ thấy: *17 tiết, giảm 3 vì là tổ trưởng, còn 14 tiết/tuần.*

> Tôi dạy được những khối nào?

Sẽ thấy: *Toán khối 10 và khối 12.*

> Còn lớp chủ nhiệm thì sao?

Sẽ thấy: *không chủ nhiệm lớp nào.* Câu này cố ý hỏi cụt — trợ lý hiểu "còn … thì sao" là
hỏi tiếp về hồ sơ của chính cô An, nhờ nhớ các câu trước. Hội thoại dài thì phần cũ được tự
nén thành ghi nhớ, nên trợ lý không quên những gì đã nói ở đầu.

- Điểm đáng nói: trợ lý không tự nhớ hay đoán số liệu; nó gọi công cụ đọc thẳng hồ sơ trong
  cơ sở dữ liệu, rồi mới diễn đạt lại thành câu.
- Trợ lý gọi người dùng là "Thầy/Cô": hồ sơ không có giới tính nên nó không đoán.

> Giữ đúng thứ tự trên. Nếu hỏi "Còn lớp chủ nhiệm thì sao?" ngay sau câu về cô Võ Thị
> Chi, trợ lý sẽ không biết đang hỏi về ai và hỏi lại.

**2. Trợ lý không cho xem hồ sơ người khác**

> Cô Võ Thị Chi thuộc tổ nào, chủ nhiệm lớp nào?

Sẽ thấy: trợ lý từ chối vì tài khoản giáo viên không xem được hồ sơ của đồng nghiệp.

**3. Trợ lý từ chối câu ngoài phạm vi**

> Viết cho tôi một bài thơ về mùa thu.

Sẽ thấy: *"Tôi chỉ hỗ trợ về thời khóa biểu…"* kèm dòng nhắc *(1/3 câu ngoài phạm vi…)*.

- Điểm đáng nói: hỏi ngoài phạm vi **3 câu liên tiếp** thì trợ lý tự khoá 10 phút với người
  đó — chặn dùng trợ lý như ChatGPT miễn phí. Chỉ nói điều này, **đừng hỏi đủ 3 câu**: khoá
  thật thì Cảnh 3 không chạy được.
- Hỏi tiếp một câu đúng phạm vi là bộ đếm về 0.

> Trước khi sang Cảnh 3, bấm **Hội thoại mới** trong khung chat cho sạch.

---

## Cảnh 3 — Cô An nhờ đổi tiết, hỏi ngay trong khung chat (3 phút)

Đây là cảnh gây ấn tượng nhất: giáo viên nói bằng tiếng Việt, trợ lý tự tra lịch, tự kiểm
ràng buộc, rồi dựng sẵn lời nhờ đổi — chỉ còn bấm một nút.

**Trước khi diễn:** vào tài khoản `gv004`, mở **Thời khóa biểu**, chọn lấy một tiết của cô
An trong tuần (ví dụ *Toán 10C4, thứ hai tiết 2*). Nhớ lớp, thứ, tiết để lát gõ vào chat.

> Chọn tiết của **học kỳ 1** — trợ lý tra theo học kỳ hiện tại. Gõ một tiết chỉ có ở HK2
> thì trợ lý sẽ (đúng) trả lời là cô không có tiết đó, và mạch demo bị gãy.

1. Vẫn ở tài khoản `gv004`, bấm khung chat trợ lý ở góc dưới bên phải.
2. Gõ đúng một câu như đời thường:

   > Tiết Toán lớp 10C4 thứ hai tiết 2 tôi bận họp, nhờ ai đổi giúp được không?

3. Trợ lý sẽ tra lịch của cô An, tìm các tiết đổi được, rồi đọc ra vài phương án kèm **tên
   đồng nghiệp, môn và lớp**, và nói phương án nào làm thời khóa biểu tốt lên hay kém đi.
   - Điểm đáng nói với ban giám khảo: mọi phương án đều **đã được bộ kiểm tra ràng buộc
     chấm trước**, không phải do mô hình tự nghĩ ra.
4. Chọn một phương án, gõ tiếp:

   > Nhờ gửi giúp tôi phương án đầu, lý do là bận họp chuyên môn.

5. Trợ lý hiện một **thẻ xác nhận màu vàng**, ghi rõ: nhờ ai, đổi tiết nào lấy tiết nào,
   lý do gì. Trợ lý **không tự gửi**.
6. Bấm **Xác nhận gửi**.

Sẽ thấy: *"Đã gửi lời nhờ đổi tiết. Đồng nghiệp trả lời xong thì quản trị viên duyệt."*
Đồng nghiệp lập tức nhận được thông báo 🔄 trong hệ thống.

---

## Cảnh 4 — Đồng nghiệp đồng ý, nhà trường duyệt (2 phút)

1. Đăng nhập tài khoản đồng nghiệp mà trợ lý vừa nhờ (tên đăng nhập là mã giáo viên viết
   thường, ví dụ `gv0xx`, mật khẩu `123456`).
2. Menu trái, bấm **Đổi tiết**, phần **Yêu cầu của bạn** — thấy lời nhờ của cô An.
3. Bấm **Đồng ý đổi**.
4. Quay lại cửa sổ `admin`, menu trái bấm **Duyệt đổi tiết**.
5. Bấm **Duyệt**.

Sẽ thấy: thời khóa biểu đổi ngay. Mở **Thời khóa biểu** của cô An: tiết đó đã nhảy sang
giờ mới, và tiết của đồng nghiệp nhảy về chỗ cũ của cô An.

Câu chốt: *"Ba người, ba vai, không ai sửa tay vào thời khóa biểu. Ràng buộc được kiểm lại
đúng lúc bấm Duyệt, nên không thể duyệt ra một lịch sai."*

---

## Cảnh 5 — Mã QR dán bảng tin (1 phút)

Câu dẫn: *"Giáo viên không cần tài khoản để xem lịch. Nhà trường dán một mã QR lên bảng
tin là xong."*

1. Cửa sổ `admin`, menu trái bấm **Thời khóa biểu**, kéo xuống khối **Công bố**.
2. Bấm **Công bố bản mới nhất**. Xếp lịch xong **không** tự công bố, mà chưa công bố thì
   chưa có mã QR.
3. Bấm **Mã QR**.
4. Chỉ vào dòng chữ ngay dưới mã: đường dẫn phải bắt đầu bằng `https://gettimetable.cloud`.
5. Quét bằng điện thoại thật, đưa màn hình điện thoại cho ban giám khảo xem: trang mở ra
   cho tra theo lớp hoặc theo giáo viên, kèm lịch hôm nay đã tính cả tiết dạy thay.

> Nếu đường dẫn hiện `http://localhost:3000` thì máy chủ thiếu biến `PUBLIC_WEB_URL`. Hệ
> thống có lưới an toàn nên thường vẫn ra tên miền thật, nhưng thấy localhost là bỏ cảnh
> này, đừng quét trước mặt ban giám khảo.

---

## Phương án dự phòng

**Nếu trợ lý AI không trả lời** (báo "Trợ lý tạm thời không phản hồi"): bỏ Cảnh 3, làm
thẳng trên giao diện — cùng kết quả, chỉ kém phần ấn tượng:

1. `gv004` → menu trái **Đổi tiết**.
2. Mục **1. Chọn tiết của bạn**: chọn tiết cần đổi.
3. Mục **2. Chọn tiết muốn đổi**: hệ thống liệt kê các tiết đổi được kèm tên đồng nghiệp.
4. Mục **3. Gửi yêu cầu**: ghi lý do, bấm **Gửi cho <tên đồng nghiệp>**.

Rồi tiếp tục Cảnh 4 như bình thường.

**Nếu trợ lý báo "Bạn đã hỏi 20 câu trong 10 phút":** mỗi tài khoản chỉ được hỏi 20 câu
trong 10 phút, và Cảnh 2b + Cảnh 3 đã dùng khoảng 8 câu. **Đừng tập dượt bằng `gv004` trong
vòng 10 phút trước khi lên.** Lỡ bị khoá rồi thì chuyển sang phương án làm tay ở trên.

**Nếu xếp lịch lâu hơn dự kiến:** cứ để chạy, chuyển sang nói phần khác; trang Thời khóa
biểu tự cập nhật khi xong. Đừng bấm Phân công tự động lần hai.

**Nếu nộp Excel báo lỗi "Đây là mẫu của tổ khác":** đang đăng nhập nhầm tài khoản. Phải là
`gv004`.

---

## Thứ tự cửa sổ nên mở sẵn

| Cửa sổ | Tài khoản | Trang |
|---|---|---|
| 1 | chưa đăng nhập | `gettimetable.cloud` (trang giới thiệu, cho Cảnh 0) |
| 2 | `gv004` | Phân công tổ |
| 3 | `admin` | Tổng hợp |
| 4 | `admin` | Thời khóa biểu |

Mở sẵn bốn cửa sổ này trước khi lên, đăng nhập xong. Trên sân khấu chỉ chuyển tab.

> Cửa sổ 1 phải là cửa sổ ẩn danh, hoặc trình duyệt khác. Trang giới thiệu không tự chuyển
> hướng, nhưng dùng chung cửa sổ đã đăng nhập thì bấm **Đăng nhập** sẽ nhảy thẳng vào trong,
> mất mạch Cảnh 0.
