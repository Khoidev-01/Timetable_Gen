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
Hệ thống dựng lời giải bằng heuristic rồi cải thiện bằng **tìm kiếm cục bộ có khởi động lại** (local search with restarts).

1.  **Bước 1: Xếp các Tiết Cố định (Fixed Slots)**:
    *   Đọc từ bảng `fixed_period_rules` — cấu hình được từ màn hình `/admin/fixed-periods`, không hardcode.
    *   Mỗi quy tắc khai báo: môn · thứ · tiết · khối nào · buổi nào · ai dạy · có khoá không.
    *   Bỏ qua quy tắc nếu giáo viên đã bận, để heuristic xếp bình thường thay vì tạo tiết bị loại lúc lưu.

2.  **Bước 2: Heuristic tham lam**:
    *   Môn trái buổi (GDTC, GDQP) xếp thành khối liên tiếp ở buổi đối diện.
    *   Kiểm tra ngay khi đặt: ô đã chiếm · giáo viên trùng giờ · giáo viên đã báo bận · vượt định mức tuần · hết phòng chức năng.

3.  **Bước 3: Sửa chữa và dồn tiết**:
    *   `repairMissingPeriods` quét lại phần heuristic không xếp được, có thể di dời một tiết chắn đường.
    *   `consolidateBlocks` ghép các tiết lẻ cùng môn thành tiết đôi.
    *   `compactClassSchedules` kéo tiết về đầu buổi để lớp không bị trống tiết giữa buổi.
    *   `alignHomeroomToEndOfDay` đưa sinh hoạt về cuối buổi thực tế của lớp.

4.  **Bước 4: Tìm kiếm cục bộ**:
    *   Ba phép biến đổi: hoán vị hai tiết (kể cả **liên lớp**), di chuyển một tiết sang ô trống, và gom tiết của giáo viên về ít buổi hơn.
    *   Chấp nhận nước đi làm điểm tăng **hoặc bằng** để thoát cao nguyên.
    *   Dừng sớm khi không cải thiện được nữa.

5.  **Bước 5: Chọn phương án tốt nhất**:
    *   Chạy tối đa 12 lần, dừng sớm khi có phương án 0 lỗi cứng.
    *   So sánh **từ điển**: ít lỗi cứng trước, điểm mềm sau — một TKB dùng được luôn thắng một TKB đẹp hơn nhưng không dùng được.

6.  **Bước 6: Gán phòng**:
    *   Chạy sau khi lưới ngừng thay đổi. Môn thực hành vào Lab đúng loại, GDTC ra sân, tiết thường ở phòng lớp.

> **Lưu ý:** phiên bản trước mô tả đây là *Genetic Algorithm*. Không đúng — không có quần thể, lai ghép hay đột biến. Xem [REVIEW.md](REVIEW.md) mục 4.4.

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

Hệ thống dùng **Heuristic dựng lời giải + Tìm kiếm cục bộ có khởi động lại** (không phải Genetic Algorithm).

### 5.1. Hàm mục tiêu

```
Fitness = 1000 − (số lỗi cứng × 100) − tổng phạt mềm
```

**Ràng buộc cứng** — vi phạm là TKB không dùng được:

| Ràng buộc | Kiểm tra khi đặt tiết |
| :--- | :---: |
| Giáo viên không dạy 2 lớp cùng giờ | ✅ |
| Lớp không học 2 môn cùng giờ | ✅ |
| Phòng không chứa 2 lớp cùng giờ | ✅ |
| Không xếp vào ô giáo viên đã báo bận | ✅ |
| Đủ số tiết theo phân công | ✅ |
| Lớp không trống tiết giữa buổi | ✅ |
| Giáo viên không vượt định mức tuần | ✅ |
| Đủ phòng chức năng / sân thể dục | ✅ |

**Ràng buộc mềm** và trọng số: môn dồn cục (10) · môn nặng liên tiếp (20) · môn ưu tiên ở tiết cuối (15) · tiết đôi bị xé lẻ (10) · tiết trống giáo viên (5) · quá 4 tiết/buổi (10) · số buổi giáo viên phải đến trường (8) · dạy cả sáng lẫn chiều cùng ngày (12) · môn tư duy ngay sau Thể dục (10) · không có ngày nghỉ (15) · quá 4 tiết liên tiếp (8) · môn cách nhau quá 3 ngày (8) · quá 3 tiết buổi phụ (12).

