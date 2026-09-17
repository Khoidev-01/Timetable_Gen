'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  /** Nhóm sự kiện, ví dụ SWAP_REQUEST - màn hình quản trị lọc chuông theo cột này */
  category?: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Chuông thông báo, nhận đẩy thay vì hỏi lại.
 *
 * Trước đây cả hai giao diện đều hỏi máy chủ mỗi 30 giây. Với việc đổi tiết thì nửa phút đủ
 * để đồng nghiệp bỏ lỡ; với báo vắng lúc 6h45, tiết đầu 7h00, thì nửa phút là quá muộn.
 *
 * Vẫn giữ một nhịp hỏi lại nhưng thưa hẳn. Ổ cắm có thể đứt mà trình duyệt không kịp báo -
 * mất mạng chốc lát, máy vừa mở nắp, proxy công ty cắt kết nối nhàn rỗi - và khi đó cái
 * chuông im lặng trông y hệt một cái chuông không có gì mới.
 */
const FALLBACK_REFRESH_MS = 5 * 60 * 1000;

export function useLiveNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const token = () => (typeof window === 'undefined' ? '' : localStorage.getItem('token') ?? '');

  const refresh = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token()}` };
      const [list, count] = await Promise.all([
        fetch(`${API_URL}/notifications`, { headers }),
        fetch(`${API_URL}/notifications/unread-count`, { headers }),
      ]);
      if (list.ok) setNotifications(await list.json());
      if (count.ok) setUnreadCount((await count.json()).count);
    } catch {
      // Giữ nguyên những gì đang hiện: một lần hỏi hụt không đáng để xóa trắng chuông
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    refresh();

    const socket = io(`${API_URL}/notifications`, {
      transports: ['websocket'],
      // Danh tính đi trong lúc bắt tay; máy chủ tự suy ra người nhận từ đó, client không
      // được khai mình là ai
      auth: { token: token() },
    });
    socketRef.current = socket;

    socket.on('notification', (incoming: AppNotification) => {
      setNotifications((previous) =>
        previous.some((n) => n.id === incoming.id) ? previous : [incoming, ...previous].slice(0, 50),
      );
      if (!incoming.is_read) setUnreadCount((n) => n + 1);
    });

    const fallback = setInterval(refresh, FALLBACK_REFRESH_MS);

    return () => {
      clearInterval(fallback);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, refresh]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications((previous) => previous.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications((previous) => previous.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  }, []);

  return { notifications, unreadCount, refresh, markAsRead, markAllAsRead };
}
