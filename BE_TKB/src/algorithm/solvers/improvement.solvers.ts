import { TimeSlot } from '../constraint.service';
import {
  ImprovementSolver,
  MoveOperations,
  Placement,
  SolverBudget,
  SolverOutcome,
  makeTracer,
  restorePlacement,
  snapshotPlacement,
} from './solver.interface';

/** Baseline: keep whatever the construction heuristic produced. */
export class NoImprovementSolver implements ImprovementSolver {
  readonly key = 'GREEDY';
  readonly label = 'Greedy thuần';
  readonly description = 'Chỉ dùng heuristic dựng lời giải, không cải thiện thêm. Dùng làm mốc so sánh.';

  improve(slots: TimeSlot[], ops: MoveOperations): SolverOutcome {
    const score = ops.fitness(slots);
    return { score, iterations: 0, improvements: 0, trace: [score, score] };
  }
}

/** Classic hill climbing: a move is kept only when the score strictly rises. */
export class HillClimbingSolver implements ImprovementSolver {
  readonly key = 'HILL_CLIMBING';
  readonly label = 'Hill Climbing';
  readonly description = 'Chỉ nhận nước đi làm điểm tăng. Đơn giản nhưng kẹt ở cực trị địa phương.';

  improve(slots: TimeSlot[], ops: MoveOperations, budget: SolverBudget): SolverOutcome {
    let score = ops.fitness(slots);
    let improvements = 0;
    let sinceImprovement = 0;
    let iteration = 0;

    const tracer = makeTracer(budget);
    tracer.record(0, score, true);

    for (; iteration < budget.iterations; iteration++) {
      const move = ops.randomMove(slots);
      if (!move) continue;

      const candidate = ops.fitness(slots);
      if (candidate > score) {
        score = candidate;
        improvements++;
        sinceImprovement = 0;
      } else {
        move.undo();
        sinceImprovement++;
      }

      tracer.record(iteration, score);
      if (sinceImprovement >= budget.plateauLimit) break;
    }

    tracer.record(iteration, score, true);
    return { score, iterations: iteration, improvements, trace: tracer.trace };
  }
}

/**
 * Hill climbing that also keeps moves scoring exactly the same, letting the search drift
 * sideways across a plateau instead of stalling on the first flat region.
 */
export class LocalSearchSolver implements ImprovementSolver {
  readonly key = 'LOCAL_SEARCH';
  readonly label = 'Local Search (chấp nhận bằng điểm)';
  readonly description = 'Nhận nước đi tăng hoặc bằng điểm, nhờ đó đi ngang qua được vùng cao nguyên.';

  improve(slots: TimeSlot[], ops: MoveOperations, budget: SolverBudget): SolverOutcome {
    let score = ops.fitness(slots);
    let improvements = 0;
    let sinceImprovement = 0;
    let iteration = 0;

    const tracer = makeTracer(budget);
    tracer.record(0, score, true);

    for (; iteration < budget.iterations; iteration++) {
      const move = ops.randomMove(slots);
      if (!move) continue;

      const candidate = ops.fitness(slots);
      if (candidate > score) {
        score = candidate;
        improvements++;
        sinceImprovement = 0;
      } else if (candidate === score) {
        sinceImprovement++;
      } else {
        move.undo();
        sinceImprovement++;
      }

      tracer.record(iteration, score);
      if (sinceImprovement >= budget.plateauLimit) break;
    }

    tracer.record(iteration, score, true);
    return { score, iterations: iteration, improvements, trace: tracer.trace };
  }
}

/**
 * Simulated annealing: early on a worse move is often accepted, which lets the search
 * climb out of a local optimum; as the temperature falls it settles into hill climbing.
 */
export class SimulatedAnnealingSolver implements ImprovementSolver {
  readonly key = 'SIMULATED_ANNEALING';
  readonly label = 'Simulated Annealing';
  readonly description =
    'Chấp nhận nước đi xấu theo xác suất giảm dần theo nhiệt độ, nhờ đó thoát khỏi cực trị địa phương.';

  constructor(
    private readonly startTemperature = 120,
    private readonly endTemperature = 0.5,
  ) {}

