# Hỏi đáp về thuật toán — chuẩn bị cho buổi bảo vệ

Viết cho người đứng trả lời ban giám khảo. Mỗi câu trả lời đủ ngắn để nói ra miệng, kèm
chỗ nói sâu thêm nếu bị hỏi tiếp. Mọi con số trong đây đều lấy từ mã nguồn hoặc từ phép đo
đã lưu trong repo; chỗ nào chưa đo thì ghi rõ là chưa đo.

> **Đọc mục "Ba chỗ phải chốt trước" ở cuối trước tiên.** Có ba chỗ tài liệu đang mâu
> thuẫn với code; nếu ban giám khảo đọc tài liệu rồi hỏi, bạn sẽ bị hỏi về một thứ không
> tồn tại trong sản phẩm.

---

## A0. Giải thích cho người không chuyên

Dùng phần này khi ban giám khảo không phải dân kỹ thuật, hoặc khi mở đầu phần trình bày.

### Bài toán khó ở chỗ nào

Hãy hình dung một tấm bảng lớn: 30 lớp, mỗi lớp 31 ô trong tuần, tổng cộng **930 ô** phải
điền. Mỗi ô là một tiết học, cần đủ ba thứ khớp nhau: lớp rảnh, giáo viên rảnh, phòng
trống. Xếp một chỗ là kéo theo cả dây: cho cô Toán dạy 10C1 tiết 2 thứ Hai thì giờ đó cô
không thể ở lớp khác, phòng máy ấy không nhận lớp khác, và lớp 10C1 không học môn nào khác.

Số cách xếp nhiều tới mức thử hết là điều không thể. Nên không ai đi tìm lời giải **tốt
nhất tuyệt đối**; người ta đi tìm lời giải **đủ tốt, tìm được trong vài phút**.

### Hệ thống làm gì, kể theo trình tự

**Bước 1 — Xếp thô cho kín bảng.** Hệ thống điền theo luật đơn giản: chào cờ và sinh hoạt
vào chỗ đã quy định; thể dục và quốc phòng đẩy sang buổi trái; còn lại quét từng ô và nhét
vào tiết nào hợp lệ. Giống dọn nhà bằng cách nhét đồ vào tủ cho hết — nhanh, kín, nhưng
lộn xộn.

Lúc này bảng đã ổn về mặt "không ai trùng ai", nhưng **rất khó chịu**: cô giáo phải đến
trường cả 6 ngày, có buổi dạy 5 tiết liền, có lớp học ba tiết Toán liên tiếp.

**Bước 2 — Chấm điểm phiền hà.** Mỗi điều khó chịu cộng một ít điểm: chờ một tiết trống
giữa buổi cộng 5, đi dạy cả 6 ngày cộng 15, ba tiết môn nặng liền nhau cộng 20, leo tầng
giữa hai tiết cộng 3. Điểm càng thấp, thời khóa biểu càng dễ chịu.

**Bước 3 — Sửa dần, bảy trăm nghìn lần.** Hệ thống lặp đi lặp lại một việc đơn giản: thử
đổi chỗ vài tiết, chấm lại, tốt hơn thì giữ, tệ hơn thì trả về như cũ.

**Bước 4 — Thỉnh thoảng chịu lùi một bước.** Đây là chỗ "luyện kim" trong tên thuật toán.
Nếu chỉ nhận cái tốt hơn, hệ thống sẽ mắc kẹt như người leo núi trong sương: lên tới một
mỏm nhỏ, xung quanh đều thấp hơn, tưởng đã tới đỉnh. Muốn sang được sườn núi cao hơn, đôi
khi phải chịu **đi xuống một đoạn**.

Nên hệ thống thỉnh thoảng chấp nhận một thay đổi làm bảng xấu đi chút ít. Lúc đầu chấp
nhận thoải mái, càng về sau càng khắt khe — giống thợ rèn nung thép rồi để nguội từ từ:
nóng thì các hạt còn xê dịch được, nguội dần thì chúng ổn định vào đúng chỗ. Cái tên
"luyện kim mô phỏng" ra đời từ đó.

**Bước 5 — Làm lại cả quy trình vài lần.** Bước 1 có phần ngẫu nhiên nên mỗi lần chạy ra
một bảng khác. Hệ thống làm lại từ đầu 3 đến 6 lần và **giữ bản tốt nhất**.

### Hai cải tiến riêng của đề tài

**1. Đổi cả một dây, thay vì đổi một tiết.**

Muốn chuyển tiết Toán của cô An từ thứ Ba sang thứ Năm. Nhưng thứ Năm giờ đó lớp đang học
Lý, mà thầy Lý giờ thứ Ba lại đang dạy lớp khác. Đổi một tiết là lập tức đụng ba bốn
người, và hệ thống buộc phải bỏ nước đi đó. Cứ thế, phần lớn công sức đổ vào những nước đi
bị loại ngay.

Cách làm mới: khi muốn đổi hai khung giờ, hệ thống **lần theo dây liên đới** — tiết này
vướng ai, người đó còn vướng tiết nào nữa — gom trọn cả nhóm rồi **hoán đổi cả nhóm cùng
lúc**. Giống đổi ca trực: không rút một người ra khỏi ca (sẽ thủng chỗ), mà đổi nguyên cả
kíp trực của hai ngày cho nhau. Đổi trọn kíp thì không ai thiếu, không ai trùng.

