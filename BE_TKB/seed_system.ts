import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding system data...');

    const year = await prisma.academicYear.create({
        data: {
            name: '2023-2024',
            start_date: new Date('2023-09-05'),
            end_date: new Date('2024-05-31'),
            status: 'ACTIVE',
            semesters: {
                create: [
                    { name: 'Học kỳ 1', is_current: false, term_order: 1 },
                    { name: 'Học kỳ 2', is_current: true, term_order: 2 },
                ],
            },
        },
        include: { semesters: true },
    });

    console.log(`Created year: ${year.name}`);

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
        data: {
            username: 'admin',
            password_hash: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log('Created admin: admin / admin123');

    await prisma.room.createMany({
        data: [
            { name: '101', floor: 1, type: 'CLASSROOM' },
            { name: '102', floor: 1, type: 'CLASSROOM' },
            { name: '201', floor: 2, type: 'CLASSROOM' },
            { name: 'PC1', floor: 3, type: 'LAB_IT' },
            { name: 'Lab Ly', floor: 3, type: 'LAB_PHYSICS' },
        ],
    });
    console.log('Created sample rooms');

    await prisma.subject.createMany({
        data: [
            { code: 'TOAN', name: 'Toán', color: '#FF0000' },
            { code: 'VAN', name: 'Ngữ văn', color: '#00FF00' },
            { code: 'ANH', name: 'Tiếng Anh', color: '#0000FF' },
            { code: 'TIN', name: 'Tin học', color: '#FFFF00', is_special: false },
        ],
        skipDuplicates: true,
    });
    console.log('Created sample subjects');

    console.log('Seeding complete.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
