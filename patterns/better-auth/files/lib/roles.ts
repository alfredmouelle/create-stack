export const userRoles = ['user', 'staff', 'admin'] as const;

export type UserRole = (typeof userRoles)[number];

export const isStaffRole = (role: UserRole): boolean =>
  role === 'staff' || role === 'admin';

export const isAdminRole = (role: UserRole): boolean => role === 'admin';
