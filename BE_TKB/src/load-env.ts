import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reads `.env` into `process.env` before anything else looks at it.
 *
 * Nothing here used to load `.env` on purpose. It arrived as a side effect of importing
 * `@prisma/client`, which meant every module that read an environment variable at
 * definition time was quietly depending on being evaluated after Prisma. Reordering the
 * imports in app.module.ts was enough to stop the whole application from starting, with
 * an error about JWT_SECRET that had nothing to do with the change.
 *
 * Real environment variables always win, so a deployment that sets them (Coolify, Docker)
 * is unaffected whether or not a `.env` file exists.
 */
export function loadEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'),
    join(__dirname, '..', '..', '.env'),
  ];

  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(separator + 1).trim();
    const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0];
    if (quoted) value = value.slice(1, -1);

    process.env[key] = value;
  }
}

loadEnv();
