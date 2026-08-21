import { ConstraintService, TimeSlot } from './constraint.service';

/**
 * Scores a schedule by re-checking only what a move actually changed.
 *
 * The solvers evaluate a schedule after every candidate move. Scoring all 217 periods each
 * time cost about a millisecond, so a run of twelve thousand iterations across twelve
 * restarts spent minutes recomputing numbers that had not moved - and every constraint
 * added made the whole search slower, which is a bad trade to keep making.
 *
 * A move changes when one or two periods happen. It never changes which periods exist, who
 * teaches them, or which class they belong to. So only the one or two classes and one or
 * two teachers involved need rescoring; with seven classes and twenty-one teachers, that is
 * most of the work skipped.
 *
 * The split is exact, not an approximation: every rule already summed independently per
 * class or per teacher. `incremental-scoring.spec.ts` holds it to that by comparing against
 * the full calculation after every move on random schedules - if the two ever disagree, the
 * search would be optimising a number that does not match the score the school is shown.
 */
export class IncrementalScorer {
  private classSlots = new Map<string, TimeSlot[]>();
  private teacherSlots = new Map<string, TimeSlot[]>();

  private classSoft = new Map<string, number>();
  private teacherSoft = new Map<string, number>();
  private classHard = new Map<string, number>();
  private teacherHard = new Map<string, number>();

  private dirtyClasses = new Set<string>();
  private dirtyTeachers = new Set<string>();

  /** Counted once: no move can change these. */
  private invariantHard = 0;

  /** Where each period sat last time it was scored, to find what a move changed. */
  private placement: Array<{ day: number; period: number }> = [];

  constructor(
    private readonly constraints: ConstraintService,
    private readonly slots: TimeSlot[],
  ) {
    for (const slot of slots) {
      if (!this.classSlots.has(slot.classId)) this.classSlots.set(slot.classId, []);
      this.classSlots.get(slot.classId)!.push(slot);

      if (!this.teacherSlots.has(slot.teacherId)) this.teacherSlots.set(slot.teacherId, []);
      this.teacherSlots.get(slot.teacherId)!.push(slot);
    }

    for (const classId of this.classSlots.keys()) this.dirtyClasses.add(classId);
    for (const teacherId of this.teacherSlots.keys()) this.dirtyTeachers.add(teacherId);

    this.invariantHard = this.constraints.invariantHardViolations(slots);
    this.placement = slots.map((slot) => ({ day: slot.day, period: slot.period }));
    this.refresh();
  }

  /**
   * Work out what moved by comparing against the last scored placement.
   *
   * The alternative was for every move generator to report the periods it touched, which
   * works right up until someone adds a fourth kind of move and forgets. Comparing two
   * integers per period costs a small fraction of one rescored class, and it cannot be
   * forgotten.
   */
  private syncFromSlots() {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const was = this.placement[i];
      if (was.day === slot.day && was.period === slot.period) continue;

      this.dirtyClasses.add(slot.classId);
      this.dirtyTeachers.add(slot.teacherId);
      was.day = slot.day;
      was.period = slot.period;
    }
  }

  /** Explicitly mark periods as moved. Rarely needed - `fitness()` detects it itself. */
  touch(...moved: TimeSlot[]) {
    for (const slot of moved) {
      this.dirtyClasses.add(slot.classId);
      this.dirtyTeachers.add(slot.teacherId);
    }
  }

  fitness(): number {
    this.syncFromSlots();
    this.refresh();
    return 1000 - this.hardViolations() * this.constraints.weights.hardViolation - this.softPenalty();
  }

  hardViolations(): number {
    this.syncFromSlots();
    this.refresh();

    let total = this.invariantHard;
    for (const count of this.classHard.values()) total += count;
    for (const count of this.teacherHard.values()) total += count;

    // Rooms are booked only after the grid stops moving, so this is usually zero during
    // the search and cheap to check; it cannot be attributed to one class or teacher.
    return total + this.constraints.crossEntityHardViolations(this.slots);
  }

  private softPenalty(): number {
    let total = 0;
    for (const value of this.classSoft.values()) total += value;
    for (const value of this.teacherSoft.values()) total += value;
    return total;
  }

  private refresh() {
    for (const classId of this.dirtyClasses) {
      const slots = this.classSlots.get(classId) ?? [];
      this.classSoft.set(classId, this.constraints.classPenalty(slots));
      this.classHard.set(classId, this.constraints.classHardViolations(slots));
    }
    this.dirtyClasses.clear();

    for (const teacherId of this.dirtyTeachers) {
      const slots = this.teacherSlots.get(teacherId) ?? [];
      this.teacherSoft.set(teacherId, this.constraints.teacherPenalty(teacherId, slots));
      this.teacherHard.set(teacherId, this.constraints.teacherHardViolations(teacherId, slots));
    }
    this.dirtyTeachers.clear();
  }
}