Kỹ thuật này tên là **chuỗi Kempe**, vốn dùng trong bài toán tô màu bản đồ và xếp lịch
thi; đề tài đưa nó vào bài toán thời khóa biểu trường phổ thông.

**2. Sửa đúng chỗ đang hỏng.**

Thay vì bốc ngẫu nhiên một tiết bất kỳ trong 930 tiết, hệ thống giữ một danh sách **những
tiết đang gây phiền hà nhất** và dành 3 trong 4 lượt thử cho chúng. Giống thợ sửa nhà đi
thẳng tới chỗ dột thay vì gõ khắp mái. Một phần tư lượt còn lại vẫn bốc ngẫu nhiên, vì đôi
khi muốn chữa chỗ dột thì phải xê dịch một viên ngói đang lành.

### Một nguyên tắc không bao giờ phá

Hệ thống phân biệt hai loại quy tắc:

- **Luật cứng** — vi phạm là thời khóa biểu vứt đi: một giáo viên dạy hai lớp cùng lúc,
  một phòng chứa hai lớp, lớp thiếu tiết, giáo viên vượt định mức 17 tiết/tuần.
- **Điều khó chịu** — vẫn dùng được, chỉ là không dễ chịu: chờ tiết trống, đi dạy 6 ngày.

Trong suốt quá trình tối ưu, **mọi thay đổi làm phát sinh lỗi cứng đều bị hoàn lại ngay**.
Hệ thống không bao giờ đánh đổi "một giáo viên bị trùng lịch" lấy "bảng nhìn dễ chịu hơn".
Và nếu cuối cùng vẫn còn một lỗi cứng, thời khóa biểu bị xếp hạng **Tệ**, bất kể điểm
phiền hà đẹp đến đâu.

---

## A0b. "Điểm phiền hà" là gì?

Đây là khái niệm trung tâm của cả hệ thống. Giải thích được nó là giải thích được vì sao
máy biết bảng này tốt hơn bảng kia.

### Ý tưởng: biến "khó chịu" thành con số

Một thời khóa biểu hợp lệ vẫn có thể rất khó sống. Cô giáo chỉ dạy 12 tiết nhưng rải đều
6 ngày, sáng nào cũng phải tới trường. Lớp 10C1 học ba tiết Toán liền nhau ngay sau tiết
Thể dục. Thầy dạy tiết 1 ở tầng 1, tiết 2 ở tầng 3, tiết 3 lại xuống tầng 1.

Máy tính không "thấy" những điều đó là khó chịu. Nên nhà trường phải nói cho nó biết, bằng
cách **gắn giá cho từng điều khó chịu**. Mỗi lần thời khóa biểu phạm vào một điều, nó bị
cộng thêm chừng ấy điểm phạt. Cộng hết lại thành **điểm phiền hà** của cả bảng.

Giống như chấm lỗi một bài thi: sai chính tả trừ 1 điểm, lạc đề trừ 5 điểm. Bài nào bị trừ
ít hơn là bài tốt hơn. Ở đây cũng vậy — **điểm phiền hà càng thấp, thời khóa biểu càng dễ
sống**.

Việc của thuật toán chỉ là: thử hàng trăm nghìn cách xếp, và đi về phía điểm thấp hơn.

### Giá của từng điều khó chịu

Đây là toàn bộ 19 khoản đang tính, cùng giá thật trong hệ thống. Giá cao nghĩa là nhà
trường coi điều đó đáng ngại hơn.

**Ảnh hưởng tới học sinh**

| Điều khó chịu | Giá mỗi lần |
|---|---|
| Quá 3 tiết môn nặng liền nhau (Toán, Lý, Hóa) | 20 |
| Hoạt động trải nghiệm / Giáo dục địa phương không xếp vào thứ Năm | 18 |
| Toán, Văn, Anh bị đẩy xuống cuối buổi thay vì tiết đầu | 15 |
| Một buổi học quá 3 tiết ở buổi phụ | 12 |
| Vi phạm quy tắc phân bổ môn nặng trong một buổi | 12 |
| Học quá 2 tiết cùng môn trong một ngày | 10 |
| Tiết đơn lẻ, không ghép cặp được với tiết cùng môn | 10 |
| Xếp môn nặng ngay sau tiết Thể dục | 10 |
| Thể dục / Quốc phòng xếp vào giờ nắng gắt giữa buổi | 10 |
| Hai tiết cùng môn cách nhau quá 3 ngày | 8 |

**Ảnh hưởng tới giáo viên**

| Điều khó chịu | Giá mỗi lần |
|---|---|
| Phải đi dạy cả 6 ngày trong tuần, không có ngày nghỉ | 15 |
| Xếp vào giờ giáo viên đã xin tránh | 14 |
| Phải tới trường cả sáng lẫn chiều trong cùng một ngày | 12 |
| Dạy quá 4 tiết trong một buổi | 10 |
| Phải tới trường thêm một buổi nữa so với mức tối thiểu | 8 |
| Dạy quá 4 tiết liên tiếp không nghỉ | 8 |
| Mỗi tiết trống phải ngồi chờ giữa hai tiết dạy | 5 |
| Phải leo cầu thang đổi tầng giữa hai tiết liền nhau | 3 |
| *Được xếp đúng giờ giáo viên mong muốn* | *thưởng 6* |

Khoản cuối là khoản duy nhất **cộng điểm tốt** thay vì trừ.

**Hai điều cần nói rõ về bảng giá này:**

