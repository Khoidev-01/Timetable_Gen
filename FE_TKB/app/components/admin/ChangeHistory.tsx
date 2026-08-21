'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Undo2 } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface LogEntry {
  id: string;
  action: string;
  description: string;
  actor_name: string;
  reverted: boolean;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  MOVE: 'Chuyển tiết',
  SWAP: 'Hoán đổi',
  CASCADE_SWAP: 'Đổi dây chuyền',
  LOCK: 'Khóa',
  UNLOCK: 'Mở khóa',
  PUBLISH: 'Công bố',
  REVERT: 'Hoàn tác',
};

interface Props {
  timetableId: string | null;
  onReverted?: () => void;
}

/** Who changed what, and a way back. */
export default function ChangeHistory({ timetableId, onReverted }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [undoing, setUndoing] = useState('');
  const [error, setError] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    if (!timetableId) return;
    try {
      const response = await fetch(`${API_URL}/algorithm/history/${timetableId}`, {
        headers: authHeaders(),
      });
      if (response.ok) setEntries(await response.json());
    } catch (err) {
      console.error(err);
    }
  }, [timetableId]);

  useEffect(() => {
    load();
  }, [load]);

  const undo = async (entry: LogEntry) => {
    setUndoing(entry.id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/algorithm/undo/${entry.id}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.message ?? 'Không hoàn tác được.');
        return;
      }

      await load();
      onReverted?.();
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối.');
    } finally {
      setUndoing('');
    }
  };

  if (!timetableId || entries.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <History size={18} className="text-gray-500" />
        <span className="font-bold text-gray-800">Nhật ký chỉnh sửa</span>
        <span className="text-sm text-gray-500">{entries.length} thao tác gần nhất</span>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-sm ${
              entry.reverted ? 'text-gray-400' : 'text-gray-800'
            }`}
          >
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span className={entry.reverted ? 'line-through' : ''}>{entry.description}</span>
            <span className="text-xs text-gray-400">
              {entry.actor_name} · {new Date(entry.created_at).toLocaleString('vi-VN')}
            </span>

            {!entry.reverted && entry.action !== 'REVERT' && (
              <button
                onClick={() => undo(entry)}
                disabled={undoing === entry.id}
                className="ml-auto flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs
                  font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Undo2 size={12} />
                {undoing === entry.id ? 'Đang…' : 'Hoàn tác'}
              </button>
            )}
            {entry.reverted && <span className="ml-auto text-xs italic">đã hoàn tác</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
