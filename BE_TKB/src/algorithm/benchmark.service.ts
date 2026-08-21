import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AlgorithmService } from './algorithm.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { IMPROVEMENT_SOLVERS, solverByKey } from './solvers/improvement.solvers';
import { SolverBudget } from './solvers/solver.interface';

export interface BenchmarkOptions {
  semesterId: string;
  solverKeys?: string[];
  runs?: number;
  iterations?: number;
}

export interface SolverStatistics {
  key: string;
  label: string;
  description: string;
  runs: number;
  bestScore: number;
  worstScore: number;
  meanScore: number;
  stdDeviation: number;
  meanHardViolations: number;
  validRate: number;
  meanDurationMs: number;
  meanIterations: number;
  /** Convergence curve of the best run, resampled to a common length. */
  trace: number[];
}

export interface BenchmarkReport {
  semesterId: string;
  runs: number;
  iterations: number;
  constructionScore: number;
  results: SolverStatistics[];
  csv: string;
}

const MAX_RUNS = 30;
const MAX_ITERATIONS = 40_000;

/**
 * Runs several improvement strategies over the same problem so their quality can be
 * compared with numbers instead of intuition.
 *
 * Every solver starts from its own freshly built construction. Reusing one construction
 * would make the comparison tighter but also unrealistic - in production each run builds
 * its own, and the spread between constructions is part of what a strategy has to cope
 * with.
 */
@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly algorithm: AlgorithmService,
    private readonly constraints: ConstraintService,
  ) {}

  listSolvers() {
    return IMPROVEMENT_SOLVERS.map((solver) => ({
      key: solver.key,
      label: solver.label,
      description: solver.description,
    }));
  }

  async run(options: BenchmarkOptions): Promise<BenchmarkReport> {
    const runs = Math.min(Math.max(options.runs ?? 10, 1), MAX_RUNS);
    const iterations = Math.min(Math.max(options.iterations ?? 8000, 100), MAX_ITERATIONS);

    const keys = options.solverKeys?.length
      ? options.solverKeys
      : IMPROVEMENT_SOLVERS.map((s) => s.key);

    const solvers = keys.map((key) => {
      const solver = solverByKey(key);
      if (!solver) throw new BadRequestException(`Không có thuật toán với mã "${key}".`);
      return solver;
    });

    const data = await this.algorithm.prepareData(options.semesterId);
    if (!data.assignments || data.assignments.length === 0) {
      throw new BadRequestException('Học kỳ này chưa có phân công giảng dạy để chạy thử nghiệm.');
    }

    const ops = this.algorithm.moveOperations();
    const budget: SolverBudget = { iterations, plateauLimit: Math.max(1000, iterations / 4) };

    // A reference point: how good the construction is before any improvement
    const reference = await this.algorithm.buildConstruction(data);
    const constructionScore = ops.fitness(reference);

    const results: SolverStatistics[] = [];

    for (const solver of solvers) {
      const scores: number[] = [];
      const hardCounts: number[] = [];
      const durations: number[] = [];
      const iterationCounts: number[] = [];
      let bestTrace: number[] = [];
      let bestScore = Number.NEGATIVE_INFINITY;

      for (let run = 0; run < runs; run++) {
        const slots = await this.algorithm.buildConstruction(data);

        const startedAt = Date.now();
        const outcome = solver.improve(slots, ops, budget);
        durations.push(Date.now() - startedAt);

        const hard = this.constraints.checkHardConstraints(slots);
        scores.push(outcome.score);
        hardCounts.push(hard);
        iterationCounts.push(outcome.iterations);

        if (outcome.score > bestScore) {
          bestScore = outcome.score;
          bestTrace = outcome.trace;
        }
      }

      results.push({
        key: solver.key,
        label: solver.label,
        description: solver.description,
        runs,
        bestScore,
        worstScore: Math.min(...scores),
        meanScore: Math.round(this.mean(scores)),
        stdDeviation: Math.round(this.stdDeviation(scores)),
        meanHardViolations: Number(this.mean(hardCounts).toFixed(2)),
        validRate: Number(((hardCounts.filter((h) => h === 0).length / runs) * 100).toFixed(1)),
        meanDurationMs: Math.round(this.mean(durations)),
        meanIterations: Math.round(this.mean(iterationCounts)),
        trace: this.resample(bestTrace, 60),
      });

      this.logger.log(
        `${solver.label}: điểm TB ${Math.round(this.mean(scores))}, ` +
          `tốt nhất ${bestScore}, hợp lệ ${results[results.length - 1].validRate}%`,
      );
    }

    results.sort((a, b) => b.meanScore - a.meanScore);

    return {
      semesterId: options.semesterId,
      runs,
      iterations,
      constructionScore,
      results,
      csv: this.toCsv(results),
    };
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private stdDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const average = this.mean(values);
    const variance = this.mean(values.map((value) => (value - average) ** 2));
    return Math.sqrt(variance);
  }

  /** Traces stop at different lengths, so stretch them onto a common axis to overlay. */
  private resample(trace: number[], length: number): number[] {
    if (trace.length === 0) return [];
    if (trace.length === 1) return new Array(length).fill(trace[0]);

    const out: number[] = [];
    for (let i = 0; i < length; i++) {
      const position = (i / (length - 1)) * (trace.length - 1);
      const low = Math.floor(position);
      const high = Math.min(low + 1, trace.length - 1);
      const weight = position - low;
      out.push(Math.round(trace[low] * (1 - weight) + trace[high] * weight));
    }
    return out;
  }

  private toCsv(results: SolverStatistics[]): string {
    const header = [
      'Thuat_toan',
      'So_lan_chay',
      'Diem_tot_nhat',
      'Diem_te_nhat',
      'Diem_trung_binh',
      'Do_lech_chuan',
      'Loi_cung_TB',
      'Ty_le_hop_le_%',
      'Thoi_gian_TB_ms',
      'So_vong_lap_TB',
    ].join(',');

    const rows = results.map((r) =>
      [
        r.label,
        r.runs,
        r.bestScore,
        r.worstScore,
        r.meanScore,
        r.stdDeviation,
        r.meanHardViolations,
        r.validRate,
        r.meanDurationMs,
        r.meanIterations,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
