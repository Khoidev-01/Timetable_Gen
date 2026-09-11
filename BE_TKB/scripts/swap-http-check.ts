/**
 * Drives the swap routes over real HTTP against the real database.
 *
 * Unit tests answer "does the logic hold under my mocks"; this answers "does the endpoint a
 * browser calls return what the screen renders, to the person entitled to see it".
 *
 * No teacher account in this database is linked to a teacher profile, so the two teacher
 * accounts below are created for the run and deleted at the end - along with the request
 * itself. The trade is cancelled rather than approved: a check must not move a real period.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = 4123;
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const temporaryUserIds: string[] = [];
  let createdRequestId: string | undefined;

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) throw new Error('Khong co tai khoan quan tri vien trong CSDL.');

    const timetable = await prisma.generatedTimetable.findFirst({
      where: { is_official: true },
      orderBy: { created_at: 'desc' },
    });
    if (!timetable) throw new Error('Khong co thoi khoa bieu chinh thuc.');

    const slots = await prisma.timetableSlot.findMany({
      where: { timetable_id: timetable.id, is_locked: false },
    });
    const mine = slots[0];

    const sign = (user: { id: string; username: string; role: string }) =>
      jwt.sign({ sub: user.id, username: user.username, role: user.role });

    const adminToken = sign(admin as any);
    const call = (path: string, init: RequestInit = {}, bearer = adminToken) =>
      fetch(`${BASE}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}`, ...(init.headers ?? {}) },
      });

    const linkAccount = async (teacherId: string, username: string) => {
      const user = await prisma.user.create({
        data: { username, password_hash: 'x', role: 'TEACHER', teacher_profile_id: teacherId },
      });
      temporaryUserIds.push(user.id);
      return sign(user as any);
    };

    // 1. Suggestions for a real period
    const suggestions = await (await call(`/doi-tiet/goi-y/${mine.id}`)).json();
    console.log(`1. GET goi-y -> ${suggestions.length} phuong an`);
    const partner = suggestions[0];

    const requesterToken = await linkAccount(mine.teacher_id, 'kiem-tra-nguoi-gui');
    const partnerToken = await linkAccount(partner.teacherId, 'kiem-tra-dong-nghiep');
    const outsiderTeacher = await prisma.teacher.findFirst({
      where: { id: { notIn: [mine.teacher_id, partner.teacherId] } },
    });
    const outsiderToken = await linkAccount(outsiderTeacher!.id, 'kiem-tra-nguoi-ngoai');

    // 2. The teacher sends it themselves, through the token, not a body field
    const createRes = await call(
      '/doi-tiet',
      { method: 'POST', body: JSON.stringify({ requesterSlotId: mine.id, partnerSlotId: partner.slotId, reason: 'Kiem tra duong HTTP that' }) },
      requesterToken,
    );
    const created = await createRes.json();
    createdRequestId = created.id;
    console.log(`2. POST /doi-tiet -> ${createRes.status}, trang thai=${created.status}`);

    // 3. The list the screen renders
    const list = await (await call(`/doi-tiet?semesterId=${timetable.semester_id}`)).json();
    const row = list.find((r: any) => r.id === created.id);
    console.log(`3. GET /doi-tiet (quan tri vien) -> ${list.length} yeu cau`);
    console.log(`   Tiet nguoi gui  : ${row?.requester_slot?.when} - ${row?.requester_slot?.subjectName} ${row?.requester_slot?.className}`);
    console.log(`   Tiet dong nghiep: ${row?.partner_slot?.when} - ${row?.partner_slot?.subjectName} ${row?.partner_slot?.className}`);

    // 4. Who can see it
    const seenBy = async (token: string) => {
      const rows = await (await call(`/doi-tiet?semesterId=${timetable.semester_id}`, {}, token)).json();
      return rows.some((r: any) => r.id === created.id);
    };
    console.log(`4. Nguoi gui thay   : ${await seenBy(requesterToken)} (phai true)`);
    console.log(`   Dong nghiep thay : ${await seenBy(partnerToken)} (phai true)`);
    console.log(`   Nguoi ngoai thay : ${await seenBy(outsiderToken)} (phai false)`);

    // 5. Who can act on it
    const outsiderAnswer = await call(`/doi-tiet/${created.id}/tra-loi`, { method: 'PATCH', body: JSON.stringify({ accept: true }) }, outsiderToken);
    console.log(`5. Nguoi ngoai tra loi -> ${outsiderAnswer.status}: ${(await outsiderAnswer.json()).message}`);
    const selfApprove = await call(`/doi-tiet/${created.id}/duyet`, { method: 'PATCH', body: JSON.stringify({ approve: true }) }, requesterToken);
    console.log(`   Nguoi gui tu duyet -> ${selfApprove.status}: ${(await selfApprove.json()).message}`);

    // 6. The colleague agrees, which moves it to the admin and not into the timetable
    const answered = await (await call(`/doi-tiet/${created.id}/tra-loi`, { method: 'PATCH', body: JSON.stringify({ accept: true, note: 'Dong y' }) }, partnerToken)).json();
    const stillThere = await prisma.timetableSlot.findUnique({ where: { id: mine.id } });
    console.log(`6. Dong nghiep dong y -> ${answered.status}; tiet van o ${stillThere!.day}/${stillThere!.period} (chua doi)`);

    // 7. Undo: cancelled, not approved
    const cancelled = await (await call(`/doi-tiet/${created.id}/rut-lai`, { method: 'PATCH' })).json();
    console.log(`7. Rut lai -> ${cancelled.status}`);
  } finally {
    if (createdRequestId) await prisma.swapRequest.deleteMany({ where: { id: createdRequestId } });
    await prisma.notification.deleteMany({ where: { user_id: { in: temporaryUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: temporaryUserIds } } });
    console.log('   Da xoa tai khoan va yeu cau thu nghiem.');
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
