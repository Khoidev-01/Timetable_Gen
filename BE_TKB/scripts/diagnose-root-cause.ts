import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: semesterId },
        include: {
            teacher: { include: { constraints: true } },
            subject: true,
            class: true,
        },
    });

    console.log('=== ROOT CAUSE ANALYSIS ===\n');

    // ============================================
    // 1. GDTC/GDQP ANALYSIS
    // ============================================
    console.log('--- 1. GDTC/GDQP VIOLATIONS ---');
    const gdtcAssignments = assignments.filter(a => {
        const code = a.subject.code.toUpperCase();
        return code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG');
    });

    const gdtcTeachers = new Map<string, typeof gdtcAssignments>();
    for (const a of gdtcAssignments) {
        const key = a.teacher.code;
        if (!gdtcTeachers.has(key)) gdtcTeachers.set(key, []);
        gdtcTeachers.get(key)!.push(a);
    }

    console.log(`\nGDTC/GDQP assignments: ${gdtcAssignments.length}`);
    console.log(`GDTC/GDQP teachers: ${gdtcTeachers.size}`);

    for (const [teacherCode, tAssignments] of gdtcTeachers) {
        const teacher = tAssignments[0].teacher;
        const totalPeriods = tAssignments.reduce((sum, a) => sum + a.total_periods, 0);
        const busyConstraints = teacher.constraints.filter((c: any) => c.type === 'BUSY');

        // GDTC valid: P1-3 morning or P8-10 afternoon, skip Thursday (day=5)
        const validSlots: string[] = [];
        const busyAtValid: string[] = [];
        for (let day = 2; day <= 7; day++) {
            if (day === 5) continue;
            for (const period of [1, 2, 3, 8, 9, 10]) {
                const session = period <= 5 ? 0 : 1;
                const relPeriod = period <= 5 ? period : period - 5;
                const isBusy = busyConstraints.some((c: any) =>
                    c.day_of_week === day &&
                    c.period === relPeriod &&
                    (c.session === session || c.session === 2)
                );
                if (isBusy) {
                    busyAtValid.push(`T${day}-P${period}`);
                } else {
                    validSlots.push(`T${day}-P${period}`);
                }
            }
        }

        console.log(`\n  GV ${teacherCode} (${teacher.full_name}):`);
        console.log(`    Total GDTC periods to schedule: ${totalPeriods}`);
        console.log(`    Available valid GDTC slots: ${validSlots.length}`);
        console.log(`    Busy at valid GDTC times: ${busyAtValid.length} → ${busyAtValid.join(', ')}`);
        
        if (totalPeriods > validSlots.length) {
            console.log(`    ❌ IMPOSSIBLE: Need ${totalPeriods} slots but only ${validSlots.length} available`);
            console.log(`    → FIX: Reduce GDTC load or free up teacher constraints in Excel`);
        } else {
            console.log(`    ✅ Sufficient capacity (${validSlots.length} available for ${totalPeriods} needed)`);
        }

        for (const a of tAssignments) {
            console.log(`      • ${a.class.name}: ${a.total_periods} tiết ${a.subject.code}`);
        }
    }

    // ============================================
    // 2. MISSING PERIODS - TEACHER CAPACITY
    // ============================================
    console.log('\n\n--- 2. TEACHER CAPACITY ANALYSIS ---');

    // Calculate per-teacher load
    const teacherLoads = new Map<string, { 
        code: string; name: string; total: number; 
        busyCount: number; maxPossible: number; 
        classes: string[] 
    }>();

    for (const a of assignments) {
        if (!teacherLoads.has(a.teacher_id)) {
            const busyCount = a.teacher.constraints.filter((c: any) => c.type === 'BUSY').length;
            // Max possible slots: 5 days × 10 periods - Thu restricted (6) - Mon P1 (1) = 43
            // But each busy constraint removes 1 slot
            const maxPossible = 43 - busyCount;
            teacherLoads.set(a.teacher_id, {
                code: a.teacher.code,
                name: a.teacher.full_name,
                total: 0,
                busyCount,
                maxPossible,
                classes: [],
            });
        }
        const t = teacherLoads.get(a.teacher_id)!;
        t.total += a.total_periods;
        t.classes.push(`${a.class.name}:${a.subject.code}×${a.total_periods}`);
    }

    // Find overloaded teachers
    const overloaded = [...teacherLoads.values()]
        .filter(t => t.total > t.maxPossible * 0.85)
        .sort((a, b) => (b.total / b.maxPossible) - (a.total / a.maxPossible));

    if (overloaded.length === 0) {
        console.log('✅ No overloaded teachers found');
    } else {
        for (const t of overloaded) {
            const pct = (t.total / t.maxPossible * 100).toFixed(0);
            const status = t.total > t.maxPossible ? '❌ IMPOSSIBLE' : '⚠️ NEAR LIMIT';
            console.log(`\n  ${status} ${t.code} (${t.name}): ${t.total}/${t.maxPossible} slots (${pct}%)`);
            console.log(`    Busy constraints: ${t.busyCount}`);
            console.log(`    Assignments: ${t.classes.join(', ')}`);
        }
    }

    // ============================================
    // 3. PER-CLASS MISSING ANALYSIS
    // ============================================
    console.log('\n\n--- 3. PER-CLASS MISSING PERIODS ---');

    const latestTkb = await prisma.generatedTimetable.findFirst({
        where: { semester_id: semesterId },
        orderBy: { created_at: 'desc' },
        include: { slots: true },
    });

    if (!latestTkb) {
        console.log('No timetable found!');
        return;
    }

    // Group assignments by class
    const classAsgn = new Map<string, typeof assignments>();
    for (const a of assignments) {
        if (!classAsgn.has(a.class_id)) classAsgn.set(a.class_id, []);
        classAsgn.get(a.class_id)!.push(a);
    }

    // Count placed slots per class per subject
    const placedMap = new Map<string, Map<number, number>>();
    for (const slot of latestTkb.slots) {
        if (!placedMap.has(slot.class_id)) placedMap.set(slot.class_id, new Map());
        const m = placedMap.get(slot.class_id)!;
        m.set(slot.subject_id, (m.get(slot.subject_id) || 0) + 1);
    }

    let totalMissing = 0;
    const missingByTeacher = new Map<string, number>();

    for (const [classId, asgns] of classAsgn) {
        const className = asgns[0].class.name;
        const placed = placedMap.get(classId) || new Map();
        const missingSubjects: string[] = [];

        for (const a of asgns) {
            const p = placed.get(a.subject_id) || 0;
            const diff = a.total_periods - p;
            if (diff > 0) {
                missingSubjects.push(`${a.subject.code}(${p}/${a.total_periods}, GV:${a.teacher.code})`);
                totalMissing += diff;
                missingByTeacher.set(a.teacher.code, (missingByTeacher.get(a.teacher.code) || 0) + diff);
            }
        }

        if (missingSubjects.length > 0) {
            console.log(`  ${className}: ${missingSubjects.join(', ')}`);
        }
    }

    console.log(`\n  Total missing: ${totalMissing} periods`);
    console.log(`\n  Missing by teacher:`);
    const sortedMissing = [...missingByTeacher.entries()].sort((a, b) => b[1] - a[1]);
    for (const [teacher, count] of sortedMissing) {
        const load = [...teacherLoads.values()].find(t => t.code === teacher);
        console.log(`    ${teacher}: ${count} missing (load: ${load?.total}/${load?.maxPossible})`);
    }

    // ============================================
    // CONCLUSION
    // ============================================
    console.log('\n\n=== CONCLUSION ===');
    const impossibleTeachers = overloaded.filter(t => t.total > t.maxPossible);
    if (impossibleTeachers.length > 0) {
        console.log('❌ ROOT CAUSE: DATA — The following teachers have more periods assigned than available slots:');
        for (const t of impossibleTeachers) {
            console.log(`   ${t.code}: ${t.total} periods but only ${t.maxPossible} available slots`);
        }
        console.log('\n→ FIX: Edit Excel file to reduce teacher load or remove busy constraints');
    } else if (totalMissing > 0) {
        console.log(`⚠️ ${totalMissing} periods missing despite sufficient teacher capacity`);
        console.log('→ This may be ALGORITHM limitation (cross-class conflicts) or DATA (tight scheduling)');
    } else {
        console.log('✅ All periods placed successfully!');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
