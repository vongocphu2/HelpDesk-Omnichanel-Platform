import { SetMetadata } from '@nestjs/common';

export type StaffRole = 'admin' | 'manager' | 'agent';

export const ROLES_KEY = 'helpdesk_roles';

export const Roles = (...roles: StaffRole[]) =>
    SetMetadata(ROLES_KEY, roles);