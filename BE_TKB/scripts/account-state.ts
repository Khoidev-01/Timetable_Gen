import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, teacher_profile_id: true },
    orderBy: { username: 'asc' },
  });
  console.log(`Tong ${users.length} tai khoan:`);
  users.forEach((u) => console.log(`  ${u.username} (${u.role}) ho so=${u.teacher_profile_id ?? 'KHONG'}`));
  console.log(`\nGiao vien: ${await prisma.teacher.count()}, trong do co tai khoan: ${await prisma.teacher.count({ where: { user: { isNot: null } } })}`);
  await prisma.$disconnect();
})();
