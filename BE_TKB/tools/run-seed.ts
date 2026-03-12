
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding V2.0...');
    try {
        await runSteps();
        console.log('Seeding V2.0 completed successfully.');
    } catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

async function runSteps() {
    // 0. Enable pgcrypto and set defaults
    try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        const tables = ['academic_years', 'semesters', 'users', 'teachers', 'classes', 'teaching_assignments', 'generated_timetables', 'timetable_slots'];
        for (const t of tables) {
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
            } catch (e) { }
        }
        console.log('0. Configured DB defaults.');
    } catch (e) {
        console.log('0. Failed to configure DB defaults:', e);
    }

    const fileContent = fs.readFileSync(path.join(__dirname, '../prisma/seed_custom.sql'), 'utf-8');

    // Helper to get block
    const getBlock = (startMarker: string, endMarker?: string) => {
        const parts = fileContent.split(startMarker);
        if (parts.length < 2) return null;
        const p1 = parts[1];
        if (endMarker) return p1.split(endMarker)[0];
        return p1;
    };

    // 1. CLEANUP
    const step1 = getBlock('-- STEP 1: CLEANUP', '-- STEP 2: YEAR_SEMESTER');
    if (step1) {
        await prisma.$executeRawUnsafe(step1.trim());
        console.log('1. Cleanup executed.');
    }

    // 2. YEAR
    const step2 = getBlock('-- STEP 2: YEAR_SEMESTER', '-- STEP 3: ROOMS');
    if (step2) {
        await prisma.$executeRawUnsafe(step2.trim());
        console.log('2. Year created.');
    }

    // 3. ROOMS
    const step3 = getBlock('-- STEP 3: ROOMS', '-- STEP 4: SUBJECTS');
    if (step3) {
        const stmts = step3.split(';');
        for (const s of stmts) {
            if (s.trim().length > 10) await prisma.$executeRawUnsafe(s);
        }
        console.log('3. Rooms created.');
    }

    // 4. SUBJECTS
    const step4 = getBlock('-- STEP 4: SUBJECTS', '-- STEP 5: TEACHERS');
    if (step4) {
        const stmts = step4.split(';');
        for (const s of stmts) {
            if (s.trim().length > 10) await prisma.$executeRawUnsafe(s);
        }
        console.log('4. Subjects created.');
    }

    // 5. TEACHERS
    const step5 = getBlock('-- STEP 5: TEACHERS', '-- STEP 6: CLASSES');
    if (step5) {
        await prisma.$executeRawUnsafe(step5.trim());
        console.log('5. Teachers created.');
    }

    // 6. CLASSES
    const step6 = getBlock('-- STEP 6: CLASSES', '-- STEP 7: CREATE_FUNC');
    if (step6) {
        await prisma.$executeRawUnsafe(step6.trim());
        console.log('6. Classes created.');
    }

    // 7. CREATE_FUNC
    const step7 = getBlock('-- STEP 7: CREATE_FUNC', '-- STEP 8: EXECUTE_FUNC');
    if (step7) {
        await prisma.$executeRawUnsafe(step7.trim());
        console.log('7. Assignments Helper created.');
    }

    // 8. EXECUTE_FUNC
    const step8 = getBlock('-- STEP 8: EXECUTE_FUNC', '-- STEP 9: CLEANUP_FUNC');
    if (step8) {
        await prisma.$executeRawUnsafe(step8.trim());
        console.log('8. Assignments executed.');
    }

    // 9. CLEANUP
    const step9 = getBlock('-- STEP 9: CLEANUP_FUNC', '-- STEP 10: USERS');
    if (step9) {
        await prisma.$executeRawUnsafe(step9.trim());
        console.log('9. Assignments Helper dropped.');
    }

    // 10. USERS
    const step10 = getBlock('-- STEP 10: USERS');
    if (step10) {
        await prisma.$executeRawUnsafe(step10.trim());
        console.log('10. Users created.');
    }
}

main();
