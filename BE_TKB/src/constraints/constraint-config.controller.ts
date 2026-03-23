import { Controller, Get, Patch, Param, Body } from '@nestjs/common';

interface ConstraintConfigItem {
    id: string;
    ma_rang_buoc: string;
    ten_rang_buoc: string;
    loai: 'HARD' | 'SOFT';
    trong_so: number;
    is_active: boolean;
    mo_ta: string;
}

// In-memory constraint config (no DB table needed)
const DEFAULT_CONSTRAINTS: ConstraintConfigItem[] = [
    // Hard Constraints
    { id: 'HC01', ma_rang_buoc: 'HC_01', ten_rang_buoc: 'Không trùng giáo viên', loai: 'HARD', trong_so: 100, is_active: true, mo_ta: 'Một giáo viên không thể dạy 2 lớp cùng lúc.' },
    { id: 'HC02', ma_rang_buoc: 'HC_02', ten_rang_buoc: 'Không trùng lớp học', loai: 'HARD', trong_so: 100, is_active: true, mo_ta: 'Một lớp không thể học 2 môn cùng lúc.' },
    { id: 'HC03', ma_rang_buoc: 'HC_03', ten_rang_buoc: 'Không trùng phòng học', loai: 'HARD', trong_so: 100, is_active: true, mo_ta: 'Một phòng không thể chứa 2 lớp cùng lúc.' },
    { id: 'HC04', ma_rang_buoc: 'HC_04', ten_rang_buoc: 'Lịch bận giáo viên', loai: 'HARD', trong_so: 100, is_active: true, mo_ta: 'Không xếp vào các ô giáo viên đã đăng ký bận.' },
    { id: 'HC05', ma_rang_buoc: 'HC_05', ten_rang_buoc: 'Tiết cố định', loai: 'HARD', trong_so: 100, is_active: true, mo_ta: 'Chào cờ (T2/T1), Sinh hoạt (T7/T5), GDDP, HDTN cố định.' },
    // Soft Constraints
    { id: 'SC01', ma_rang_buoc: 'SC_01', ten_rang_buoc: 'Phân bố đều môn học', loai: 'SOFT', trong_so: 10, is_active: true, mo_ta: 'Các môn có nhiều tiết nên rải đều trong tuần.' },
    { id: 'SC02', ma_rang_buoc: 'SC_02', ten_rang_buoc: 'Tránh môn nặng liên tiếp', loai: 'SOFT', trong_so: 20, is_active: true, mo_ta: 'Toán, Lý, Hóa không nên xếp quá 3 tiết liên tiếp.' },
    { id: 'SC03', ma_rang_buoc: 'SC_03', ten_rang_buoc: 'Ưu tiên buổi sáng', loai: 'SOFT', trong_so: 15, is_active: true, mo_ta: 'Toán, Văn, Anh ưu tiên xếp vào tiết 1-3.' },
    { id: 'SC04', ma_rang_buoc: 'SC_04', ten_rang_buoc: 'Ghép tiết đôi', loai: 'SOFT', trong_so: 10, is_active: true, mo_ta: 'Các môn chính nên xếp liền tiết khi có thể.' },
    { id: 'SC05', ma_rang_buoc: 'SC_05', ten_rang_buoc: 'Hạn chế trống tiết', loai: 'SOFT', trong_so: 5, is_active: true, mo_ta: 'Giáo viên không nên bị trống tiết giữa 2 tiết dạy.' },
    { id: 'SC06', ma_rang_buoc: 'SC_06', ten_rang_buoc: 'Giới hạn tiết/buổi', loai: 'SOFT', trong_so: 10, is_active: true, mo_ta: 'Giáo viên không nên dạy quá 4 tiết/buổi.' },
];

let constraintStore = [...DEFAULT_CONSTRAINTS];

@Controller('cau-hinh-rang-buoc')
export class ConstraintConfigController {

    @Get()
    getAll() {
        return constraintStore;
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: Partial<ConstraintConfigItem>) {
        const idx = constraintStore.findIndex(c => c.id === id);
        if (idx === -1) return { error: 'Not found' };
        constraintStore[idx] = { ...constraintStore[idx], ...body };
        return constraintStore[idx];
    }
}
