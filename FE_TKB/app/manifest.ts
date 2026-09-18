import type { MetadataRoute } from 'next';

/**
 * Makes the site installable on a phone's home screen.
 *
 * Teachers check their timetable standing in a corridor between periods, on a phone, often
 * on school wifi that barely works. Opening a browser and finding a bookmark is friction
 * they will not put up with; an icon on the home screen is not.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MiKiTimetable - Xếp thời khóa biểu THPT thông minh',
    short_name: 'MiKiTimetable',
    description: 'Xếp lịch tự động, giảm xung đột và tra cứu thời khóa biểu mọi lúc',
    // Teachers install this for their own schedule, so that is where it should open
    start_url: '/teacher/schedule',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    lang: 'vi',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
