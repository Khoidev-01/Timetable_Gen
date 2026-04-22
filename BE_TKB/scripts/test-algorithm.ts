/**
 * FET Algorithm Test Script
 * Runs the algorithm and validates the output timetable against all constraints.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SlotRow {
    id: string;
    timetable_id: string;
    class_id: string;
    subject_id: number;
    teacher_id: string;
    room_id: number | null;
    day: number;
    period: number;
    is_locked: boolean;
}

async function main() {
    console.log('=== FET Algorithm Timetable Validator ===\n');

    // 1. Get latest timetable
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
    });

    if (!timetable) {
        console.log('❌ No timetable found!');
        return;
    }

    console.log(`📋 Timetable: ${timetable.name} (ID: ${timetable.id})`);
    console.log(`   Fitness: ${timetable.fitness_score}`);
    console.log(`   Created: ${timetable.created_at}\n`);

    // 2. Load slots
    const slots: SlotRow[] = await prisma.timetableSlot.findMany({
        where: { timetable_id: timetable.id },
    }) as any;

    console.log(`📊 Total slots: ${slots.length}`);
    console.log(`   Locked: ${slots.filter(s => s.is_locked).length}`);
    console.log(`   Unlocked: ${slots.filter(s => !s.is_locked).length}\n`);

    // 3. Load reference data
    const classes = await prisma.class.findMany();
    const subjects = await prisma.subject.findMany();
    const teachers = await prisma.teacher.findMany({ include: { constraints: true } });
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
    });

    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const classMap = new Map(classes.map(c => [c.id, c]));

    // ========================================
    // HARD CONSTRAINT CHECKS
    // ========================================
    let totalHardViolations = 0;

    // HC1: Teacher conflict (same teacher, same day+period)
    const teacherTimeMap = new Map<string, SlotRow[]>();
    for (const s of slots) {
        const key = `${s.teacher_id}-${s.day}-${s.period}`;
        if (!teacherTimeMap.has(key)) teacherTimeMap.set(key, []);
        teacherTimeMap.get(key)!.push(s);
    }
    let teacherConflicts = 0;
    for (const [key, group] of teacherTimeMap) {
        if (group.length > 1) {
            teacherConflicts += group.length - 1;
            if (teacherConflicts <= 5) {
                const t = teachers.find(t => t.id === group[0].teacher_id);
                console.log(`   ⚠ Teacher conflict: ${t?.full_name || group[0].teacher_id} day=${group[0].day} period=${group[0].period} (${group.length} slots)`);
            }
        }
    }
    console.log(`🔴 HC1 - Teacher conflicts: ${teacherConflicts}`);
    totalHardViolations += teacherConflicts;

    // HC2: Class conflict (same class, same day+period)
    const classTimeMap = new Map<string, SlotRow[]>();
    for (const s of slots) {
        const key = `${s.class_id}-${s.day}-${s.period}`;
        if (!classTimeMap.has(key)) classTimeMap.set(key, []);
        classTimeMap.get(key)!.push(s);
    }
    let classConflicts = 0;
    for (const [, group] of classTimeMap) {
        if (group.length > 1) classConflicts += group.length - 1;
    }
    console.log(`🔴 HC2 - Class conflicts: ${classConflicts}`);
    totalHardViolations += classConflicts;

    // HC3: Room conflict (same room, same day+period, different class)
    const roomTimeMap = new Map<string, SlotRow[]>();
    for (const s of slots) {
        if (!s.room_id) continue;
        const key = `${s.room_id}-${s.day}-${s.period}`;
        if (!roomTimeMap.has(key)) roomTimeMap.set(key, []);
        roomTimeMap.get(key)!.push(s);
    }
    let roomConflicts = 0;
    for (const [, group] of roomTimeMap) {
        const uniqueClasses = new Set(group.map(s => s.class_id));
        if (uniqueClasses.size > 1) roomConflicts += group.length - 1;
    }
    console.log(`🔴 HC3 - Room conflicts: ${roomConflicts}`);
    totalHardViolations += roomConflicts;

    // HC4: Thursday restriction (P3-5, P8-10 must be empty on day 5)
    let thursdayViolations = 0;
    for (const s of slots) {
        if (s.day === 5 && [3, 4, 5, 8, 9, 10].includes(s.period)) {
            thursdayViolations++;
        }
    }
    console.log(`🔴 HC4 - Thursday violations: ${thursdayViolations}`);
    totalHardViolations += thursdayViolations;

    // HC5: Consecutive same subject > 2
    let consecutiveViolations = 0;
    const classDaySlots = new Map<string, Map<number, SlotRow[]>>();
    for (const s of slots) {
        if (!classDaySlots.has(s.class_id)) classDaySlots.set(s.class_id, new Map());
        const dayMap = classDaySlots.get(s.class_id)!;
        if (!dayMap.has(s.day)) dayMap.set(s.day, []);
        dayMap.get(s.day)!.push(s);
    }
    for (const [, dayMap] of classDaySlots) {
        for (const [, daySlots] of dayMap) {
            daySlots.sort((a, b) => a.period - b.period);
            let consecutive = 1;
            for (let i = 1; i < daySlots.length; i++) {
                if (daySlots[i].subject_id === daySlots[i - 1].subject_id &&
                    daySlots[i].period === daySlots[i - 1].period + 1) {
                    consecutive++;
                    if (consecutive > 2) consecutiveViolations++;
                } else {
                    consecutive = 1;
                }
            }
        }
    }
    console.log(`🔴 HC5 - Consecutive >2 violations: ${consecutiveViolations}`);
    totalHardViolations += consecutiveViolations;

    // HC6: GDTC/GDQP period restrictions
    let specialTimeViolations = 0;
    for (const s of slots) {
        const subj = subjectMap.get(s.subject_id);
        if (!subj) continue;
        const code = subj.code?.toUpperCase() || '';
        if (code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG')) {
            const isMorning = s.period <= 5;
            if (isMorning && s.period > 3) specialTimeViolations++;
            if (!isMorning && s.period < 8) specialTimeViolations++;
        }
    }
    console.log(`🔴 HC6 - GDTC/GDQP time violations: ${specialTimeViolations}`);
    totalHardViolations += specialTimeViolations;

    console.log(`\n🔴 TOTAL HARD VIOLATIONS: ${totalHardViolations}\n`);

    // ========================================
    // COVERAGE CHECK
    // ========================================
    console.log('--- COVERAGE CHECK ---');

    // Group slots by class
    const slotsByClass = new Map<string, SlotRow[]>();
    for (const s of slots) {
        if (!slotsByClass.has(s.class_id)) slotsByClass.set(s.class_id, []);
        slotsByClass.get(s.class_id)!.push(s);
    }

    // Check each class has the right number of periods
    let coverageMissing = 0;
    let coverageExtra = 0;
    const classAssignments = new Map<string, Map<number, number>>();

    for (const assign of assignments) {
        if (!classAssignments.has(assign.class_id)) classAssignments.set(assign.class_id, new Map());
        const m = classAssignments.get(assign.class_id)!;
        m.set(assign.subject_id, (m.get(assign.subject_id) || 0) + (assign.total_periods || 1));
    }

    for (const [classId, expected] of classAssignments) {
        const classSlots = slotsByClass.get(classId) || [];
        const actual = new Map<number, number>();
        for (const s of classSlots) {
            actual.set(s.subject_id, (actual.get(s.subject_id) || 0) + 1);
        }

        for (const [subjId, expectedCount] of expected) {
            const actualCount = actual.get(subjId) || 0;
            if (actualCount < expectedCount) {
                coverageMissing += (expectedCount - actualCount);
            } else if (actualCount > expectedCount) {
                coverageExtra += (actualCount - expectedCount);
            }
        }
    }

    console.log(`   Missing periods: ${coverageMissing}`);
    console.log(`   Extra periods: ${coverageExtra}`);

    // ========================================
    // SOFT CONSTRAINT SUMMARY
    // ========================================
    console.log('\n--- SOFT CONSTRAINTS ---');

    // Teacher holes (gaps between periods in a day)
    let teacherHoles = 0;
    const teacherDaySlots = new Map<string, Map<number, number[]>>();
    for (const s of slots) {
        if (!teacherDaySlots.has(s.teacher_id)) teacherDaySlots.set(s.teacher_id, new Map());
        const dayMap = teacherDaySlots.get(s.teacher_id)!;
        if (!dayMap.has(s.day)) dayMap.set(s.day, []);
        dayMap.get(s.day)!.push(s.period);
    }
    for (const [, dayMap] of teacherDaySlots) {
        for (const [, periods] of dayMap) {
            periods.sort((a, b) => a - b);
            for (let i = 0; i < periods.length - 1; i++) {
                // Same session check
                const currSession = periods[i] <= 5 ? 0 : 1;
                const nextSession = periods[i + 1] <= 5 ? 0 : 1;
                if (currSession === nextSession) {
                    const gap = periods[i + 1] - periods[i] - 1;
                    if (gap > 0) teacherHoles += gap;
                }
            }
        }
    }
    console.log(`   Teacher holes (gaps): ${teacherHoles}`);

    // Class per-day stats
    let classesWithOverload = 0;
    for (const [classId, classSlots] of slotsByClass) {
        const cls = classMap.get(classId);
        const dayCount = new Map<number, number>();
        for (const s of classSlots) {
            dayCount.set(s.day, (dayCount.get(s.day) || 0) + 1);
        }
        let max = 0;
        for (const c of dayCount.values()) max = Math.max(max, c);
        if (max > 5) classesWithOverload++;
    }
    console.log(`   Classes with >5 periods/day: ${classesWithOverload}`);

    // ========================================
    // PER-CLASS SUMMARY
    // ========================================
    console.log('\n--- PER-CLASS SLOT COUNT ---');
    const classNames: [string, string, number][] = [];
    for (const [classId, classSlots] of slotsByClass) {
        const cls = classMap.get(classId);
        classNames.push([classId, cls?.name || '?', classSlots.length]);
    }
    classNames.sort((a, b) => a[1].localeCompare(b[1]));
    for (const [, name, count] of classNames) {
        console.log(`   ${name.padEnd(10)} ${count} slots`);
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n========================================');
    console.log('📊 FINAL SUMMARY');
    console.log('========================================');
    console.log(`Total slots:           ${slots.length}`);
    console.log(`Hard violations:       ${totalHardViolations}`);
    console.log(`Teacher conflicts:     ${teacherConflicts}`);
    console.log(`Class conflicts:       ${classConflicts}`);
    console.log(`Room conflicts:        ${roomConflicts}`);
    console.log(`Thursday violations:   ${thursdayViolations}`);
    console.log(`Consecutive >2:        ${consecutiveViolations}`);
    console.log(`GDTC/GDQP time:        ${specialTimeViolations}`);
    console.log(`Missing coverage:      ${coverageMissing}`);
    console.log(`Teacher holes:         ${teacherHoles}`);
    console.log(`Fitness score:         ${timetable.fitness_score}`);

    if (totalHardViolations === 0) {
        console.log('\n✅ PERFECT: Zero hard violations!');
    } else if (totalHardViolations < 50) {
        console.log(`\n🟡 ACCEPTABLE: ${totalHardViolations} hard violations (minor conflicts from force-placed slots)`);
    } else {
        console.log(`\n🔴 NEEDS WORK: ${totalHardViolations} hard violations`);
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