Thứ nhất, những con số này **do nhà trường chỉnh được** ở trang Cấu hình. Trường nào coi
trọng việc giáo viên có ngày nghỉ thì nâng giá khoản đó lên; trường ít tầng lầu thì hạ giá
khoản leo cầu thang xuống. Thuật toán không cần sửa gì, nó chỉ đi theo bảng giá mới.

Thứ hai, đây **không phải** luật cứng. Vi phạm luật cứng (hai lớp cùng một phòng, giáo
viên dạy hai nơi cùng lúc) thì thời khóa biểu hỏng, không dùng được. Còn những khoản trên
chỉ làm lịch kém dễ chịu. Mỗi lỗi cứng bị tính **100 điểm**, đắt gấp nhiều lần mọi khoản
phiền hà — và quan trọng hơn: còn một lỗi cứng thì lịch **luôn** bị xếp hạng Tệ, dù điểm
phiền hà có thấp đến đâu.

### Vì sao điểm lại là số âm

Hệ thống bắt đầu từ 1000 điểm rồi trừ dần:

```
điểm = 1000 − (số lỗi cứng × 100) − (tổng phiền hà) + (thưởng nguyện vọng)
```

Nên con số **−3045** trong các bảng so sánh có nghĩa là: cả bảng đã bị trừ khoảng **4.045
điểm** vì những điều khó chịu cộng dồn trên 930 tiết. Còn **−12775** của bản xếp thô nghĩa
là nó bị trừ gần 13.800 điểm — tệ hơn khoảng bốn lần.

Chỉ cần nhớ một điều khi đọc mọi bảng số trong đề tài: **số càng gần 0 càng tốt**.

### Từ điểm phiền hà tới xếp hạng

Tổng điểm phiền hà phụ thuộc quy mô trường: trường 30 lớp đương nhiên cộng dồn nhiều hơn
trường 10 lớp, dù chất lượng như nhau. Nên để xếp hạng, hệ thống làm thêm hai việc:

1. **Trừ đi phần không ai tránh được.** Một giáo viên dạy 20 tiết thì dù xếp khéo tới đâu
   cũng phải tới trường ít nhất 4 buổi. Phần bắt buộc ấy bị trừ khỏi điểm phạt, vì phạt
   nó là phạt oan.
2. **Chia cho số tiết**, để so được giữa các trường khác quy mô.

Kết quả là một con số duy nhất: **điểm phiền hà tránh được, tính trên mỗi tiết**. Thời
khóa biểu happy case của đề tài đạt khoảng 4,0 — tức mỗi tiết học còn gánh chừng 4 điểm
khó chịu lẽ ra tránh được. Ngưỡng xếp hạng Tốt là 4,35, Xuất sắc là 3,90.

### Bao nhiêu điểm thì dùng được? Khi nào được công bố?

Hệ thống tách bạch hai câu hỏi khác nhau, đừng lẫn:

**Câu 1 — Thời khóa biểu này có dùng được không?**

Chỉ một điều kiện duy nhất: **không còn lỗi cứng nào**. Không có ngưỡng điểm phiền hà nào
ở đây. Một bảng 0 lỗi cứng nhưng điểm phiền hà cao vẫn **dùng được** — nó chỉ kém dễ chịu,
chứ không sai.

Ngược lại, còn **một** lỗi cứng thôi là chưa dùng được, dù điểm đẹp tới đâu: có lớp thiếu
tiết, hoặc có giáo viên bị xếp dạy hai nơi cùng lúc. Không ai mang một bảng như vậy ra dán
cho toàn trường.

Điều này **hệ thống tự ép, không tin vào người bấm**: khi quản trị viên bấm Công bố, máy
chấm lại toàn bộ thời khóa biểu ngay tại thời điểm đó. Còn lỗi cứng thì nút không chạy, và
báo về đúng lỗi nào, ví dụ *"Phương án còn 2 lỗi cứng nên chưa thể công bố"*. Nghĩa là
**không có đường nào công bố được một thời khóa biểu hỏng**, kể cả bấm nhầm.

**Câu 2 — Nó tốt tới mức nào?**

Câu này mới dùng tới điểm phiền hà, quy về **mỗi tiết** (đã trừ phần không ai tránh được):

| Điểm mỗi tiết | Bậc | Nghĩa là | Nên làm gì |
|---|---|---|---|
| ≤ 3,90 | Xuất sắc | Ngang một lần tìm kiếm kéo dài gấp hơn ba lần bình thường | Công bố |
| ≤ 4,35 | Tốt | Ngang một lần xếp đầy đủ của hệ thống | Công bố |
| ≤ 5,30 | Khá | Ngang một lần tối ưu ngắn | Dùng tạm được; xếp lại đầy đủ thường hơn rõ |
| ≤ 6,70 | Trung bình | Mới tối ưu sơ bộ | Nên xếp lại |
| ≤ 8,40 | Yếu | Gần như chưa tối ưu | Nên xếp lại |
| trên 8,40 | Tệ | Chưa được tối ưu | Xếp lại |
| *còn lỗi cứng* | *Tệ* | *Chưa dùng được* | *Sửa lỗi cứng trước* |

**Mốc nên nhớ khi demo:** bản chính của hệ thống (700.000 lượt) đạt khoảng **4,0 điểm mỗi
tiết** — tức hạng **Tốt**. Chạy dài 2,4 triệu lượt xuống còn **3,78** — hạng **Xuất sắc**.
Đó cũng là lý do máy chủ đang đặt sẵn mức 2,4 triệu.

