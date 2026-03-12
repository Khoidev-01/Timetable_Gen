# BÁO CÁO PHÂN TÍCH NGHIỆP VỤ (BUSINESS LOGIC)
## HỆ THỐNG XẾP THỜI KHÓA BIỂU TRƯỜNG THPT (TIMETABLE SCHEDULING SYSTEM)

---

## 1. MÔ TẢ BÀI TOÁN (PROBLEM STATEMENT)

Bài toán xếp thời khóa biểu (Timetabling Problem) là một bài toán tối ưu hóa tổ hợp kinh điển (NP-Complete). Mục tiêu là phân bổ tài nguyên (Giáo viên, Phòng học) vào các khung thời gian (Thứ, Tiết) cho các đối tượng (Lớp học) nhằm thỏa mãn một tập hợp các ràng buộc phức tạp.

**Mục tiêu của hệ thống**: Tự động hóa 100% quy trình xếp lịch, giảm thiểu thời gian xếp thủ công từ hàng tuần xuống còn vài phút, đồng thời tối ưu hóa sự thuận tiện cho giáo viên.

---

## 2. CÁC TÁC NHÂN HỆ THỐNG (ACTORS)

| Tác nhân | Vai trò | Quyền hạn |
| :--- | :--- | :--- |
| **Ban Giám Hiệu (Admin)** | Quản trị viên | - Cấu hình hệ thống (Năm học, Môn, Lớp).<br>- Phân công chuyên môn (Ai dạy lớp nào).<br>- Chạy thuật toán xếp lịch.<br>- Chốt và công bố TKB chính thức. |
| **Giáo viên (Teacher)** | Người dùng | - Xem TKB cá nhân.<br>- Đăng ký lịch bận/nguyện vọng nghỉ.<br>- Gửi phản hồi/yêu cầu điều chỉnh lịch. |

---

## 3. QUY TRÌNH NGHIỆP VỤ CHI TIẾT (BUSINESS PROCESS)

Quy trình nghiệp vụ được chia thành 3 giai đoạn chính: **Đầu vào (Pre-processing)** -> **Xử lý (Scheduling)** -> **Đầu ra (Post-processing)**.

### 3.1. Giai đoạn 1: Thiết lập Dữ liệu & Ràng buộc (Input)
Đây là giai đoạn quan trọng nhất, dữ liệu đầu vào càng chính xác thì kết quả càng tối ưu.

1.  **Thiết lập Chu kỳ (Cycle Setup)**:
    *   Admin tạo Năm học (VD: 2024-2025) và Học kỳ (HK1).
    *   Hệ thống khởi tạo lưới thời gian trống (6 ngày/tuần * 10 tiết/ngày).

2.  **Phân công Chuyên môn (Teaching Assignments)**:
    *   Quy định cốt lõi: **Giáo viên A** dạy **Môn B** cho **Lớp C** với số lượng **K tiết/tuần**.
    *   *Nghiệp vụ Block*: Một số môn (Toán, Văn) cần học liền 2 tiết (Block Assignment), hệ thống phải ghi nhận cấu hình này để không xếp rời rạc.

3.  **Thu thập Nguyện vọng (Constraints Gathering)**:
    *   Giáo viên đăng nhập, đánh dấu các ô "Bận" (Busy) vào các thời điểm không thể dạy.
    *   Hệ thống ghi nhận đây là **Ràng buộc Cứng** (Hard Constraint) để thuật toán tuyệt đối tránh.

### 3.2. Giai đoạn 2: Xếp lịch Tự động (Processing)
Hệ thống sử dụng thuật toán lai (Hybrid Algorithm) kết hợp giữa Heuristic và Genetic Algorithm.

1.  **Bước 1: Xếp các Tiết Cố định (Fixed Slots)**:
    *   Các tiết như *Chào cờ* (Thứ 2, Tiết 1), *Sinh hoạt lớp* (Thứ 7, Tiết 5) được xếp trước tiên để cố định khung.

2.  **Bước 2: Xếp các Môn Đặc thù (Special Subjects)**:
    *   Môn Thể dục/Quốc phòng xếp vào các buổi trái buổi hoặc các tiết cuối để tránh ảnh hưởng sức khỏe/vệ sinh.
    *   Môn Thực hành (Tin, Lý, Hóa) cần xếp vào phòng chức năng (Lab) thay vì phòng học.

3.  **Bước 3: Tối ưu hóa (Optimization Cycle)**:
    *   Chạy thuật toán Di truyền (Genetic Algorithm) để "xáo trộn" và tìm ra phương án tối ưu nhất.
    *   Liên tục đánh giá phương án bằng **Hàm mục tiêu (Fitness Function)**.

### 3.3. Giai đoạn 3: Tinh chỉnh & Công bố (Output)
1.  **Kiểm tra & Cảnh báo**:
    *   Hệ thống tự động phát hiện xung đột và hiển thị "vùng đỏ" nếu có vi phạm.
2.  **Điều chỉnh Thủ công (Drag & Drop)**:
    *   Admin có thể kéo thả tiết học để điều chỉnh nhỏ theo ý muốn.
    *   Hệ thống hỗ trợ gợi ý các ô trống hợp lệ khi kéo thả.
