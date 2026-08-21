import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCategory } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /** Get notifications for a user (admins also get broadcast ones where user_id is null) */
  async findForUser(userId: string, role: string) {
    const where =
      role === 'ADMIN'
        ? { OR: [{ user_id: userId }, { user_id: null }] }
        : { user_id: userId };

    return this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  /** Count unread for a user */
  async countUnread(userId: string, role: string) {
    const where =
      role === 'ADMIN'
        ? { is_read: false, OR: [{ user_id: userId }, { user_id: null }] }
        : { is_read: false, user_id: userId };

    return this.prisma.notification.count({ where });
  }

  /** Mark one as read */
  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });
  }

  /** Mark all as read for a user */
  async markAllAsRead(userId: string, role: string) {
    const where =
      role === 'ADMIN'
        ? { is_read: false, OR: [{ user_id: userId }, { user_id: null }] }
        : { is_read: false, user_id: userId };

    return this.prisma.notification.updateMany({
      where,
      data: { is_read: true },
    });
  }

  /** Create a notification (broadcast to admins if user_id is null) */
  async create(data: {
    userId?: string | null;
    category: NotificationCategory;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        user_id: data.userId ?? null,
        category: data.category,
        title: data.title,
        message: data.message,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  // ---- Convenience helpers for common events ----

  async notifyImportSuccess(summary: any) {
    return this.create({
      category: 'IMPORT',
      title: 'Import Excel thành công',
      message: `Đã nhập ${summary.teachers?.created ?? 0} GV, ${summary.classes?.created ?? 0} lớp, ${summary.assignments?.created ?? 0} phân công.`,
      metadata: summary,
    });
  }

  async notifyImportFailed(errorCount: number) {
    return this.create({
      category: 'IMPORT',
      title: 'Import Excel thất bại',
      message: `File Excel có ${errorCount} lỗi validation. Vui lòng kiểm tra và thử lại.`,
    });
  }

  async notifyTimetableComplete(semesterName: string, fitness: number) {
    return this.create({
      category: 'TIMETABLE',
      title: 'Xếp TKB hoàn tất',
      message: `Đã tạo thời khóa biểu ${semesterName} — Fitness: ${fitness.toFixed(1)}`,
      metadata: { semesterName, fitness },
    });
  }

  async notifyTimetableFailed(semesterName: string, reason: string) {
    return this.create({
      category: 'TIMETABLE',
      title: 'Xếp TKB thất bại',
      message: `Không thể tạo TKB cho ${semesterName}: ${reason}`,
    });
  }

  async notifyBusyScheduleUpdate(teacherName: string, teacherCode: string, slotCount: number) {
    return this.create({
      category: 'BUSY_SCHEDULE',
      title: 'GV đăng ký lịch bận',
      message: `${teacherName} (${teacherCode}) đã đăng ký ${slotCount} tiết bận.`,
      metadata: { teacherName, teacherCode, slotCount },
    });
  }

  async notifyTeacherFeedback(teacherName: string, teacherCode: string, feedbackText: string) {
    return this.create({
      category: 'FEEDBACK',
      title: 'GV gửi phản hồi',
      message: `${teacherName} (${teacherCode}): ${feedbackText.substring(0, 100)}${feedbackText.length > 100 ? '...' : ''}`,
      metadata: { teacherName, teacherCode, feedbackText },
    });
  }
}
