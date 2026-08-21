import { TimeSlot } from '../constraint.service';

/**
 * One reversible change to a schedule. `key` identifies the change so a tabu list can
 * forbid undoing it straight away.
 */
export interface Move {
  key: string;
  undo: () => void;
}

/** Everything a solver needs, without knowing how a timetable is built or scored. */
export interface MoveOperations {
  fitness(slots: TimeSlot[]): number;
  hardViolations(slots: TimeSlot[]): number;
  /** Apply a random legal change, or return null when the draw produced nothing valid. */
  randomMove(slots: TimeSlot[]): Move | null;
}

export interface SolverBudget {
  iterations: number;
  /** Stop early after this many iterations with no improvement. */
  plateauLimit: number;
}

export interface SolverOutcome {
  score: number;
  iterations: number;
  improvements: number;
  /** Best score sampled over time - the convergence curve. */
  trace: number[];
}

export interface ImprovementSolver {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  improve(slots: TimeSlot[], ops: MoveOperations, budget: SolverBudget): SolverOutcome;
}

export type Placement = Array<{ day: number; period: number }>;

/**
 * A solver that accepts downhill moves wanders away from the best solution it found.
 * Reporting that best score while leaving the schedule wherever the walk ended would be
 * measuring two different things, so those solvers snapshot the best and restore it
 * before returning.
 */
export function snapshotPlacement(slots: TimeSlot[]): Placement {
  return slots.map((slot) => ({ day: slot.day, period: slot.period }));
}

export function restorePlacement(slots: TimeSlot[], placement: Placement) {
  for (let i = 0; i < slots.length && i < placement.length; i++) {
    slots[i].day = placement[i].day;
    slots[i].period = placement[i].period;
  }
}

/** Sample the running best at a fixed resolution so every trace is comparable. */
export function makeTracer(budget: SolverBudget, samples = 60) {
  const every = Math.max(1, Math.floor(budget.iterations / samples));
  const trace: number[] = [];
  return {
    trace,
    record(iteration: number, score: number, force = false) {
      if (force || iteration % every === 0) trace.push(score);
    },
  };
}
