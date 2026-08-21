import { SetMetadata } from '@nestjs/common';

export type UserRole = 'ADMIN' | 'TEACHER';

export const ROLES_KEY = 'roles';

/** Restrict a route to the listed roles. Without it, any signed-in user may call it. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
