/**
 * Tao tai khoan dang nhap cho tung giao vien va noi voi ho so cua ho.
 *
 * Khong noi tai khoan voi ho so thi giao vien dang nhap vao khong dung duoc gi: xem lich ca
 * nhan, dang ky lich ban, doi tiet deu doi `teacher_profile_id`, va deu tra ve "Tai khoan
 * cua ban chua lien ket voi ho so giao vien".
 *
 * Di qua dung UsersService cua he thong chu khong ghi thang vao bang, de mat khau duoc bam
 * dung cach ma luong dang nhap that doc duoc.
 *
 * Moi nguoi mot mat khau rieng, sinh ngau nhien. Dat chung mot mat khau cho ca truong thi
 * nguoi dau tien biet no doc duoc lich cua tat ca nhung nguoi con lai.
 *
 * Chay kem --apply moi ghi; khong co thi chi in ra xem truoc.
 */
import '../src/load-env';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

/** Bo ky tu de doc nham da duoc loai: 0 O o 1 l I. */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function newPassword(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const users = app.get(UsersService);

  const teachers = await prisma.teacher.findMany({
    where: { user: null },
    select: { id: true, code: true, full_name: true },
    orderBy: { code: 'asc' },
  });

  const taken = new Set(
    (await prisma.user.findMany({ select: { username: true } })).map((u) => u.username.toLowerCase()),
  );

  console.log(`${teachers.length} giao vien chua co tai khoan.`);
  if (teachers.length === 0) {
    process.exit(0);
  }

  const created: Array<{ code: string; name: string; username: string; password: string }> = [];

  for (const teacher of teachers) {
    let username = teacher.code.toLowerCase();
    let suffix = 2;
    while (taken.has(username)) username = `${teacher.code.toLowerCase()}${suffix++}`;
    taken.add(username);

    const password = newPassword();
    created.push({ code: teacher.code, name: teacher.full_name, username, password });

    if (!apply) continue;
    await users.create({
      username,
      password,
      role: 'TEACHER',
      teacher_profile_id: teacher.id,
    });
  }

  if (!apply) {
    console.log('\nXem truoc — nam dong dau:');
    created.slice(0, 5).forEach((c) => console.log(`  ${c.username}  ${c.name}`));
    console.log('\nThem --apply de tao that.');
    process.exit(0);
  }

  // Mat khau ghi ra file rieng, da duoc chan trong .gitignore. In het ra man hinh thi chung
  // nam lai trong lich su terminal va trong ban ghi cua bat ky cong cu nao dang doc no.
  const target = path.join(__dirname, '..', '..', 'tai-khoan-giao-vien.csv');
  const rows = ['ma_gv,ho_ten,tai_khoan,mat_khau'];
  created.forEach((c) => rows.push(`${c.code},"${c.name}",${c.username},${c.password}`));
  fs.writeFileSync(target, rows.join('\n') + '\n', 'utf8');

  const linked = await prisma.teacher.count({ where: { user: { isNot: null } } });
  console.log(`Da tao ${created.length} tai khoan. Tong giao vien da co tai khoan: ${linked}/${await prisma.teacher.count()}.`);
  console.log(`Danh sach mat khau: ${target}`);
  console.log('File nay da duoc chan trong .gitignore — dung commit, va xoa sau khi phat xong.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
