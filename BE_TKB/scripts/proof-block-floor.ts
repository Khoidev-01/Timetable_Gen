/**
 * Mot mon co so tiet LE co bat buoc phai lo ra mot tiet le loi khong?
 *
 * Toi da khang dinh la co, va dua con so do len giao dien: "104 khong the tranh". Phep do can
 * duoi bat duoc mau thuan — toi uu rieng tieu chi do xuong toi 89, thap hon con so toi goi la
 * san. Mot san ma thuc te di duoi duoc thi khong phai san.
 */
import '../src/load-env';
import { ConstraintService } from '../src/algorithm/constraint.service';

const check = (periods: Array<{ day: number; period: number }>) => {
  const sorted = [...periods].sort((a, b) => (a.day === b.day ? a.period - b.period : a.day - b.day));
  return sorted.filter((curr, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const adjPrev = prev && prev.day === curr.day && Math.abs(prev.period - curr.period) === 1;
    const adjNext = next && next.day === curr.day && Math.abs(next.period - curr.period) === 1;
    return !adjPrev && !adjNext;
  }).length;
};

console.log('Mon 3 tiet, xep kieu khac nhau -> so tiet le loi:');
console.log(`  ba tiet lien nhau mot ngay (1,2,3)        -> ${check([{ day: 2, period: 1 }, { day: 2, period: 2 }, { day: 2, period: 3 }])}`);
console.log(`  mot cap + mot le  (1,2 | 1)               -> ${check([{ day: 2, period: 1 }, { day: 2, period: 2 }, { day: 4, period: 1 }])}`);
console.log(`  rai ba ngay       (1 | 1 | 1)             -> ${check([{ day: 2, period: 1 }, { day: 3, period: 1 }, { day: 4, period: 1 }])}`);
console.log('\nMon 5 tiet:');
console.log(`  nam tiet lien nhau                        -> ${check([1, 2, 3, 4, 5].map((p) => ({ day: 2, period: p })))}`);
console.log(`  mot cap + mot bo ba                       -> ${check([{ day: 2, period: 1 }, { day: 2, period: 2 }, { day: 4, period: 1 }, { day: 4, period: 2 }, { day: 4, period: 3 }])}`);
console.log('\nKet luan: so tiet le KHONG bat buoc sinh ra tiet le loi.');
console.log('Phep kiem chi doi moi tiet co IT NHAT MOT tiet cung mon ben canh, khong doi chia doi.');
