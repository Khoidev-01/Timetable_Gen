import { HotspotSampler } from './hotspot-sampler';
import { ConstraintService, TimeSlot } from './constraint.service';

function slot(id: string): TimeSlot {
    return { id, classId: 'C1', subjectId: 1, teacherId: 'T1', day: 2, period: 1 };
}

const MOVABLE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(slot);
const HOT = [MOVABLE[0], MOVABLE[1]];

/** Chỉ cần một thứ duy nhất từ ConstraintService, nên dựng đúng thứ ấy. */
function constraintsReturning(hot: TimeSlot[]): ConstraintService {
    return { locateSoftHotspots: jest.fn().mockReturnValue(hot) } as unknown as ConstraintService;
}

describe('HotspotSampler', () => {
    it('đặt tỉ lệ 0 thì bốc đều — đúng hành vi trước khi có cơ chế này', () => {
        const constraints = constraintsReturning(HOT);
        const sampler = new HotspotSampler(constraints, MOVABLE, MOVABLE, 0);

        const picked = new Set<string>();
        for (let i = 0; i < 2000; i++) picked.add(sampler.pick().id!);

        expect(picked.size).toBe(MOVABLE.length);
        // Không hỏi thì không tốn: tỉ lệ 0 thì danh sách nghi phạm không cần dựng lần nào
        expect(constraints.locateSoftHotspots).not.toHaveBeenCalled();
    });

    it('đặt tỉ lệ 1 thì mọi lượt bốc đều rơi vào chỗ đang lỗi', () => {
        const sampler = new HotspotSampler(constraintsReturning(HOT), MOVABLE, MOVABLE, 1);

        for (let i = 0; i < 2000; i++) {
            expect(HOT).toContain(sampler.pick());
        }
    });

    it('không còn chỗ nào lỗi thì quay về bốc đều thay vì kẹt', () => {
        const sampler = new HotspotSampler(constraintsReturning([]), MOVABLE, MOVABLE, 1);

        const picked = new Set<string>();
        for (let i = 0; i < 2000; i++) picked.add(sampler.pick().id!);

        expect(picked.size).toBe(MOVABLE.length);
    });

    /**
     * Dựng lại danh sách mỗi vòng thì tốn hơn cả cái nó tiết kiệm được: đo trên dữ liệu
     * thật, một lần dựng mất 1,7ms, mà vòng tìm kiếm chạy 600.000 vòng.
     */
    it('dựng lại danh sách theo chu kỳ, không phải mỗi lượt', () => {
        const constraints = constraintsReturning(HOT);
        const sampler = new HotspotSampler(constraints, MOVABLE, MOVABLE, 1, 100);

        for (let i = 0; i < 1000; i++) sampler.pick();

        expect(constraints.locateSoftHotspots).toHaveBeenCalledTimes(10);
    });
});