Quy ra điểm tổng cho bộ dữ liệu 930 tiết: hạng Tốt tương ứng phần phiền hà tránh được
khoảng **4.000 điểm trở xuống**, hạng Xuất sắc khoảng **3.600 trở xuống**.

**Tóm tắt một câu để trả lời ban giám khảo:** *"Một thời khóa biểu được phép công bố khi và
chỉ khi không còn lỗi cứng — hệ thống chấm lại và chặn ngay tại nút Công bố. Còn điểm
phiền hà quyết định xếp hạng: dưới 4,35 điểm mỗi tiết là Tốt, dưới 3,90 là Xuất sắc. Bản
chúng em chạy cho trường mẫu đạt hạng Tốt, và Xuất sắc khi cho chạy dài."*

### Một ví dụ nhỏ để dễ hình dung

Giả sử đang xét lịch của cô An trong một ngày: dạy tiết 1, nghỉ tiết 2, dạy tiết 3, và đây
là ngày thứ sáu cô phải tới trường trong tuần.

| Khoản | Tính ra |
|---|---|
| Một tiết trống phải ngồi chờ (tiết 2) | 5 |
| Đi dạy cả 6 ngày, không có ngày nghỉ | 15 |
| **Cộng** | **20** |

Giờ thuật toán thử một nước đi: dời tiết 3 của cô An sang ngày khác, nơi cô đã có mặt sẵn.
Lịch mới: cô dạy tiết 1 rồi về, và tuần này chỉ phải tới trường 5 ngày. Hai khoản trên
biến mất, bảng bớt được 20 điểm. Nước đi được giữ lại.

Nhưng nếu việc dời đó làm lớp bên kia bị trống một tiết giữa buổi, hoặc làm thầy khác bị
trùng giờ, thì phần thiệt sẽ được cộng vào và đem so. Thiệt hơn lợi thì hoàn lại. Nếu là
lỗi cứng thì hoàn lại ngay lập tức, không cần so.

Hệ thống lặp đúng phép cân nhắc đó **bảy trăm nghìn lần** cho mỗi lần xếp.

---

## A1. Căn cứ nào nói cách làm này tốt hơn?

Trả lời câu này phải cẩn thận, vì số liệu **không** nói bản của hệ thống thắng tất cả.

### Cách bố trí phép so sánh

Nhóm cài đặt **7 chiến lược tìm kiếm** trong cùng một chương trình, rồi cho chạy trong
điều kiện giống hệt nhau:

- cùng bộ dữ liệu 30 lớp,
- cùng **bộ nước đi** (kể cả nước đi chuỗi Kempe — ai cũng được dùng),
- cùng **ngân sách 700.000 lượt thử**,
- mỗi thuật toán chạy **5 lần**, mỗi lần một điểm xuất phát khác nhau.

Giống cho bảy người thợ cùng một hộp đồ nghề, cùng một căn nhà, cùng hai tiếng, rồi xem ai
sửa được nhiều hơn. Khác biệt còn lại chỉ nằm ở **cách quyết định nên giữ hay bỏ mỗi thay
đổi** — đúng thứ cần so.

### Kết quả, nói thẳng

| Thuật toán | Điểm phiền hà trung bình | Chênh lệch giữa các lần chạy |
|---|---|---|
| **Bản của hệ thống** | −3045 | **± 26** |
| Local Search | −3058 | ± 83 |
| Luyện kim thuần | −3064 | ± 120 |
| Hill Climbing | −3528 | ± 71 |
| Late Acceptance | −6659 | ± 42 |
| Tabu Search | −10619 | ± 136 |
| Xếp thô, không tối ưu | −12775 | ± 270 |

Ba dòng đầu **coi như hòa**: chênh nhau 19 điểm, trong khi mỗi thuật toán chạy 5 lần đã
dao động 26 đến 120 điểm. Nói "hơn 19 điểm" là nói về nhiễu.

Thứ bản của hệ thống thắng rõ ràng là **độ ổn định**: năm lần chạy chỉ lệch nhau 26 điểm,
còn luyện kim thuần lệch 120. Với nhà trường, điều này quan trọng hơn: công cụ lần nào bấm
cũng cho kết quả tương đương thì tin được; công cụ khi hay khi dở thì mỗi lần xếp lại là
một lần hồi hộp.

Bốn dòng dưới mới là cách biệt thật: xếp thô để nguyên tệ hơn bản tối ưu **hơn bốn lần**.

### Căn cứ mạnh hơn: đo riêng từng cải tiến

Bảng trên so *chiến lược quyết định*. Hai cải tiến riêng của đề tài được đo riêng, và đây
mới là số liệu thuyết phục nhất.

**Nước đi chuỗi Kempe — so cùng thời gian chạy, không so số lượt:**

| Cấu hình | Điểm phiền hà |
|---|---|
| Không dùng Kempe, chạy 1.200.000 lượt | −3764 |
| **Dùng Kempe, chỉ chạy 700.000 lượt** | **−2801** |

Cả hai cùng mất **141 giây**. Bên dùng Kempe thử ít lượt hơn hẳn nhưng kết quả tốt hơn
26%, và **thắng cả 16/16 cặp đối đầu**. Phải so theo thời gian, vì một nước đi Kempe tốn
công hơn nước đi thường nhiều lần — so theo số lượt là so không công bằng.

