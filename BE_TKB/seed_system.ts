
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding System Data (English Schema)...');

    // 1. Create Academic Year
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

    // 2. Create Admin Account
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
        data: {
            username: 'admin',
            password_hash: hashedPassword,
            role: 'ADMIN'
        }
    });
    console.log('Created Admin: admin / admin123');

    // 3. Seed Rooms (Basic)
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

    // 4. Seed Subjects (Basic)
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
