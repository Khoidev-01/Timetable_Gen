import type { MetadataRoute } from 'next';

/**
 * Serves /robots.txt, which was a 404 until now.
 *
 * Only the public pages are worth indexing. The admin and teacher areas sit behind a
 * login, and a shared timetable link under /xem/<token> is meant for the people who were
 * given the link, not for search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/teacher/', '/xem/'],
    },
    sitemap: 'https://gettimetable.cloud/sitemap.xml',
    host: 'https://gettimetable.cloud',
  };
}
