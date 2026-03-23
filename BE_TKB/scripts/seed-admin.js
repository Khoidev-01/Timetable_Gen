const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const hash = await bcrypt.hash('123456', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      password_hash: hash,
      role: 'ADMIN',
    },
  });
  console.log('Admin user created (admin / 123456)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
