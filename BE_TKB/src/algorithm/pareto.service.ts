import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlgorithmService } from './algorithm.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { FairnessService } from './fairness.service';

export interface ParetoPoint {
  /** The fairness weight this run was solved with. */
  fairnessWeight: number;
  timetableId: string;
  /** Total quality: higher is better. */
  score: number;
  /** Inequality between teachers: lower is better. */
  gini: number;
  /** The gap in schedule quality between the best-off and worst-off teacher. */
  spread: number;
  worstTeacherQuality: number;
  hardViolations: number;
  isValid: boolean;
  /** False when another run beat this one on both measures at once. */
  onFrontier: boolean;
  seconds: number;
}

export interface ParetoSweep {
  points: ParetoPoint[];
  /** The run the school is most likely to want, and why. */
  recommendation?: { fairnessWeight: number; reason: string };
}

/** Weights to sweep. 0 is today's objective; the rest buy fairness with total quality. */
const DEFAULT_WEIGHTS = [0, 2, 5, 10, 20, 40];

/**
 * Shows what fairness costs.
 *
 * The solver minimises one number, and that number is blind to distribution: a week where
 * one teacher is miserable and everyone else comfortable scores the same as one shared
 * evenly. Adding a fairness term fixes that but raises an obvious question the system had
 * no way to answer - how much total quality does a fairer schedule cost?
 *
 * Solving the same term repeatedly at different fairness weights answers it with numbers
 * instead of opinion. Runs that another run beat on both measures at once are marked off
 * the frontier: nobody should pick those, whatever they value.
 */
@Injectable()
export class ParetoService {
  private readonly logger = new Logger(ParetoService.name);

  constructor(
    private prisma: PrismaService,
    private algorithm: AlgorithmService,
    private constraints: ConstraintService,
    private fairness: FairnessService,
  ) {}

  async sweep(semesterId: string, weights: number[] = DEFAULT_WEIGHTS): Promise<ParetoSweep> {
    const original = this.constraints.weights.fairness;
    const points: ParetoPoint[] = [];

    try {
      for (const fairnessWeight of weights) {
        const started = Date.now();

        // initialize() reloads the admin's saved weights, so the sweep value has to be
        // applied after the solver has finished setting itself up, not before
        const result: any = await this.algorithm.runAlgorithm(semesterId, {
          fairnessWeight,
        });
        const seconds = Math.round(((Date.now() - started) / 1000) * 10) / 10;

        const slots = await this.prisma.timetableSlot.findMany({
          where: { timetable_id: result.id },
        });
        const mapped: TimeSlot[] = slots.map((s) => ({
          id: s.id,
          day: s.day,
          period: s.period,
          classId: s.class_id,
          subjectId: s.subject_id,
          teacherId: s.teacher_id,
          roomId: s.room_id ?? undefined,
        }));

        // Score every run on the same neutral objective. Comparing runs by the score each
        // was optimised for would compare six different questions.
        this.constraints.weights.fairness = 0;
        const fitness = this.constraints.getFitnessDetails(mapped);
        // Score the run just produced, not whichever timetable happens to be published
        const report = await this.fairness.reportFor(semesterId, mapped);

        points.push({
          fairnessWeight,
          timetableId: result.id,
          score: fitness.score,
          gini: report.gini,
          spread: report.summary.spread,
          worstTeacherQuality: report.summary.worst,
          hardViolations: fitness.hardViolations,
          isValid: fitness.isValid,
          onFrontier: true,
          seconds,
        });

        this.logger.log(
          `fairness=${fairnessWeight}: điểm ${fitness.score}, Gini ${report.gini}, ${seconds}s`,
        );
      }
    } finally {
      this.constraints.weights.fairness = original;
    }

    this.markFrontier(points);
    return { points, recommendation: this.recommend(points) };
  }

  /**
   * A run is off the frontier when another run is at least as good on both measures and
   * strictly better on one. Those are never worth choosing, whatever the school values.
   */
  private markFrontier(points: ParetoPoint[]) {
    for (const point of points) {
      point.onFrontier = !points.some(
        (other) =>
          other !== point &&
          other.isValid &&
          other.score >= point.score &&
          other.gini <= point.gini &&
          (other.score > point.score || other.gini < point.gini),
      );
      if (!point.isValid) point.onFrontier = false;
    }
  }

  /**
   * The knee of the curve: the point past which more fairness starts costing a lot of
   * quality for very little gain. A recommendation, not a decision - the trade is the
   * school's to make.
   */
  private recommend(points: ParetoPoint[]) {
    const frontier = points.filter((p) => p.onFrontier).sort((a, b) => b.gini - a.gini);
    if (frontier.length === 0) return undefined;

    const baselineRun = points.find((p) => p.fairnessWeight === 0);

    // One point beat everything else on both measures at once. There is no trade to weigh
    // up - it is simply the best run - and that happens: a schedule that spreads the load
    // more evenly is often the tidier schedule too.
    if (frontier.length === 1) {
      const only = frontier[0];
      if (!baselineRun || only.fairnessWeight === 0) {
        return { fairnessWeight: only.fairnessWeight, reason: 'Tốt nhất trong các mức đã thử.' };
      }
      return {
        fairnessWeight: only.fairnessWeight,
        reason:
          `Tốt hơn mức hiện tại ở CẢ HAI mặt: điểm ${baselineRun.score} → ${only.score} ` +
          `và Gini ${baselineRun.gini} → ${only.gini}. Không phải đánh đổi gì.`,
      };
    }

    let best = frontier[0];
    let bestRatio = -Infinity;

    for (let i = 1; i < frontier.length; i++) {
      const giniGain = frontier[i - 1].gini - frontier[i].gini;
      const scoreCost = frontier[i - 1].score - frontier[i].score;
      if (giniGain <= 0) continue;

      // Gini moves in hundredths while the score moves in hundreds, so scale before
      // comparing them at all
      const ratio = (giniGain * 1000) / Math.max(1, scoreCost);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = frontier[i];
      }
    }

    const baseline = baselineRun;
    if (!baseline || best.fairnessWeight === 0) {
      return {
        fairnessWeight: best.fairnessWeight,
        reason: 'Cân bằng nhất giữa chất lượng tổng và độ đồng đều.',
      };
    }

    return {
      fairnessWeight: best.fairnessWeight,
      reason:
        `Giảm chênh lệch giữa giáo viên từ ${baseline.spread} xuống ${best.spread} điểm ` +
        `(Gini ${baseline.gini} → ${best.gini}), đổi lại ${baseline.score - best.score} điểm chất lượng tổng.`,
    };
  }
}
