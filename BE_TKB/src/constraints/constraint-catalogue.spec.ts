import { readFileSync } from 'fs';
import { join } from 'path';
import { CONSTRAINT_CATALOGUE, HARD_KEYS, SOFT_KEYS } from './constraint-catalogue';

const SERVICE_SOURCE = readFileSync(
  join(__dirname, '..', 'algorithm', 'constraint.service.ts'),
  'utf8',
);

/**
 * The admin screen once listed eleven constraints while the solver applied twenty-two, and
 * nothing caught it because the two lists were written independently. These tests fail the
 * build if they drift apart again.
 */
describe('constraint catalogue', () => {
  it('covers every weight the solver multiplies by', () => {
    const declared = SERVICE_SOURCE.match(/private readonly defaultWeights = \{([\s\S]*?)\n {4}\};/);
    expect(declared).not.toBeNull();

    const solverKeys = [...declared![1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    const catalogueKeys = new Set([...SOFT_KEYS, 'hardViolation']);

    expect([...solverKeys].sort()).toEqual([...catalogueKeys].sort());
  });

  it('covers every hard check the solver runs', () => {
    const body = SERVICE_SOURCE.match(
      /checkHardConstraints\(schedule: TimeSlot\[\]\): number \{([\s\S]*?)\n {4}\}/,
    );
    expect(body).not.toBeNull();

    // The three physical clashes are inline and unconditional; the rest are gated by key
    const gated = [...body![1].matchAll(/isHardDisabled\('(\w+)'\)/g)].map((m) => m[1]);
    const alwaysOn = HARD_KEYS.filter(
      (key) => !CONSTRAINT_CATALOGUE.find((e) => e.key === key)!.canDisable,
    );

    expect([...new Set(gated)].sort()).toEqual(
      HARD_KEYS.filter((key) => !alwaysOn.includes(key)).sort(),
    );
  });

  it('gives every entry a unique key and code', () => {
    const keys = CONSTRAINT_CATALOGUE.map((e) => e.key);
    const codes = CONSTRAINT_CATALOGUE.map((e) => e.code);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the three physical clashes impossible to switch off', () => {
    const alwaysOn = CONSTRAINT_CATALOGUE.filter((e) => e.kind === 'HARD' && !e.canDisable);
    expect(alwaysOn.map((e) => e.key).sort()).toEqual([
      'classConflict',
      'roomConflict',
      'teacherConflict',
    ]);
  });

  it('writes a real description for every constraint', () => {
    for (const entry of CONSTRAINT_CATALOGUE) {
      expect(entry.name.length).toBeGreaterThan(3);
      expect(entry.description.length).toBeGreaterThan(20);
    }
  });
});