### 5.2. Ngưỡng đánh giá

Hệ thống trả về **hai đánh giá tách rời nhau**, và không được trộn chúng lại:

**Dùng được hay chưa** — nhị phân, chỉ phụ thuộc lỗi cứng. Bằng 0 thì in ra treo lên tường
được, dù chất lượng có xếp hạng gì. Còn một lỗi cứng thôi thì vô dụng, dù điểm có đẹp.

**Chất lượng** — thang bậc *Tốt · Khá · Trung bình · Chưa tối ưu*, và nó **không có quyền
phủ quyết** tính dùng được.

Xếp hạng đo bằng **số điểm phạt còn tránh được trên mỗi tiết**, chuẩn hoá ba lần:

| Chuẩn hoá | Vì sao |
| :--- | :--- |
| Trừ phần bất khả kháng | Môn có số tiết lẻ thì luôn còn một tiết không có tiết cùng môn bên cạnh. Chấm bộ giải bằng thứ nó không thể sửa là chấm sai chỗ. |
| Chia cho số tiết | Điểm thô là tổng tuyệt đối nên nó lớn lên theo quy mô trường. |
| Đối chiếu mốc đo thật | Các mốc dưới đây không phải do nghĩ ra. |

Mốc lấy từ `scripts/calibrate-grades.ts`, chạy bốn mức công sức trên cùng bộ dữ liệu 30 lớp:

```
Chỉ dựng thô, không tối ưu   9,29 điểm phạt tránh được mỗi tiết   → Chưa tối ưu
Tối ưu rất ngắn              6,91                                 → Trung bình
Tối ưu ngắn                  6,40                                 → Khá
Tối ưu đầy đủ                5,35                                 → Tốt
```

Mốc đã hiệu chỉnh lại **ba lần**. Hai lần đầu sau khi sửa dữ liệu mẫu: đưa số tiết về đúng
định mức (Toán 4 xuống 3), rồi phân công lại để mỗi giáo viên chỉ phục vụ một ca.

Lần thứ ba vì một lý do khác hẳn — xem mục ngay dưới.

**Đổi dữ liệu mẫu là phải chạy lại `scripts/calibrate-grades.ts`** — một thang đo neo vào dữ
liệu không còn tồn tại thì không đo được gì.

Nên **"Tốt" nghĩa là ngang một lần tối ưu đầy đủ**, không phải hoàn hảo. Thang này đo công
sức tối ưu đã bỏ ra, và nó được hiệu chỉnh trên một bộ dữ liệu nên trường khác có thể lệch.

**Điểm thô vẫn còn**, nhưng chỉ dùng để so hai phương án của cùng một lần xếp. Đem điểm thô
của hai trường khác quy mô ra so là so hai thứ khác nhau: bộ dữ liệu 217 tiết cho khoảng
**−120 đến +150**, bộ 961 tiết cho **−5211**, mà chất lượng trên mỗi tiết chỉ chênh nhau
khoảng 50%.

### Vì sao điểm thô không bao giờ gần 1000

Câu hỏi đúng phải là: điểm thấp vì **bộ giải chưa giỏi**, hay vì **công thức đo một thứ không
ai đạt tới được**? Nhìn con số tổng thì không phân biệt được. Đã đo bằng ba cách:

**Một — từng tiêu chí một mình nó xuống được rất sâu** (`scripts/probe-single-criterion.ts`
tắt hết các tiêu chí khác, chỉ để lại một, rồi cho chạy hết sức):

| Tiêu chí | khi bật hết | riêng nó |
| :--- | ---: | ---: |
| Tiết trống giáo viên | 97 | **4** |
| Môn ưu tiên ở tiết cuối | 42 | **9** |
| Giáo viên dạy cả sáng lẫn chiều | 19 | **2** |
| Giáo viên phải đến trường thêm buổi | 159 | **80** |
| Môn 2 tiết bị xé lẻ | 140 | **89** |

Nên công thức **không** đo thứ bất khả thi. Mỗi khoản phạt đều có chỗ giảm thật.

**Hai — không có hai tiêu chí nào đếm trùng một sự việc**
(`scripts/probe-double-counting.ts` đổi chỗ một tiết rồi xem tiêu chí nào cùng đổi). Cặp
trùng nhiều nhất chỉ **47%**; nếu có cặp nào gần 100% thì đó là một sự việc bị tính tiền hai
lần.

