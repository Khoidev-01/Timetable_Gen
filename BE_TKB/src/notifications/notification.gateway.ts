import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy';

const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Đẩy thông báo tới đúng người, ngay khi nó vừa được tạo.
 *
 * Trước đây chuông thông báo hỏi lại máy chủ mỗi 30 giây. Với việc đổi tiết thì nửa phút là
 * đủ để đồng nghiệp bỏ lỡ, còn với báo vắng lúc 6h45 thì nửa phút là quá muộn. Ba mươi giây
 * ấy cũng là ba mươi nghìn lượt hỏi vô ích mỗi ngày cho một trường bảy mươi giáo viên, gần
 * như lần nào cũng nhận về đúng một câu "chưa có gì mới".
 *
 * Danh tính lấy từ token trong lúc bắt tay, không bao giờ từ tin nhắn của client. Nếu để
 * client tự khai mình là ai rồi cho vào phòng theo lời khai đó thì bất kỳ ai cũng đọc được
 * thông báo của người khác — và đây là thứ khó phát hiện nhất khi nhìn vào, vì màn hình của
 * chính mình vẫn hiện đúng.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000'], credentials: true },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization ?? '').replace(/^Bearer /, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      client.join(this.userRoom(payload.sub));

      // Thông báo chung (user_id rỗng) chỉ dành cho quản trị viên, đúng như NotificationService đọc
      if (payload.role === 'ADMIN') client.join('broadcast:admin');

      client.data.userId = payload.sub;
    } catch {
      // Token hỏng hoặc hết hạn: ngắt luôn, không để một kết nối vô danh nằm chờ
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Thoát: ${client.data?.userId ?? client.id}`);
  }

  /** Đẩy một thông báo vừa tạo tới người nhận. */
  publish(notification: { user_id: string | null; id: string; title: string; message: string; category: string; created_at: Date }) {
    const room = notification.user_id ? this.userRoom(notification.user_id) : 'broadcast:admin';
    this.server?.to(room).emit('notification', notification);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