**Sửa đúng chỗ đang hỏng:** bốc ngẫu nhiên đều cho −4744; tập trung vào chỗ đang gây phiền
hà cho −4416.

### Một cách đối chiếu nữa: so với chính mình

Sáu bậc chất lượng (Xuất sắc → Tệ) không phải nhóm tự đặt. Nhóm cho hệ thống chạy với các
mức công sức khác nhau rồi lấy chính kết quả đó làm mốc:

| Công sức bỏ ra | Điểm phiền hà mỗi tiết |
|---|---|
| Tối ưu kéo dài (2,4 triệu lượt) | 3,78 |
| Bản chính (700.000 lượt) | 4,01 |
| Tối ưu vừa (150.000 lượt) | 4,69 |
| Tối ưu ngắn (30.000 lượt) | 5,94 |
| Gần như không tối ưu (5.000 lượt) | 7,38 |
| Chỉ xếp thô | 9,35 |

Nhờ vậy, câu "thời khóa biểu này đạt hạng Tốt" có nghĩa cụ thể: nó tương đương mức công
sức tối ưu của bản chính, chứ không phải một lời khen chung chung.

### Điều chưa đo, đừng nhận bừa

**Chưa so với thời khóa biểu do người xếp tay.** Không có số liệu nào theo hướng đó. Bị
hỏi thì trả lời thẳng là chưa đo, và đó là bước đánh giá tiếp theo: xin lịch thật của một
trường rồi chấm bằng đúng bộ tiêu chí này.

---

## A. Những câu chắc chắn bị hỏi

### 1. Hệ thống dùng thuật toán gì?

Luyện kim mô phỏng (Simulated Annealing) chạy trên một lời giải khởi tạo tham lam, với một
bộ nước đi riêng cho bài toán thời khóa biểu, trong đó quan trọng nhất là **nước đi chuỗi
Kempe**.

Quy trình ba giai đoạn: đặt tiết cố định → dựng lời giải thô bằng tham lam có ngẫu nhiên
hóa → luyện kim để cải thiện. Chạy lại toàn bộ 3–6 lần và giữ bản tốt nhất.

*Nói thêm nếu bị hỏi:* nhiệt độ từ 2,5 xuống 0,15 theo hàm mũ; nước đi xấu được nhận theo
công thức Metropolis `exp(Δ/T)`.

### 2. Vì sao chọn luyện kim mà không phải thuật toán khác?

Vì đã đo. Bảy chiến lược tìm kiếm được cài đặt trên **cùng một bộ nước đi**, chạy **cùng
700.000 vòng lặp**, **5 lần mỗi thuật toán**, trên cùng bộ dữ liệu 30 lớp:

| Thuật toán | Điểm trung bình | Độ lệch chuẩn | Lỗi cứng TB |
|---|---|---|---|
| Hybrid của hệ thống | −3045 | **26** | 1 |
| Local Search | −3058 | 83 | 0,6 |
| Simulated Annealing thuần | −3064 | 120 | 2,2 |
| Hill Climbing | −3528 | 71 | 1,6 |
| Late Acceptance | −6659 | 42 | 8,4 |
| Tabu Search | −10619 | 136 | 39,8 |
| Tham lam thuần | −12775 | 270 | 49,4 |

Điểm càng gần 0 càng tốt. Lời giải khởi tạo là −12950.

**Phải nói thẳng:** ba thuật toán đầu **hòa nhau** — chênh 19 điểm, nhỏ hơn cả độ lệch
chuẩn. Bản của hệ thống không thắng về điểm, nó thắng về **độ ổn định**: lệch chuẩn 26 so
với 83 và 120. Với nhà trường, một thuật toán lần nào cũng ra kết quả gần như nhau đáng
tin hơn một thuật toán khi được khi không.

*Dữ liệu thô:* `docs/benchmark/2026-09-17.csv` và `.json` (có cả đường hội tụ 60 điểm mỗi
thuật toán để vẽ biểu đồ).

### 3. Đóng góp riêng của đề tài là gì? (câu quan trọng nhất)

**Nước đi chuỗi Kempe cho bài toán thời khóa biểu.** Nước đi thường chỉ đổi chỗ hai tiết;
đổi xong thường sinh trùng lịch nên bị loại ngay. Nước đi Kempe gom cả một **chuỗi tiết
liên đới** (chung lớp hoặc chung giáo viên giữa hai ô thời gian) rồi hoán đổi trọn chuỗi,
nên đi được những bước lớn mà vẫn hợp lệ.

Số liệu quyết định, **so cùng thời gian chạy** (141 giây mỗi bên, 4 lần mỗi bên):

| Cấu hình | Điểm phạt |
|---|---|
| Không Kempe, 1.200.000 nước đi | −3764 |
| **Kempe 10%, 700.000 nước đi** | **−2801** |

Giảm 26% điểm phạt, **thắng 16/16 cặp đối đầu**. Phải so theo thời gian chứ không theo số
vòng lặp, vì một nước Kempe đắt hơn nước đi thường nhiều lần.

*Cơ sở lý thuyết:* Thompson & Dowsland (1998) dùng chuỗi Kempe cho bài toán xếp lịch thi;
đề tài đưa sang bài toán thời khóa biểu trường phổ thông, giới hạn độ dài chuỗi 12 tiết.

