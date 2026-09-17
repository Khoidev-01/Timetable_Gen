/**
 * Gop ket qua cua nhieu tien trinh phong thi nghiem chay song song thanh mot bang.
 *
 * Moi tep la mot lan chay cua mot thuat toan. Thong ke — trung binh, lech chuan, ty le
 * hop le — duoc tinh lai tu tung lan, khong lay trung binh cua trung binh.
 *
 * Dung: npx ts-node scripts/merge-benchmark-lab.ts <thu-muc-json> <tep-csv>
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, writeSync } from 'fs';
import { dirname, join } from 'path';
import { BenchmarkReport, SolverStatistics, benchmarkCsv } from '../src/algorithm/benchmark.service';

const say = (line = '') => writeSync(1, `${line}\n`);

const DIR = process.argv[2];
const CSV = process.argv[3];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const reports: BenchmarkReport[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf-8')));

const runsByKey = new Map<string, SolverStatistics[]>();
for (const report of reports) {
  for (const result of report.results) {
    if (!runsByKey.has(result.key)) runsByKey.set(result.key, []);
    runsByKey.get(result.key)!.push(result);
  }
}

const merged: SolverStatistics[] = [...runsByKey.values()].map((runs) => {
  // Moi tep la MOT lan chay, nen diem trung binh cua tep chinh la diem cua lan do
  const scores = runs.map((r) => r.meanScore);
  const best = runs.reduce((a, b) => (b.bestScore > a.bestScore ? b : a));
  return {
    key: runs[0].key,
    label: runs[0].label,
    description: runs[0].description,
    runs: runs.length,
    bestScore: Math.max(...scores),
    worstScore: Math.min(...scores),
    meanScore: Math.round(mean(scores)),
    stdDeviation: Math.round(std(scores)),
    meanHardViolations: Number(mean(runs.map((r) => r.meanHardViolations)).toFixed(2)),
    validRate: Number(mean(runs.map((r) => r.validRate)).toFixed(1)),
    meanDurationMs: Math.round(mean(runs.map((r) => r.meanDurationMs))),
    meanIterations: Math.round(mean(runs.map((r) => r.meanIterations))),
    trace: best.trace,
  };
});

merged.sort((a, b) => b.meanScore - a.meanScore);

const construction = reports.map((r) => r.constructionScore);
say(`${reports.length} lan chay. Diem loi giai ban dau (chua toi uu): TB ${Math.round(mean(construction))}\n`);
say('Thuat toan                          | lan | TB     | tot nhat | te nhat | lech chuan | hop le | giay TB');
say('------------------------------------|-----|--------|----------|---------|------------|--------|--------');
for (const r of merged) {
  say(
    `${r.label.padEnd(35)} | ${String(r.runs).padStart(3)} | ${String(r.meanScore).padStart(6)} | ` +
    `${String(r.bestScore).padStart(8)} | ${String(r.worstScore).padStart(7)} | ${String(r.stdDeviation).padStart(10)} | ` +
    `${String(r.validRate).padStart(5)}% | ${(r.meanDurationMs / 1000).toFixed(0).padStart(6)}`,
  );
}

if (CSV) {
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, benchmarkCsv(merged) + '\n', 'utf-8');
  writeFileSync(CSV.replace(/\.csv$/, '.json'), JSON.stringify({ constructionScore: Math.round(mean(construction)), results: merged }, null, 2), 'utf-8');
  say(`\nDa ghi ${CSV}`);
}
