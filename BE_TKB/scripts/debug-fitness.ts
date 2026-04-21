import { PrismaClient } from '@prisma/client';
import { ConstraintService } from '../src/algorithm/constraint.service';
import { Logger } from '@nestjs/common';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    
    // Get latest timetable
    const latestTimetable = await prisma.generatedTimetable.findFirst({
        orderBy: { created_at: 'desc' },
        include: {
            slots: true
        }
    });

    if (!latestTimetable) {
        console.log('No timetable found in the database.');
        return;
    }

    console.log(`\n==========================================`);
    console.log(`Analyzing Timetable: ${latestTimetable.name}`);
    console.log(`Saved Fitness Score: ${latestTimetable.fitness_score}`);
    console.log(`Total Slots: ${latestTimetable.slots.length}`);
    console.log(`==========================================\n`);

    // Initialize ConstraintService
    const constraintService = new ConstraintService(prisma as any);
    await constraintService.initialize(latestTimetable.semester_id);

    // Evaluate
    console.log('Evaluating constraints...');
    const mappedSlots = latestTimetable.slots.map(s => ({
        id: s.id,
        day: s.day,
        period: s.period,
        classId: s.class_id,
        subjectId: s.subject_id,
        teacherId: s.teacher_id,
        roomId: s.room_id || undefined,
        isLocked: s.is_locked
    }));
    const details = constraintService.getFitnessDetails(mappedSlots);

    console.log(`\n=== FITNESS EVALUATION RESULT ===`);
    console.log(`Final Score: ${details.score}`);
    console.log(`Hard Violations: ${details.hardViolations}`);
    console.log(`Soft Penalty: ${details.softPenalty}`);
    console.log(`\n=== DETAILS ===`);
    details.details.forEach((d: string) => console.log(`- ${d}`));

    // Additional debug for Hard Violations (Teacher Conflicts)
    if (details.hardViolations > 0) {
        console.log(`\n=== DEEP DIVE: TEACHER CONFLICTS ===`);
        const teacherGroups = new Map<string, any[]>();
        latestTimetable.slots.forEach(s => {
            const k = s.teacher_id;
            if (!teacherGroups.has(k)) teacherGroups.set(k, []);
            teacherGroups.get(k)!.push(s);
        });

        let printedConflicts = 0;
        for (const [tId, slots] of teacherGroups) {
            const timeMap = new Map<string, any[]>();
            slots.forEach(s => {
                const key = `Day ${s.day} - Period ${s.period}`;
                if (!timeMap.has(key)) timeMap.set(key, []);
                timeMap.get(key)!.push(s);
            });

            for (const [timeKey, overlappingSlots] of timeMap) {
                if (overlappingSlots.length > 1 && printedConflicts < 10) {
                    const teacher = await prisma.teacher.findUnique({ where: { id: tId }});
                    console.log(`⚠️ Teacher ${teacher?.code} (${teacher?.full_name}) has ${overlappingSlots.length} classes at ${timeKey}:`);
                    for (const s of overlappingSlots) {
                        const cls = await prisma.class.findUnique({ where: { id: s.class_id }});
                        const subj = await prisma.subject.findUnique({ where: { id: s.subject_id }});
                        console.log(`   -> Class ${cls?.name} | Subject: ${subj?.code}`);
                    }
                    printedConflicts++;
                }
            }
        }
        if (printedConflicts >= 10) {
            console.log(`... and more conflicts (only showing first 10).`);
        }
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