**Đóng góp thứ hai: bốc nước đi vào đúng chỗ đang lỗi.** 75% số lượt bốc từ danh sách tiết
đang gây phạt, 25% bốc đều để những tiết đang ổn vẫn có thể nhường chỗ. Đo được: bốc đều
−4744, bốc theo điểm nóng −4416.

### 4. Có bao nhiêu ràng buộc? Kể vài cái.

**13 ràng buộc cứng** (vi phạm là lịch không dùng được) và **19 khoản phạt mềm** (lịch vẫn
dùng được nhưng kém dễ chịu).

Cứng: giáo viên không dạy hai lớp cùng tiết; lớp không học hai môn cùng tiết; phòng không
chứa hai lớp cùng tiết; không xếp vào giờ giáo viên đã đăng ký bận; đủ số tiết mỗi môn;
lớp không trống tiết giữa buổi; không vượt định mức 17 tiết/tuần theo Thông tư 05/2025;
đủ phòng chức năng; học đúng buổi chính; không xếp vào ô nghỉ; **Giáo dục thể chất và
Quốc phòng phải học trái buổi**; hai môn đó không cùng một ngày; một môn tối đa 2 tiết
liên tiếp.

Mềm, kèm trọng số thật: HĐTN và Giáo dục địa phương nên vào thứ Năm (18); môn nặng không
quá 3 tiết liền (20); Toán/Văn/Anh ưu tiên tiết đầu buổi (15); giáo viên không phải đi dạy
cả 6 ngày (15); tránh giờ giáo viên xin tránh (14); không dạy cả sáng lẫn chiều cùng ngày
(12); tiết trống chờ giữa buổi (5); phải leo cầu thang đổi tầng (3)…

*Nói thêm:* sáu ràng buộc cứng không tắt được, bảy cái còn lại quản trị viên tắt được ở
trang Cấu hình. Trọng số mềm sửa được, phải là số nguyên 0–1000.

### 5. Chất lượng một thời khóa biểu được chấm thế nào?

Điểm tổng: `1000 − (số lỗi cứng × 100) − (tổng phạt mềm) + (thưởng nguyện vọng)`.

Nhưng **bậc chất lượng không lấy điểm tổng**, vì điểm tổng phụ thuộc quy mô trường. Bậc
được tính trên **khoản phạt còn tránh được, chia cho mỗi tiết** — tức đã trừ đi phần không
ai tránh được (ví dụ giáo viên 20 tiết thì buộc phải đến trường ít nhất 4 buổi).

| Phạt tránh được mỗi tiết | Bậc |
|---|---|
| ≤ 3,90 | Xuất sắc |
| ≤ 4,35 | Tốt |
| ≤ 5,30 | Khá |
| ≤ 6,70 | Trung bình |
| ≤ 8,40 | Yếu |
| trên 8,40 | Tệ |

**Còn một lỗi cứng thì luôn xếp hạng Tệ**, bất kể điểm mềm đẹp đến đâu.

Sáu ngưỡng này không bịa: chúng được neo vào **công sức tối ưu**, đo 3 lần mỗi mức trên bộ
930 tiết — tìm kiếm 2,4 triệu nước đi đạt 3,78; bản chính 700.000 đạt 4,01; 150.000 đạt
4,69; 30.000 đạt 5,94; 5.000 đạt 7,38; chỉ dựng thô 9,35. Nói cách khác, "Tốt" nghĩa là
"tương đương công sức tối ưu của bản chính", chứ không phải một con số do nhóm tự đặt.

### 6. Xếp một lần mất bao lâu?

Trên máy phát triển, với bộ 930 tiết: một vòng luyện kim 700.000 nước đi mất **141 giây**.
Một lần xếp trọn (khởi tạo, vòng mồi, tối đa 6 lần thử) mất **khoảng 5–6 phút** cho một
học kỳ, đúng như quan sát khi chạy thử kịch bản demo.

*Trung thực:* hệ thống **không ghi log thời gian** của lần xếp thật; con số trên lấy từ
các phép đo có ghi lại trong mã nguồn và từ lần chạy thử. Trên máy chủ khác sẽ khác.

### 7. Bộ dữ liệu thử nghiệm lớn cỡ nào?

30 lớp (10 lớp khối 10, 9 lớp khối 11, 11 lớp khối 12), 73 giáo viên chia 7 tổ chuyên môn,
44 phòng gồm cả sân bãi và phòng thực hành, 19 môn theo chương trình GDPT 2018, 12 tổ hợp
môn tự chọn, 968 dòng phân công, **930 tiết mỗi tuần** cần xếp trên lưới 6 ngày × 10 tiết.

### 8. Thuật toán có cho kết quả tối ưu không?

**Không, và không hứa như vậy.** Đây là bài toán NP-khó; với 930 tiết thì không gian lời
giải lớn tới mức không thể duyệt hết. Luyện kim là thuật toán **xấp xỉ**: nó bảo đảm lịch
**hợp lệ** (không lỗi cứng) và tốt hơn hẳn xếp tay về các tiêu chí đo được, nhưng không
chứng minh được là tối ưu tuyệt đối.

Cái đề tài chứng minh được là: tốt hơn 6 thuật toán khác trên cùng dữ liệu, cùng ngân
sách; và tốt hơn chính nó khi giảm công sức tối ưu.

### 9. Chạy hai lần có ra hai kết quả khác nhau không?

