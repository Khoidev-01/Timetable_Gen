import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
    });
    const slots = await prisma.timetableSlot.findMany({ where: { timetable_id: timetable!.id } }) as any[];

    // Check: How many (class,day,period) duplicates exist in the schedule?
    const timeMap = new Map<string, number>();
    for (const s of slots) {
        const key = `${s.class_id}-${s.day}-${s.period}`;
        timeMap.set(key, (timeMap.get(key) || 0) + 1);
    }
    let dupes = 0;
    for (const [, count] of timeMap) {
        if (count > 1) dupes += count - 1;
    }
    console.log(`DB duplicates (class,day,period): ${dupes}`);
    console.log(`Total DB slots: ${slots.length}`);
    
    // The real question: how many slots SHOULD have been saved?
    // Algorithm log says "Saving 951 slots" but "Inserted 804"
    // That means 951-804=147 slots were dropped by skipDuplicates!
    console.log(`\nAlgorithm produced 951 slots (from log)`);
    console.log(`DB inserted 804 slots (from log)`);
    console.log(`Dropped by skipDuplicates: ${951 - 804} = 147 slots`);
    
    console.log(`\n=== ROOT CAUSE ===`);
    console.log(`forcePlaceFallback() places activities at slots that already`);
    console.log(`have the same class at that time → creates duplicates.`);
    console.log(`DB unique constraint drops them → 147 lost periods.`);

    // Count slots per class to see the capacity
    console.log(`\n=== CLASS CAPACITY ===`);
    const classes = await prisma.class.findMany();
    const classMap = new Map(classes.map(c => [c.id, c]));
    
    for (const cls of classes.sort((a, b) => a.name.localeCompare(b.name))) {
        const classSlots = slots.filter(s => s.class_id === cls.id);
        const isMorning = (cls as any).main_session === 0;
        // Max available = 6 days × 5 periods minus Thursday restrictions(3 periods) minus Monday P1
        // Morning: Mon P2-5(4) + Tue-Wed(5+5) + Thu P1-2(2) + Fri-Sat(5+5) = 26
        // Afternoon: Mon P6-10(5) + Tue-Wed(5+5) + Thu P6-7(2) + Fri-Sat(5+5) = 27
        const maxSlots = isMorning ? 26 : 27;
        console.log(`  ${cls.name.padEnd(8)} ${classSlots.length}/${maxSlots} slots (${isMorning ? 'morning' : 'afternoon'})`);
    }

    await prisma.$disconnect();
}
main();
