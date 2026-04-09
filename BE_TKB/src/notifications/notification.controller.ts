import { Controller, Get, Put, Param, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getAll(@Req() req: any) {
    const user = req.user ?? {};
    const userId = user.sub ?? user.id ?? '';
    const role = user.role ?? 'ADMIN';
    return this.notificationService.findForUser(userId, role);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const user = req.user ?? {};
    const userId = user.sub ?? user.id ?? '';
    const role = user.role ?? 'ADMIN';
    const count = await this.notificationService.countUnread(userId, role);
    return { count };
  }

  // IMPORTANT: This route MUST come before :id/read to avoid NestJS matching "read-all" as :id
  @Put('read-all')
  async markAllAsRead(@Req() req: any) {
    const user = req.user ?? {};
    const userId = user.sub ?? user.id ?? '';
    const role = user.role ?? 'ADMIN';
    await this.notificationService.markAllAsRead(userId, role);
    return { success: true };
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }
}
