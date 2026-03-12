# Tài liệu Giải thuật Lai ghép (Hybrid Algorithm) - Hệ thống Xếp Thời Khóa Biểu

Tài liệu này mô tả chi tiết phương pháp tiếp cận thuật toán được sử dụng trong hệ thống xếp thời khóa biểu tự động. Chúng tôi sử dụng phương pháp **Lai ghép (Hybrid Approach)**, kết hợp giữa **Heuristic (Giải thuật tham lam/kinh nghiệm)** và **Genetic Algorithm (Giải thuật di truyền/Tiến hóa)** để giải quyết bài toán NP-Complete này.

---

## 1. Tổng quan Phương pháp (High-Level Overview)

Việc xếp thời khóa biểu là một bài toán tối ưu hóa tổ hợp phức tạp. Giải pháp của chúng tôi kết hợp ưu điểm của hai phương pháp:
*   **Heuristic (Phase 1 & 2):** Sử dụng các quy tắc kinh nghiệm để nhanh chóng tạo ra một thời khóa biểu "khá tốt" (đạt 90-95% yêu cầu), đảm bảo tính khả thi cơ bản.
*   **Genetic / Stochastic Hill Climbing (Phase 3):** Sử dụng cơ chế tiến hóa để tinh chỉnh, giải quyết các xung đột còn sót lại và tối ưu hóa các tiêu chí phụ (Soft Constraints).

---

## 2. Cấu trúc Dữ liệu (Data Representation)

Hệ thống biểu diễn thời khóa biểu dưới dạng một danh sách phẳng các **TimeSlot (Tiết học)**. Đây chính là "Nhiễm sắc thể" (Chromosome) trong thuật toán di truyền.

```typescript
interface TimeSlot {
    id: string;          // Unique ID
    day: number;         // Thứ (2-7)
    period: number;      // Tiết (1-10)
    classId: string;     // Lớp học
    subjectId: string;   // Môn học
    teacherId: string;   // Giáo viên
    roomId: string;      // Phòng học
    isLocked: boolean;   // Khóa cứng (không thể di chuyển)
}
```

Mỗi cá thể (Individual) trong quần thể là một tập hợp trọn vẹn các `TimeSlot` cho toàn trường trong một học kỳ.

---

## 3. Chi tiết Hoạt động Từng Giai đoạn

### Phase 1: Xếp các tiết Cố định (Fixed Slots)
Giai đoạn này xử lý các ràng buộc cứng không thể thay đổi.
*   **Cơ chế:** Duyệt qua cấu hình hệ thống và gán trực tiếp vào thời khóa biểu.
*   **Quy tắc:**
    1.  **Chào cờ (Thứ 2, Tiết 1):** Gán toàn trường logic "Chào cờ", giáo viên là BGH hoặc GVCN.
    2.  **Sinh hoạt lớp (Thứ 7, Tiết cuối):** Gán tiết SHCN cho GVCN của từng lớp.
    3.  **Khóa vị trí:** Đánh dấu `isLocked = true` để các pha sau không ghi đè.

### Phase 2: Heuristic Filling (Lấp đầy theo Kinh nghiệm)
Đây là giai đoạn quan trọng nhất, nơi phần lớn thời khóa biểu được hình thành. Thuật toán sử dụng chiến lược **Greedy (Tham lam)** kết hợp **Block Scheduling**.

**Quy trình chi tiết:**
1.  **Phân loại Môn học:** Tách các môn học của từng lớp thành 2 nhóm:
    *   **Nhóm Block (GDQP, GDTC):** Cần xếp liền 3-4 tiết, ưu tiên buổi trái (Opposite Session).
    *   **Nhóm Văn hóa:** Các môn còn lại, xếp rải rác.
2.  **Xếp Nhóm Block trước:**
    *   Tìm kiếm một chuỗi các tiết trống liên tiếp (ví dụ: Tiết 1-4 buổi chiều) trên lưới thời gian của lớp.
    *   Đảm bảo không trùng lịch giáo viên dạy môn đó.
    *   Nếu tìm thấy -> Gán ngay lập tức (`Assign & Lock`).
3.  **Xếp Nhóm Văn hóa (Randomized Greedy):**
    *   Xáo trộn danh sách các tiết học văn hóa còn lại.
    *   Duyệt qua từng tiết trong danh sách:
        *   Thử đặt vào ô (Thứ `d`, Tiết `p`) ngẫu nhiên.
        *   **Kiểm tra tính hợp lệ (Feasibility Check):**
            *   Giáo viên có rảnh không? (`!TeacherBusy(d, p)`)
            *   Lớp có trống không? (`!ClassBusy(d, p)`)
            *   Phòng học (nếu yêu cầu) có trống không? (`!RoomBusy(d, p)`)
        *   Nếu hợp lệ -> Gán (`Assign`).
        *   Nếu không -> Thử ô tiếp theo.

