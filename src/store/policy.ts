import type { AppSettings, User, UserRole } from '../types/crm';

export const ALL_ROLES: UserRole[] = [
  'Viewer',
  'Partner Viewer',
  'BD User',
  'Manager',
  'Admin',
  'Super Admin',
  'Partner Admin',
];

export function isReadOnlyRole(role: UserRole): boolean {
  return role === 'Viewer' || role === 'Partner Viewer';
}

export function isManagerPlus(role: UserRole): boolean {
  return role === 'Manager' || role === 'Admin' || role === 'Super Admin' || role === 'Partner Admin';
}

export function isAdminPlus(role: UserRole): boolean {
  return role === 'Admin' || role === 'Super Admin' || role === 'Partner Admin';
}

export function isOrgWideAdmin(role: UserRole): boolean {
  return role === 'Admin' || role === 'Super Admin';
}

export function isPartnerRole(role: UserRole): boolean {
  return role === 'Partner Viewer' || role === 'Partner Admin';
}

export interface ScopedRecord {
  owner_id?: string | null;
  created_by?: string | null;
  team_id?: string | null;
}

/**
 * Shared record-visibility policy used across every list, detail page, search,
 * timeline, dashboard KPI, report, suggestion, notification, CSV export, and
 * Institutional Engagement Brief.
 */
export function canAccessRecord(
  user: User | null,
  record: ScopedRecord,
  settings: AppSettings
): boolean {
  if (!user || !user.is_active) return false;
  if (user.role === 'Super Admin' || user.role === 'Admin') {
    return true;
  }
  if (isPartnerRole(user.role) && !settings.partner_roles_enabled) {
    return false;
  }
  if (user.role === 'Partner Admin') {
    return (
      (user.team_id !== null && record.team_id === user.team_id) ||
      record.owner_id === user.id ||
      record.created_by === user.id
    );
  }
  if (user.role === 'Partner Viewer') {
    return (
      (user.team_id !== null && record.team_id === user.team_id) ||
      record.owner_id === user.id
    );
  }
  if (record.owner_id === user.id || record.created_by === user.id) {
    return true;
  }
  if (user.team_id !== null && record.team_id === user.team_id) {
    return true;
  }
  return false;
}

export function canEditRecord(
  user: User | null,
  record: ScopedRecord,
  settings: AppSettings
): boolean {
  if (!user || isReadOnlyRole(user.role)) return false;
  return canAccessRecord(user, record, settings);
}

export function canManageProducts(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'Super Admin';
}

export function canAccessEnquiries(user: User | null, settings: AppSettings): boolean {
  if (!user || !settings.website_enquiries_enabled) return false;
  return isManagerPlus(user.role) && !isPartnerRole(user.role);
}