  improve(slots: TimeSlot[], ops: MoveOperations, budget: SolverBudget): SolverOutcome {
    let current = ops.fitness(slots);
    let best = current;
    let bestPlacement: Placement = snapshotPlacement(slots);
    let improvements = 0;
    let iteration = 0;

    // Geometric cooling from the start temperature down to the end temperature
    const cooling = Math.pow(this.endTemperature / this.startTemperature, 1 / budget.iterations);
    let temperature = this.startTemperature;

    const tracer = makeTracer(budget);
    tracer.record(0, best, true);

    for (; iteration < budget.iterations; iteration++) {
      const move = ops.randomMove(slots);
      if (!move) {
        temperature *= cooling;
        continue;
      }

      const candidate = ops.fitness(slots);
      const delta = candidate - current;

      if (delta >= 0 || Math.random() < Math.exp(delta / temperature)) {
        current = candidate;
        if (current > best) {
          best = current;
          bestPlacement = snapshotPlacement(slots);
          improvements++;
        }
      } else {
        move.undo();
      }

      temperature *= cooling;
      tracer.record(iteration, best);
    }

    // Hand back the best schedule seen, not wherever the cooling walk finished
    restorePlacement(slots, bestPlacement);

    tracer.record(iteration, best, true);
    return { score: best, iterations: iteration, improvements, trace: tracer.trace };
  }
}

/**
 * Tabu search: sample a handful of moves each step and take the best of them, while a
 * short memory forbids reversing a change straight away. Aspiration lets a tabu move
 * through when it beats everything seen so far.
 */
export class TabuSearchSolver implements ImprovementSolver {
  readonly key = 'TABU_SEARCH';
  readonly label = 'Tabu Search';
  readonly description =
    'Mỗi bước thử nhiều nước đi và chọn nước tốt nhất; danh sách cấm ngăn quay lại trạng thái vừa rời đi.';

  constructor(
    private readonly neighbourhood = 12,
    private readonly tenure = 40,
  ) {}

  improve(slots: TimeSlot[], ops: MoveOperations, budget: SolverBudget): SolverOutcome {
    let best = ops.fitness(slots);
    let bestPlacement: Placement = snapshotPlacement(slots);
    let improvements = 0;
    let iteration = 0;

    let emptyRounds = 0;

    // Move key -> the iteration it stops being forbidden
    const tabu = new Map<string, number>();
    const tracer = makeTracer(budget);
    tracer.record(0, best, true);

    while (iteration < budget.iterations) {
      // Steepest descent over a sample of the neighbourhood. Taking the best of several
      // candidates is what separates tabu search from a random walk with a memory; an
      // earlier version accepted any non-tabu move and performed no better than greedy.
      let chosenScore = Number.NEGATIVE_INFINITY;
      let chosenPlacement: Placement | null = null;
      let chosenKey = '';

      for (let probe = 0; probe < this.neighbourhood && iteration < budget.iterations; probe++) {
        iteration++;

        const move = ops.randomMove(slots);
        if (!move) continue;

        const candidate = ops.fitness(slots);
        const forbidden = (tabu.get(move.key) ?? 0) > iteration;
        const aspires = candidate > best;

        if ((!forbidden || aspires) && candidate > chosenScore) {
          chosenScore = candidate;
          chosenPlacement = snapshotPlacement(slots);
          chosenKey = move.key;
        }

        // Always step back so each probe is measured from the same position
        move.undo();
      }

      // A sample can come back empty when every draw happened to be an illegal move.
      // That is ordinary bad luck, not a dead end, so try again rather than stopping.
      if (!chosenPlacement) {
        emptyRounds++;
        if (emptyRounds >= 50) break;
        continue;
      }
      emptyRounds = 0;

      // Commit the winner even when it scores lower than where we started - that
      // downhill step is the escape, and the tabu memory stops us walking straight back
      restorePlacement(slots, chosenPlacement);
      tabu.set(chosenKey, iteration + this.tenure);

      if (chosenScore > best) {
        best = chosenScore;
        bestPlacement = chosenPlacement;
        improvements++;
      }

      tracer.record(iteration, best);
    }

    // The walk deliberately goes downhill, so the schedule it ends on is not the answer
    restorePlacement(slots, bestPlacement);

    tracer.record(iteration, best, true);
    return { score: best, iterations: iteration, improvements, trace: tracer.trace };
  }
}

export const IMPROVEMENT_SOLVERS: ImprovementSolver[] = [
  new NoImprovementSolver(),
  new HillClimbingSolver(),
  new LocalSearchSolver(),
  new SimulatedAnnealingSolver(),
  new TabuSearchSolver(),
];

export function solverByKey(key: string): ImprovementSolver | undefined {
  return IMPROVEMENT_SOLVERS.find((solver) => solver.key === key);
}
