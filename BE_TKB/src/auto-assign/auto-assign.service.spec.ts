import { PeriodType } from '@prisma/client';
import { AutoAssignService } from './auto-assign.service';

/**
 * Lý thuyết và thực hành cùng môn, cùng lớp là phần việc của một giáo viên. Trước đây mỗi phần
 * được giao riêng theo "ai còn nhiều chỗ trống nhất", nên hai phần hay rơi vào hai người.
 */
describe('AutoAssignService — lý thuyết và thực hành cùng giáo viên', () => {
  const service = new AutoAssignService({} as any);
  const assign = (teachers: any[], demands: any[]) => (service as any).assignTeachers(teachers, demands);

  const teacher = (code: string, effectiveLoad: number) => ({
    code,
    fullName: code,
    majorSubject: 'LY',
    teachableGrades: [10],
    position: 'GV',
    baseLoad: effectiveLoad,
    reduction: 0,
    effectiveLoad,
  });
  const demand = (className: string, periodType: PeriodType, periodsNeeded: number) => ({
    classId: className,
    className,
    gradeLevel: 10,
    subjectCode: 'LY',
    subjectName: periodType === PeriodType.PRACTICE ? 'Vật lý (TH)' : 'Vật lý',
    periodsNeeded,
    periodType,
  });

  it('không tách đôi khi người được ưu tiên chỉ đủ chỗ cho một phần', () => {
    // A chủ nhiệm 10A1 nên được ưu tiên, nhưng chỉ còn 2 tiết: giao riêng từng phần thì LT về A,
    // TH về C. Giao cả khối thì A không nhận nổi 3 tiết, C nhận cả hai.
    const teachers = [{ ...teacher('A', 2), homeroomClass: '10A1' }, teacher('C', 3)];
    const result = assign(teachers, [demand('10A1', PeriodType.THEORY, 2), demand('10A1', PeriodType.PRACTICE, 1)]);

    expect(result.assignments.map((d: any) => d.assignedTeacherCode)).toEqual(['C', 'C']);
    expect(result.warnings).toEqual([]);
  });

  it('không ai đủ chỗ cho cả hai phần thì để trống cả hai và báo một lần', () => {
    const teachers = [teacher('A', 2), teacher('B', 2)];
    const result = assign(teachers, [demand('10A1', PeriodType.THEORY, 2), demand('10A1', PeriodType.PRACTICE, 1)]);

    expect(result.assignments.every((d: any) => d.assignedTeacherCode === undefined)).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Vật lý + Vật lý (TH)');
  });
});
