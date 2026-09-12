/**
 * Doi chieu phan bo tiet trong file mau voi dinh muc GDPT 2018 cho cap THPT.
 *
 * So tiet/tuan = so tiet/nam chia 35 tuan. Chuyen de hoc tap (105 tiet/nam) da duoc gop vao
 * mon goc, dung nhu cach he thong lam, nen mot mon lua chon co the la 2 tiet (khong chuyen de)
 * hoac 3 tiet (2 co ban + 1 chuyen de).
 */
const STANDARD: Array<{ code: string; name: string; perYear: number; note?: string }> = [
  { code: 'VAN', name: 'Ngữ văn', perYear: 105 },
  { code: 'TOAN', name: 'Toán', perYear: 105 },
  { code: 'ANH', name: 'Ngoại ngữ 1', perYear: 105 },
  { code: 'LS', name: 'Lịch sử', perYear: 52, note: 'phần bắt buộc theo TT 13/2022' },
  { code: 'GDTC', name: 'Giáo dục thể chất', perYear: 70 },
  { code: 'GDQP', name: 'GD quốc phòng và an ninh', perYear: 35 },
  { code: 'HDTN', name: 'Hoạt động trải nghiệm, hướng nghiệp', perYear: 105 },
  { code: 'GDDP', name: 'Nội dung GD của địa phương', perYear: 35 },
];

const SAMPLE: Record<string, number> = {
  VAN: 3, TOAN: 4, ANH: 3, LS: 2, GDTC: 2, GDQP: 1, HDTN: 3, GDDP: 1,
};

console.log('MON BAT BUOC — file mau vs dinh muc\n');
console.log('Mon                                | chuan/tuan | mau | lech');
console.log('-----------------------------------|------------|-----|------');

let sampleTotal = 0;
let standardTotal = 0;
for (const item of STANDARD) {
  const standard = item.perYear / 35;
  const sample = SAMPLE[item.code] ?? 0;
  sampleTotal += sample;
  standardTotal += standard;
  const diff = sample - standard;
  const mark = Math.abs(diff) < 0.01 ? '' : diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  console.log(
    `${item.name.padEnd(34)} | ${standard.toFixed(2).padStart(10)} | ${String(sample).padStart(3)} | ${mark.padStart(5)}`,
  );
}

console.log(`\nTong bat buoc: chuan ${standardTotal.toFixed(1)} — mau ${sampleTotal}`);
console.log('\nMon lua chon: chon 4 mon, moi mon 70 tiet/nam = 2 tiet/tuan.');
console.log('Chuyen de hoc tap: 3 cum x 35 tiet = 105 tiet/nam = 3 tiet/tuan, gop vao mon goc.');
console.log('  => ba mon lua chon o 3 tiet (2 + 1 chuyen de) va mot mon o 2 tiet.');
console.log('  File mau: HOA 3, LY 3, SINH 3, TIN 2 — DUNG dung mau nay.\n');
console.log('Chao co + sinh hoat cuoi tuan: 2 tiet/tuan.\n');
console.log(`Tong chuan     : ${(standardTotal + 8 + 3 + 2).toFixed(1)} tiet/tuan`);
console.log(`Tong file mau  : ${sampleTotal + 11 + 2} tiet/tuan`);