**Kết quả Phase 2:** Một thời khóa biểu đầy đủ nhưng có thể vẫn còn xung đột (ví dụ: Giáo viên A bị trùng 2 lớp cùng giờ do thuật toán tham lam không tìm thấy chỗ tốt hơn).

### Phase 3: Genetic / Stochastic Hill Climbing (Tối ưu hóa)
Giai đoạn này dùng để "sửa lỗi" và "làm mịn". Thay vì lai ghép (Crossover) phức tạp giữa nhiều cá thể, chúng tôi sử dụng kỹ thuật **Leo đồi ngẫu nhiên (Stochastic Hill Climbing)** tập trung vào giải quyết xung đột.

**Thuật toán (Pseudocode):**

```python
InitialSolution = Result_From_Phase_2
BestSolution = InitialSolution
BestScore = CalculateFitness(InitialSolution)

LOOP (Generation = 1 to 50):
    # 1. Xác định Xung đột
    Conflicts = FindAllConflicts(CurrentSolution)
    
    # 2. Điều kiện dừng
    IF (Conflicts is EMPTY AND CheckConstraints(CurrentSolution) is VALID):
        BREAK LOOP (Success)

    # 3. Chọn Tiết để Di chuyển (Mutation Candidate)
    IF (Conflicts exist):
        CandidateSlot = RandomChoice(Conflicts) # Ưu tiên sửa lỗi
    ELSE:
        CandidateSlot = RandomChoice(CurrentSolution) # Thử tối ưu ngẫu nhiên

    # 4. Tìm Vị trí Đích (Target Slot)
    TargetSlot = RandomChoice(SameClassSlots) # Chọn một tiết khác cùng lớp

    # 5. Thực hiện Hoán đổi (Mutation: Swap)
    ApplySwap(CandidateSlot, TargetSlot)

    # 6. Đánh giá lại (Selection)
    NewScore = CalculateFitness(CurrentSolution)

    IF (NewScore > BestScore):
        BestScore = NewScore
        SaveState() # Chấp nhận bước đi mới
    ELSE:
        RevertSwap() # Hoàn tác bước đi (Leo đồi thất bại)

RETURN BestSolution
```

---

## 4. Hàm Thích nghi (Fitness Function)

Hàm mục tiêu đánh giá chất lượng của thời khóa biểu. Điểm càng cao, thời khóa biểu càng tốt.

$$
Fitness = BaseScore - (W_1 \times HardConstraints) - (W_2 \times SoftConstraints)
$$

Trong đó:
*   `BaseScore`: Điểm cơ bản (ví dụ: 1000).
*   `HardConstraints` (Trọng sô $$W_1 = 100$$): Các vi phạm nghiêm trọng.
    *   Giáo viên dạy 2 lớp cùng giờ.
    *   Lớp học 2 môn cùng giờ.
    *   Phòng học bị trùng.
*   `SoftConstraints` (Trọng số $$W_2 = 10$$): Các tiêu chí phụ (chưa áp dụng triệt để trong phiên bản này, nhưng đã thiết kế sẵn).
    *   Giáo viên dạy quá số tiết liên tiếp.
    *   Lớp có tiết trống ("lủng") giữa giờ.

---

## 5. Tại sao chọn phương pháp Lai ghép (Hybrid)?

| Phương pháp | Ưu điểm | Nhược điểm |
| :--- | :--- | :--- |
| **Pure Greedy** | Rất nhanh. | Dễ bị kẹt ở cục bộ (Local Optima). Khó thỏa mãn hết ràng buộc phức tạp. |
| **Pure Genetic** | Khả năng tìm kiếm toàn cục tốt. Xử lý đa dạng ràng buộc. | Rất chậm. Tốn tài nguyên. Khó hội tụ nếu khởi tạo ngẫu nhiên. |
| **Hybrid (Của chúng tôi)** | **Tốc độ cao** (nhờ Phase 2) và **Chất lượng tốt** (nhờ Phase 3). | Cài đặt phức tạp hơn do phải kết hợp 2 luồng logic. |

Phương pháp này đảm bảo hệ thống có thể trả về kết quả trong thời gian thực (real-time response) cho người dùng, đồng thời vẫn đảm bảo tính chính xác cao về mặt nghiệp vụ sư phạm.
