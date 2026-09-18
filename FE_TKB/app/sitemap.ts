import type { MetadataRoute } from 'next';

/**
 * Serves /sitemap.xml, which was a 404 until now.
 *
 * The site is a single public page; everything else needs a login. One entry is enough,
 * and it gives Google Search Console something to submit when the indexed title and
 * description fall behind what the page actually says.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://gettimetable.cloud',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
