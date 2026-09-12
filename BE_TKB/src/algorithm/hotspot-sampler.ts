import { ConstraintService, TimeSlot } from './constraint.service';

/**
 * Chọn tiết để thử đổi chỗ, ưu tiên những tiết đang gây ra khoản phạt.
 *
 * Vòng tìm kiếm cũ bốc đều trong gần một nghìn tiết. Khoản phạt thì không rải đều: đo trên
 * dữ liệu thật, 30% lớp nặng nhất giữ 43% khoản phạt và 30% giáo viên nặng nhất giữ 49%.
 * Bốc đều nghĩa là phần lớn lượt thử rơi vào chỗ vốn đã ổn — và một nước đi xuất phát từ
 * chỗ đang ổn gần như chắc chắn làm điểm tệ đi, tức là bị từ chối ngay.
 *
 * Danh sách nghi phạm được dựng lại theo chu kỳ chứ không phải mỗi vòng: nó chỉ là thiên
 * hướng chọn, lệch vài nghìn nước đi không sai gì cả, mà dựng lại mỗi vòng thì tốn hơn cả
 * cái nó tiết kiệm được.
 *
 * Một phần tư số lượt vẫn bốc đều. Không có phần ấy thì những tiết đang ổn không bao giờ
 * nhường chỗ, mà nhiều khi phải dọn một chỗ đang ổn thì chỗ đang lỗi mới có nơi để đi.
 */
export class HotspotSampler {
    private hot: TimeSlot[] = [];
    private countdown = 0;

    constructor(
        private readonly constraints: ConstraintService,
        private readonly schedule: TimeSlot[],
        private readonly movable: TimeSlot[],
        /** Tỉ lệ lượt bốc lấy từ danh sách nghi phạm. Đặt 0 là quay lại bốc đều hoàn toàn. */
        private readonly share = 0.75,
        private readonly refreshEvery = 5_000,
    ) {}

    /** Một tiết đáng thử đổi chỗ. */
    pick(): TimeSlot {
        if (this.share <= 0) return this.movable[(Math.random() * this.movable.length) | 0];

        if (this.countdown <= 0) {
            this.hot = this.constraints.locateSoftHotspots(this.schedule);
            this.countdown = this.refreshEvery;
        }
        this.countdown -= 1;

        if (this.hot.length > 0 && Math.random() < this.share) {
            return this.hot[(Math.random() * this.hot.length) | 0];
        }
        return this.movable[(Math.random() * this.movable.length) | 0];
    }
}