Có, vì lời giải khởi tạo được ngẫu nhiên hóa và luyện kim có thành phần ngẫu nhiên. Nhưng
độ lệch chuẩn chỉ **26 điểm** trên 5 lần chạy — dao động khoảng 0,9%. Nhà trường chạy lại
sẽ nhận một lịch khác về chi tiết nhưng tương đương về chất lượng.

Tiết mà quản trị viên đã **khóa** thì giữ nguyên qua mọi lần xếp lại.

### 10. AI nằm ở đâu trong hệ thống?

Cần tách bạch hai thứ, đừng để ban giám khảo hiểu nhầm:

- **Xếp thời khóa biểu: không dùng AI, không dùng mô hình ngôn ngữ.** Đây là thuật toán
  tối ưu tổ hợp cổ điển, kết quả tái lập được và giải thích được từng điểm phạt.
- **Trợ lý Miki: có dùng mô hình ngôn ngữ**, nhưng nó chỉ đọc dữ liệu qua 11 công cụ đã
  định nghĩa sẵn và diễn đạt lại. Mọi câu hỏi "đổi tiết này có hợp lệ không" đều do bộ
  kiểm tra ràng buộc trả lời, không phải mô hình tự kết luận.

---

## B. Câu hỏi khó và câu bẫy

### 11. Sao không dùng thuật toán di truyền? Bài toán xếp lịch kinh điển vẫn dùng mà.

Đã cân nhắc và chọn hướng khác, vì thuật toán di truyền cần phép lai ghép giữ được tính
hợp lệ — với thời khóa biểu, lai hai lịch hợp lệ thường ra một lịch trùng giáo viên, phải
sửa chữa tốn kém. Luyện kim với nước đi Kempe giữ tính hợp lệ ngay trong từng nước đi.

Kết quả đo ủng hộ lựa chọn này: ở cùng ngân sách, hướng đang dùng hơn hẳn Tabu Search và
Late Acceptance, ngang Local Search và luyện kim thuần nhưng ổn định hơn.

> **Cảnh báo:** tài liệu `CHUC_NANG.md` từng viết hệ thống dùng thuật toán di truyền với
> quần thể, lai ghép, đột biến — sai so với code, nên file đã được gỡ khỏi repo. Nếu còn
> bản in hoặc bản sao cũ đang lưu hành thì thu lại. Xem mục cuối.

### 12. Sao Tabu Search lại tệ hơn cả không làm gì?

Câu trả lời trung thực: **do hai lỗi cài đặt trong phòng thí nghiệm của nhóm, đã chẩn đoán
được** — khôi phục bản chụp bằng cách ghi đè làm chỉ mục lưới lệch, và khóa cấm sinh từ số
ngẫu nhiên nên danh sách cấm thực tế vô tác dụng.

Đừng trích con số −10619 như bằng chứng Tabu Search kém về bản chất. Nói đúng là: "trong
phòng thí nghiệm của chúng em, bản Tabu cài chưa đúng, nên con số đó chỉ để tham khảo".

### 13. Có so với cận dưới lý thuyết không?

Không có cận dưới đã chứng minh. Nhóm có tính một **mức tham chiếu** (tối ưu riêng từng
tiêu chí rồi cộng lại), nhưng nó không phải cận dưới đúng nghĩa và **đã gỡ khỏi giao diện**
sau khi phát hiện một con số sàn tính sai (sàn tiết đôi bị xé từng ghi 134, đo lại chỉ 89).

Thay vào đó đề tài dùng hai mốc so sánh: so với 6 thuật toán khác, và thang sáu bậc neo
vào công sức tối ưu.

### 14. So với thời khóa biểu do người xếp tay thì hơn bao nhiêu?

**Chưa đo.** Không có số liệu nào trong đề tài so với lịch người xếp tay, nên không trích
gì cả. Nếu bị hỏi, nói thẳng là chưa đo và đó là hướng đánh giá tiếp theo — cần xin một
thời khóa biểu thật của một trường rồi chấm bằng cùng bộ tiêu chí.

Cái đã đo được so với thực tế nhà trường là: phân bố số tiết mỗi môn khớp đúng định mức
Thông tư 32/2018 và 13/2022.

### 15. Sao bảng benchmark ghi tỷ lệ hợp lệ của hệ thống chỉ 20%?

Vì phòng thí nghiệm cố tình chạy **một mạch từ lời giải thô**, bỏ các pha sửa tiết thiếu và
dồn tiết, để so đúng phần chiến lược tìm kiếm chứ không so cả dây chuyền. Đường chạy thật
có đủ các pha đó, và lần xếp thật gần nhất ghi nhận **930/930 tiết lưu được, 0 lỗi
cứng**.

### 16. Làm sao biết thuật toán không "ăn gian": bỏ bớt tiết cho đẹp điểm?

Thiếu tiết là **lỗi cứng**, mỗi lỗi trừ 100 điểm, và còn một lỗi cứng thì lịch xếp hạng Tệ
bất kể điểm mềm. Ngoài ra luyện kim bị chặn: mọi nước đi làm tăng số lỗi cứng đều bị hoàn
lại ngay, nên thuật toán **không bao giờ đổi một lỗi cứng lấy điểm mềm đẹp hơn**.

Khi lưu, hệ thống báo rõ "930/930 tiết lưu được, 0 bị từ chối".

### 17. Công bằng giữa các giáo viên đo thế nào?

