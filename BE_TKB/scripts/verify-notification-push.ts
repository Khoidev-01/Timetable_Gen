/**
 * Mo ket noi WebSocket that bang token that, roi tao mot thong bao va do xem no toi noi
 * trong bao lau. Kem hai phep thu quan trong hon toc do: token hong bi ngat, va nguoi khac
 * khong nhan duoc thong bao cua minh.
 */
import '../src/load-env';
import { io, Socket } from 'socket.io-client';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationService } from '../src/notifications/notification.service';

const PORT = 4132;
const BASE = `http://127.0.0.1:${PORT}`;

/** Cho mot su kien, hoac chiu thua sau ngan ay mili giay. */
function waitFor(socket: Socket, event: string, ms: number): Promise<any | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const connect = (token: string) =>
  io(`${BASE}/notifications`, { transports: ['websocket'], auth: { token }, forceNew: true });

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(PORT);

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const notifications = app.get(NotificationService);

  const [alice, bob] = await prisma.user.findMany({ where: { role: 'TEACHER' }, take: 2 });
  const sign = (u: any) => jwt.sign({ sub: u.id, username: u.username, role: u.role });

  const created: string[] = [];

  try {
    const aliceSocket = connect(sign(alice));
    const bobSocket = connect(sign(bob));
    await Promise.all([waitFor(aliceSocket, 'connect', 5000), waitFor(bobSocket, 'connect', 5000)]);
    console.log(`1. Hai giao vien da noi: ${alice.username} = ${aliceSocket.connected}, ${bob.username} = ${bobSocket.connected}`);

    // Thong bao gui cho alice
    const incoming = waitFor(aliceSocket, 'notification', 5000);
    const leaked = waitFor(bobSocket, 'notification', 2000);

    const started = Date.now();
    const row = await notifications.create({
      userId: alice.id,
      category: 'SWAP_REQUEST',
      title: 'Thu day thong bao',
      message: 'Kiem tra duong WebSocket',
    });
    created.push(row.id);

    const received: any = await incoming;
    console.log(`2. ${alice.username} nhan duoc sau ${Date.now() - started}ms: ${received ? `"${received.title}"` : 'KHONG NHAN DUOC'}`);
    console.log(`3. ${bob.username} co nhan nham khong: ${(await leaked) ? 'CO — LO THONG TIN' : 'khong'}`);

    // Token hong thi phai bi ngat
    const intruder = connect('token-bia-dat');
    const denied = await waitFor(intruder, 'disconnect', 5000);
    console.log(`4. Token bia dat: ${denied !== null || !intruder.connected ? 'bi ngat' : 'VAN KET NOI DUOC'}`);
    intruder.close();

    aliceSocket.close();
    bobSocket.close();
  } finally {
    if (created.length) await prisma.notification.deleteMany({ where: { id: { in: created } } });
    console.log('   Da xoa thong bao thu nghiem.');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
