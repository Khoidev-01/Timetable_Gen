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
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding System Data (English Schema)...');
    const year = await prisma.academicYear.create({
        data: {
            name: '2023-2024',
            start_date: new Date('2023-09-05'),
            end_date: new Date('2024-05-31'),
            status: 'ACTIVE',
            semesters: {
                create: [
                    { name: 'Học kỳ 1', is_current: false },
                    { name: 'Học kỳ 2', is_current: true },
                ]
            }
        },
        include: { semesters: true }
    });
    console.log(`Created Year: ${year.name}`);
    const semesterId = year.semesters.find(s => s.is_current)?.id;
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
        data: {
            username: 'admin',
            password_hash: hashedPassword,
            role: 'ADMIN'
        }
    });
    console.log('Created Admin: admin / admin123');
    await prisma.room.createMany({
        data: [
            { name: '101', floor: 1, type: 'CLASSROOM' },
            { name: '102', floor: 1, type: 'CLASSROOM' },
            { name: '201', floor: 2, type: 'CLASSROOM' },
            { name: 'PC1', floor: 3, type: 'LAB_IT' },
            { name: 'Lab Ly', floor: 3, type: 'LAB_PHYSICS' }
        ]
    });
    console.log('Created sample rooms');
    await prisma.subject.createMany({
        data: [
            { code: 'TOAN', name: 'Toán', color: '#FF0000' },
            { code: 'VAN', name: 'Ngữ Văn', color: '#00FF00' },
            { code: 'ANH', name: 'Tiếng Anh', color: '#0000FF' },
            { code: 'TIN', name: 'Tin Học', color: '#FFFF00', is_special: false }
        ]
    });
    console.log('Created sample subjects');
    console.log('Seeding Complete.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed_system.js.map