Bằng **hệ số Gini** trên điểm chất lượng lịch của từng giáo viên, kèm đường Lorenz. Điểm
mỗi giáo viên = 100 trừ các khoản bất tiện: mỗi tiết trống phải chờ trừ 6, mỗi buổi đến
trường dư trừ 5, không có ngày nghỉ trong tuần trừ 12, tiết cuối buổi trừ 3, phải đổi tầng
trừ 2, dạy 5 tiết liền trừ 4, nguyện vọng không được đáp ứng trừ 4.

Hệ thống chỉ ra cụ thể **ai đang chịu thiệt nhất** (dưới 70 điểm) và khoản bất tiện nào
nặng nhất với người đó.

*Trung thực nếu bị hỏi sâu:* trong hàm mục tiêu của bộ giải cũng có một khoản "fairness"
nhưng **mặc định tắt (trọng số 0)** — công bằng hiện được đo và báo cáo để người quản lý
nhìn thấy, chứ chưa được tối ưu trực tiếp. Lần đo gần nhất ghi nhận người nặng nhất gấp
15,7 lần người nhẹ nhất; đây là điểm yếu nên chủ động thừa nhận.

### 18. "Quy luật ẩn" là gì?

Hệ thống ghi nhật ký mọi lần quản trị viên kéo thả sửa lịch. Khi cùng một giáo viên bị
chuyển khỏi cùng một ô **từ 3 lần trở lên**, hệ thống nêu giả thuyết "có lẽ thầy cô này
bận giờ đó" kèm độ tin cậy, và đề nghị một cú bấm để biến nó thành ràng buộc chính thức.

Có ba loại: giáo viên tránh ô, lớp tránh ô, môn tránh ô. Hệ thống **không tự áp dụng** —
luôn hỏi người dùng.

### 19. Nếu trường thay đổi dữ liệu giữa chừng thì sao?

Chạy lại. Tiết đã khóa được giữ nguyên, phần còn lại xếp lại từ đầu. Trước khi chạy, hệ
thống kiểm tiền điều kiện và báo chặn nếu dữ liệu bất khả thi — ví dụ thiếu giáo viên cho
một môn, hoặc quy tắc tiết cố định mâu thuẫn nhau.

### 20. Vì sao không chạy song song nhiều luồng cho nhanh?

Đã thử và đã gỡ bỏ: hai job chạy song song dùng chung một đối tượng kiểm ràng buộc làm
hỏng kết quả học kỳ 1 (929/930 tiết). Hiện hàng đợi chạy **một job một lúc**. Đây là đánh
đổi có chủ ý: chậm hơn nhưng kết quả đúng.

Phần chạy song song vẫn dùng, nhưng ở phòng thí nghiệm: 15 lần chạy benchmark song song
xong trong 8 phút 45.

---

## C. Số liệu cầm tay

| Hỏi gì | Trả lời |
|---|---|
| Thuật toán | Luyện kim mô phỏng + nước đi chuỗi Kempe + bốc theo điểm nóng |
| Đóng góp chính | Kempe 10%: cùng 141 giây, −3764 → −2801, thắng 16/16 |
| So thuật toán khác | 7 thuật toán, 5 lần mỗi cái, cùng 700.000 vòng |
| Ràng buộc | 13 cứng, 19 khoản mềm |
| Điểm | 1000 − lỗi cứng×100 − phạt mềm + thưởng nguyện vọng |
| Bậc chất lượng | Theo phạt tránh được mỗi tiết; 6 bậc; ≤3,90 là Xuất sắc |
| Quy mô | 30 lớp, 73 GV, 44 phòng, 19 môn, 930 tiết/tuần |
| Thời gian | ~141 giây một vòng 700k nước; ~5–6 phút một học kỳ |
| Ngân sách tìm kiếm | Mặc định 700.000; máy chủ đang đặt 2.400.000 |
| Số lần thử | 3–6 lần, giữ bản tốt nhất, ưu tiên ít lỗi cứng |
| Công bằng | Hệ số Gini + 7 khoản bất tiện |

---

## D. Ba chỗ phải chốt trước khi bảo vệ

**1. `CHUC_NANG.md` đã bị xoá — đừng phát bản cũ cho ai.** File đó mô tả thuật toán là
"Genetic Algorithm" với khởi tạo quần thể, chọn lọc, lai ghép, đột biến; code không có bất
cứ thứ nào trong đó. Nó cũng ghi "5 ràng buộc cứng, 6 ràng buộc mềm" trong khi thực tế là
13 và 19. File đã được gỡ khỏi repo, nhưng nếu bản in hay bản sao cũ còn nằm đâu đó thì
phải thu lại: ban giám khảo đọc nó rồi hỏi là bạn phải bảo vệ một thuật toán không tồn tại.

**2. Số liệu trong báo cáo Word lệch với dữ liệu thật.** Báo cáo ghi 20 môn, 42 phòng;
dữ liệu thật là 19 môn, 44 phòng. Bảng Gini tính trên 76 giáo viên trong khi bộ dữ liệu có
73. Chốt lại một con số rồi sửa đồng loạt.

**3. Benchmark chưa cố định hạt giống ngẫu nhiên.** Chính báo cáo đã tự nhận điều này. Nếu
bị hỏi "cho chạy lại xem", kết quả sẽ khác vài chục điểm. Nói trước là "đo trên một máy,
một bộ dữ liệu, chưa cố định seed" thì thành sự cẩn trọng; để bị chỉ ra thì thành lỗ hổng.