**Ba — đổi trọng số không mua được gì.** Nâng trọng số "buổi đi lại" từ 8 lên 16 thắng rõ ở
một lần chạy (−4009 so với −4170), nhưng đo lại ba lần mỗi bên thì hoà: −4046 so với −4036.
Nâng trọng số "tiết trống" cũng vậy. Đã gỡ cả hai.

**Một mức sàn sai, tìm ra nhờ chính phép đo trên.** Bảng điểm từng khai hơn một nghìn điểm
là *bất khả kháng* ở tiêu chí tiết đôi, với lập luận: môn 3 tiết thì hai tiết ghép cặp và
tiết thứ ba bắt buộc lẻ loi. Phép đo bắt được mâu thuẫn — tối ưu riêng tiêu chí đó xuống
**89**, thấp hơn con số **134** được gọi là sàn. Một mức sàn mà thực tế đi dưới được thì
không phải sàn.

Chỗ sai: phép kiểm chỉ đòi mỗi tiết có **ít nhất một** tiết cùng môn bên cạnh, không đòi chia
thành từng cặp. Ba tiết liên nhau trong một ngày thì cả ba đều có hàng xóm, khoản phạt bằng
không. Con số sai ấy đã hiện trên màn hình dưới dạng *"104 không thể tránh — còn 0 chỗ sửa
được"*, tức là bảo người dùng đừng đi tìm thứ vẫn còn tìm được. Đã gỡ, và hiệu chỉnh lại mốc.

**Kết luận: điểm thấp vì 15 tiêu chí tranh nhau, không vì công thức sai.** Dồn tiết của một
giáo viên vào ít buổi thì chính những tiết ấy dồn cục với lớp; xếp môn tư duy vào tiết đầu
cho lớp này thì lớp khác phải nhận tiết cuối. Không có lời giải nào thoả mãn đồng thời, và
con số tổng là cái giá của việc phải chọn.

### 5.3. Định mức và quy định tham chiếu

- Định mức giáo viên THPT: **17 tiết/tuần** (Thông tư 05/2025/TT-BGDĐT)
- Tiết chào cờ và sinh hoạt là nhiệm vụ chủ nhiệm, **không tính vào định mức giảng dạy**
- Khoảng cách giữa hai tiết cùng môn không nên quá **3 ngày**

**Phân bổ tiết theo GDPT 2018 cho cấp THPT** (Thông tư 32/2018, sửa đổi bởi Thông tư
13/2022). Số tiết/tuần = số tiết/năm chia 35 tuần:

| Môn bắt buộc | Tiết/năm | Tiết/tuần |
| :--- | ---: | ---: |
| Ngữ văn · Toán · Ngoại ngữ 1 · Hoạt động trải nghiệm, hướng nghiệp | 105 | 3 |
| Giáo dục thể chất | 70 | 2 |
| Giáo dục quốc phòng và an ninh · Nội dung giáo dục của địa phương | 35 | 1 |
| Lịch sử *(phần bắt buộc theo TT 13/2022)* | 52 | 1,49 |

**Môn lựa chọn:** mỗi lớp chọn 4 môn, mỗi môn 70 tiết/năm = 2 tiết/tuần.

**Chuyên đề học tập:** 3 cụm × 35 tiết = 105 tiết/năm = 3 tiết/tuần, **gộp vào môn gốc** —
nên ba trong bốn môn lựa chọn đứng ở 3 tiết (2 cơ bản + 1 chuyên đề) và một môn ở 2 tiết.

Cộng chào cờ và sinh hoạt cuối tuần: **30,5 tiết/tuần**. Dữ liệu mẫu ở 31 tiết HK1 và 30 tiết
HK2 — nửa tiết lệch là do Lịch sử 1,49 không chia được thành số nguyên mỗi tuần, nên chia 2
tiết ở HK1 và 1 tiết ở HK2 (≈ 53 tiết/năm).

## 6. KẾT LUẬN
Hệ thống không chỉ giải quyết bài toán xếp lịch cơ bản mà còn hướng tới trải nghiệm người dùng thông qua việc xử lý tinh tế các Ràng buộc Mềm. Kiến trúc nghiệp vụ tách biệt rõ ràng giữa Input - Logic - Output giúp hệ thống dễ dàng bảo trì và mở rộng thêm các quy tắc mới trong tương lai.
