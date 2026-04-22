import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const [rooms, classes] = await Promise.all([
        prisma.room.findMany(),
        prisma.class.findMany({ include: { fixed_room: true } })
    ]);

    console.log(`Total Rooms: ${rooms.length}`);
    
    const grade12 = classes.filter(c => c.name.startsWith('12'));
    console.log(`Total Grade 12 Classes: ${grade12.length}`);

    for (const c of grade12) {
        console.log(`  - ${c.name}: Room ${c.fixed_room?.name || 'NONE'}`);
    }

    const roomsWithFixedClasses = classes.filter(c => c.fixed_room_id).map(c => c.fixed_room_id);
    const uniqueFixedRooms = new Set(roomsWithFixedClasses);
    
    console.log(`\nUnique Fixed Rooms assigned: ${uniqueFixedRooms.size}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