3.  **Xuất bản (Publish)**:
    *   Chốt TKB Chính thức -> Gửi thông báo đến toàn bộ giáo viên.
    *   Xuất file Excel báo cáo.

---

## 4. PHÂN TÍCH RÀNG BUỘC (CONSTRAINTS ANALYSIS)

Hệ thống phân chia ràng buộc thành 2 loại để xử lý mềm dẻo:

### 4.1. Ràng buộc Cứng (Hard Constraints)
Là các điều kiện bắt buộc phải thỏa mãn. Nếu vi phạm, TKB coi như **Hỏng (Invalid)**.
1.  **Xung đột Giáo viên**: Một giáo viên không thể dạy 2 lớp cùng lúc.
2.  **Xung đột Lớp học**: Một lớp không thể học 2 môn cùng lúc.
3.  **Xung đột Phòng**: Một phòng học không thể chứa 2 lớp cùng lúc.
4.  **Lịch Bận**: Không xếp vào các ô giáo viên đã đăng ký "Bận".

### 4.2. Ràng buộc Mềm (Soft Constraints)
Là các điều kiện về "chất lượng" và sự "thuận tiện". Vi phạm làm giảm điểm đánh giá nhưng TKB vẫn hợp lệ.
1.  **Phân bố đều**: Các môn nặng (Toán, Lý, Hóa) nên rải đều trong tuần, không dồn vào 1 ngày.
2.  **Hạn chế trống tiết (Gaps)**: Giáo viên không nên bị trống 1 tiết giữa 2 tiết dạy (gây lãng phí thời gian chờ).
3.  **Số tiết tối đa/ngày**: Không dạy quá 5 tiết/ngày để đảm bảo sức khỏe.

---

## 5. CHIẾN LƯỢC THUẬT TOÁN (ALGORITHMIC STRATEGY)

Để giải quyết bài toán, hệ thống sử dụng chiến lược **Hybrid Genetic Algorithm**:

1.  **Khởi tạo (Initialization)**:
    *   Sử dụng **Heuristic Greedy (Tham lam)** để tạo ra một quần thể TKB ban đầu có chất lượng tương đối (thỏa mãn các tiết cố định và phân phối cơ bản).

2.  **Lai ghép & Đột biến (Crossover & Mutation)**:
    *   Trao đổi các "gen" (cặp Lớp-Môn-Giáo viên) giữa các TKB cha mẹ.
    *   Đột biến: Ngẫu nhiên di chuyển một tiết học sang ô trống khác để thoát khỏi cực trị địa phương (local optima).

3.  **Đánh giá (Evaluation)**:
    *   Mỗi TKB được chấm điểm `Fitness = 1000 - Penalty`.
    *   Penalty Cứng = -100 điểm/lỗi.
    *   Penalty Mềm = -10 điểm/lỗi.
    Dựa trên công thức hiện tại của hệ thống:

    Fitness = 1000 - (Số lỗi cứng × 100)
    Lỗi cứng (Hard Constraint): Là những lỗi khiến TKB không thể thực hiện được (Ví dụ: 1 giáo viên dạy 2 lớp cùng lúc, 1 lớp học 2 môn cùng lúc).
    Vì vậy, mức điểm đánh giá TKB có thể dùng được là:

    BẮT BUỘC PHẢI LÀ 1000 ĐIỂM
    Giải thích:

    Nếu điểm < 1000 (Ví dụ 900, 800...):
    Có nghĩa là hệ thống vẫn còn ít nhất 1 lỗi vi phạm cứng.
    TKB này không thể áp dụng thực tế vì sẽ xảy ra xung đột vật lý (2 người tranh nhau 1 phòng, hoặc 1 giáo viên phải phân thân).
    Trạng thái lúc này là: INVALID (Không hợp lệ).
    Nếu điểm = 1000:
    Đồng nghĩa với 0 lỗi cứng.
    TKB đã khả thi về mặt logic và vật lý.
    Trạng thái lúc này là: VALID (Hợp lệ - Có thể ban hành).
    Lưu ý: Trong tương lai, nếu hệ thống áp dụng thêm trừ điểm cho Lỗi mềm (Soft Constraints - Ví dụ: giáo viên bị trống tiết, môn học rải không đều...), thì thang điểm "dùng được" có thể thấp hơn 1000 (ví dụ > 800), miễn là Lỗi cứng = 0. Nhưng với thuật toán hiện tại của bạn, chỉ khi đạt tuyệt đối 1000/1000 thì TKB mới được coi là thành công.

---

## 6. KẾT LUẬN
Hệ thống không chỉ giải quyết bài toán xếp lịch cơ bản mà còn hướng tới trải nghiệm người dùng thông qua việc xử lý tinh tế các Ràng buộc Mềm. Kiến trúc nghiệp vụ tách biệt rõ ràng giữa Input - Logic - Output giúp hệ thống dễ dàng bảo trì và mở rộng thêm các quy tắc mới trong tương lai.
