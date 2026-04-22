import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });
    console.log('Class | main_session | Grade-based isMorning');
    for (const c of classes) {
        const grade = parseInt(c.name.match(/\d+/)?.[0] || '0');
        const gradeIsMorning = [12, 10].includes(grade);
        const sessionIsMorning = (c as any).main_session === 0;
        const match = gradeIsMorning === sessionIsMorning ? '✅' : '❌ MISMATCH';
        console.log(`  ${c.name.padEnd(10)} session=${(c as any).main_session}  grade_morning=${gradeIsMorning}  session_morning=${sessionIsMorning}  ${match}`);
    }
    await prisma.$disconnect();
}
main();
