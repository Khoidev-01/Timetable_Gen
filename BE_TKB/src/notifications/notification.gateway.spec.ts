import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';

/**
 * Ai được vào phòng nào, và ai bị đuổi ra.
 *
 * Đây là phần dễ sai mà khó thấy nhất của thông báo realtime: nếu để client tự khai mình là
 * ai rồi cho vào phòng theo lời khai đó, thì bất kỳ ai cũng đọc được thông báo của người
 * khác — mà màn hình của chính họ vẫn hiện đúng, nên nhìn vào không phát hiện được.
 */
function fakeSocket(token?: string) {
  const rooms: string[] = [];
  return {
    id: 'socket-1',
    data: {} as any,
    handshake: { auth: token ? { token } : {}, headers: {} as any },
    rooms,
    join: (room: string) => rooms.push(room),
    disconnect: jest.fn(),
  } as any;
}

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModuleForTest()],
      providers: [NotificationGateway],
    }).compile();

    gateway = module.get(NotificationGateway);
    jwt = module.get(JwtService);
  });

  function JwtModuleForTest() {
    const { JwtModule } = require('@nestjs/jwt');
    return JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
  }

  it('cho giáo viên vào đúng phòng của chính họ, không vào phòng chung', () => {
    const socket = fakeSocket(jwt.sign({ sub: 'u-lan', username: 'colan', role: 'TEACHER' }));

    gateway.handleConnection(socket);

    expect(socket.rooms).toEqual(['user:u-lan']);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('quản trị viên nhận thêm thông báo chung', () => {
    const socket = fakeSocket(jwt.sign({ sub: 'u-admin', username: 'admin', role: 'ADMIN' }));

    gateway.handleConnection(socket);

    expect(socket.rooms).toContain('user:u-admin');
    expect(socket.rooms).toContain('broadcast:admin');
  });

  it('ngắt kết nối khi không có token', () => {
    const socket = fakeSocket();

    gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.rooms).toEqual([]);
  });

  it('ngắt kết nối khi token bịa đặt hoặc ký bằng khóa khác', () => {
    const socket = fakeSocket('khong-phai-mot-token');
    gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);

    const forged = new JwtService({ secret: 'khoa-khac' });
    const other = fakeSocket(forged.sign({ sub: 'u-gia', username: 'gia', role: 'ADMIN' }));
    gateway.handleConnection(other);
    expect(other.disconnect).toHaveBeenCalledWith(true);
    expect(other.rooms).toEqual([]);
  });

  it('đẩy vào phòng của người nhận, thông báo không có người nhận thì về phòng quản trị', () => {
    const sent: Array<{ room: string; payload: any }> = [];
    (gateway as any).server = {
      to: (room: string) => ({ emit: (_: string, payload: any) => sent.push({ room, payload }) }),
    };

    gateway.publish({ user_id: 'u-lan', id: 'n1', title: 'a', message: 'b', category: 'SWAP_REQUEST', created_at: new Date() });
    gateway.publish({ user_id: null, id: 'n2', title: 'c', message: 'd', category: 'IMPORT', created_at: new Date() });

    expect(sent.map((s) => s.room)).toEqual(['user:u-lan', 'broadcast:admin']);
  });
});
