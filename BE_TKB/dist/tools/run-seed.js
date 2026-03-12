"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Start seeding V2.0...');
    try {
        await runSteps();
        console.log('Seeding V2.0 completed successfully.');
    }
    catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
async function runSteps() {
    try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        const tables = ['academic_years', 'semesters', 'users', 'teachers', 'classes', 'teaching_assignments', 'generated_timetables', 'timetable_slots'];
        for (const t of tables) {
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
            }
            catch (e) { }
        }
        console.log('0. Configured DB defaults.');
    }
    catch (e) {
        console.log('0. Failed to configure DB defaults:', e);
    }
    const fileContent = fs.readFileSync(path.join(__dirname, '../prisma/seed_custom.sql'), 'utf-8');
    const getBlock = (startMarker, endMarker) => {
        const parts = fileContent.split(startMarker);
        if (parts.length < 2)
            return null;
        const p1 = parts[1];
        if (endMarker)
            return p1.split(endMarker)[0];
        return p1;
    };
    const step1 = getBlock('-- STEP 1: CLEANUP', '-- STEP 2: YEAR_SEMESTER');
    if (step1) {
        await prisma.$executeRawUnsafe(step1.trim());
        console.log('1. Cleanup executed.');
    }
    const step2 = getBlock('-- STEP 2: YEAR_SEMESTER', '-- STEP 3: ROOMS');
    if (step2) {
        await prisma.$executeRawUnsafe(step2.trim());
        console.log('2. Year created.');
    }
    const step3 = getBlock('-- STEP 3: ROOMS', '-- STEP 4: SUBJECTS');
    if (step3) {
        const stmts = step3.split(';');
        for (const s of stmts) {
            if (s.trim().length > 10)
                await prisma.$executeRawUnsafe(s);
        }
        console.log('3. Rooms created.');
    }
    const step4 = getBlock('-- STEP 4: SUBJECTS', '-- STEP 5: TEACHERS');
    if (step4) {
        const stmts = step4.split(';');
        for (const s of stmts) {
            if (s.trim().length > 10)
                await prisma.$executeRawUnsafe(s);
        }
        console.log('4. Subjects created.');
    }
    const step5 = getBlock('-- STEP 5: TEACHERS', '-- STEP 6: CLASSES');
    if (step5) {
        await prisma.$executeRawUnsafe(step5.trim());
        console.log('5. Teachers created.');
    }
    const step6 = getBlock('-- STEP 6: CLASSES', '-- STEP 7: CREATE_FUNC');
    if (step6) {
        await prisma.$executeRawUnsafe(step6.trim());
        console.log('6. Classes created.');
    }
    const step7 = getBlock('-- STEP 7: CREATE_FUNC', '-- STEP 8: EXECUTE_FUNC');
    if (step7) {
        await prisma.$executeRawUnsafe(step7.trim());
        console.log('7. Assignments Helper created.');
    }
    const step8 = getBlock('-- STEP 8: EXECUTE_FUNC', '-- STEP 9: CLEANUP_FUNC');
    if (step8) {
        await prisma.$executeRawUnsafe(step8.trim());
        console.log('8. Assignments executed.');
    }
    const step9 = getBlock('-- STEP 9: CLEANUP_FUNC', '-- STEP 10: USERS');
    if (step9) {
        await prisma.$executeRawUnsafe(step9.trim());
        console.log('9. Assignments Helper dropped.');
    }
    const step10 = getBlock('-- STEP 10: USERS');
    if (step10) {
        await prisma.$executeRawUnsafe(step10.trim());
        console.log('10. Users created.');
    }
}
main();
//# sourceMappingURL=run-seed.js.map