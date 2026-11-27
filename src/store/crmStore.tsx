import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDaysIso,
  areOrgNamesSimilar,
  calcLineTotalCents,
  isFutureDate,
  isPastDate,
  normalizeOrgName,
  normalizePhone,
  todayIso,
} from '../lib/format';
import { createInitialDemoState } from './demoSeed';
import {
  canAccessEnquiries,
  canAccessRecord,
  canEditRecord,
  canManageProducts,
  isAdminPlus,
  isManagerPlus,
  isOrgWideAdmin,
  isReadOnlyRole,
} from './policy';
import type {
  ActionResult,
  ActionType,
  Activity,
  ActivityType,
  AppSettings,
  Contact,
  ContactMembership,
  CrmDatabaseState,
  Enquiry,
  Invoice,
  Lead,
  LeadPriority,
  LeadStage,
  Opportunity,
  OpportunityStage,
  Order,
  Organization,
  OrgFile,
  OrgType,
  Payment,
  PaymentMethod,
  Product,
  Quote,
  QuoteLine,
  SavedView,
  Team,
  User,
  UserRole,
} from '../types/crm';

const STORAGE_KEY = 'dex_sales_static_demo_v1';

const OPP_STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  Discovery: 20,
  Proposal: 40,
  Negotiation: 70,
  Won: 100,
  Lost: 0,
};

function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function formatSeq(prefix: string, num: number, withYear = false): string {
  const pad = String(num).padStart(4, '0');
  if (withYear) {
    return `${prefix}-${new Date().getFullYear()}-${pad}`;
  }
  return `${prefix}-${pad}`;
}

function loadInitialState(): CrmDatabaseState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CrmDatabaseState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  return createInitialDemoState();
}

export interface CrmContextValue {
  state: CrmDatabaseState;
  currentUser: User | null;
  visibleOrganizations: Organization[];
  visibleContacts: Contact[];
  visibleLeads: Lead[];
  visibleOpportunities: Opportunity[];
  visibleActivities: Activity[];
  visibleQuotes: Quote[];
  visibleOrders: Order[];
  visibleInvoices: Invoice[];
  visiblePayments: Payment[];
  visibleNotifications: CrmDatabaseState['notifications'];
  visibleEnquiries: Enquiry[];
  canAccess: (rec: { owner_id?: string | null; created_by?: string | null; team_id?: string | null }) => boolean;
  canEdit: (rec: { owner_id?: string | null; created_by?: string | null; team_id?: string | null }) => boolean;

  // Auth
  signIn: (email: string, password: string) => ActionResult<User>;
  signInAsUser: (userId: string) => ActionResult<User>;
  signOut: () => void;
  resetDemoWorkspace: () => void;

  // Organizations
  createOrganization: (input: {
    name: string;
    org_type: OrgType;
    country: string;
    city_region?: string;
    website?: string;
    notes?: string;
    main_phone?: string;
    main_email?: string;
    billing_address?: string;
    shipping_address?: string;
    legal_name?: string;
    tax_registration_number?: string;
    industry?: string;
    org_size?: string;
    parent_org_id?: string | null;
    account_status?: Organization['account_status'];
    owner_id?: string;
    confirmDuplicate?: boolean;
  }) => ActionResult<Organization>;
  updateOrganization: (id: string, patch: Partial<Organization>, confirmDuplicate?: boolean) => ActionResult<Organization>;
  mergeOrganizations: (sourceId: string, targetId: string) => ActionResult;
  deleteOrganization: (id: string) => ActionResult;
  addOrgFile: (orgId: string, fileName: string, mimeType: string, sizeBytes: number, note: string) => ActionResult<OrgFile>;

  // Contacts
  createContact: (input: {
    first_name: string;
    last_name: string;
    country: string;
    phone?: string;
    personal_email?: string;
    work_email?: string;
    preferred_language?: string;
    relationship?: string;
    how_known?: string;
    do_not_contact?: boolean;
    consent_basis?: string;
    initial_org_id?: string;
    initial_designation?: string;
  }) => ActionResult<Contact>;
  updateContact: (id: string, patch: Partial<Contact>) => ActionResult<Contact>;
  addContactMembership: (contactId: string, organizationId: string, designation: string) => ActionResult<ContactMembership>;
  removeContactMembership: (membershipId: string) => ActionResult;
  deleteContact: (id: string) => ActionResult;

  // Leads
  createLead: (input: {
    organization_id: string;
    primary_contact_id: string;
    additional_contact_ids?: string[];
    lead_type: string;
    source: string;
    purpose: string;
    purpose_details?: string;
    relationship?: string;
    how_known?: string;
    language?: string;
    priority?: LeadPriority;
    country?: string;
    next_action_text: string;
    next_action_type: ActionType;
    next_action_due_date: string;
    next_action_owner_id?: string;
    confirmDuplicate?: boolean;
  }) => ActionResult<Lead>;
  updateLead: (id: string, patch: Partial<Lead>) => ActionResult<Lead>;
  changeLeadStage: (
    id: string,
    targetStage: LeadStage,
    details?: {
      demo_scheduled_at?: string;
      demo_timezone?: string;
      demo_attendees?: string;
      close_reason?: string;
      revisit_date?: string;
      qualified_next_step?: string;
      outcome_note?: string;
    }
  ) => ActionResult<Lead>;
  saveLeadView: (name: string, filters: SavedView['filters']) => ActionResult<SavedView>;
  deleteLeadView: (id: string) => void;

  // Activities & Calendar
  createActivity: (input: {
    entity_type: Activity['entity_type'];
    entity_id: string;
    type: ActivityType;
    summary: string;
    details?: string;
    scheduled_at?: string | null;
    duration_minutes?: number;
    timezone?: string;
    location_or_link?: string;
    action_type?: ActionType;
    is_next_action?: boolean;
    due_date?: string | null;
    owner_id?: string;
    related_contact_ids?: string[];
    doubleBookConfirmed?: boolean;
  }) => ActionResult<Activity>;
  updateActivity: (id: string, patch: Partial<Activity>) => ActionResult<Activity>;
  completeAction: (
    activityId: string,
    outcomeNote: string,
    followUp?: { summary: string; action_type: ActionType; due_date: string; owner_id: string }
  ) => ActionResult;

  // Opportunities
  createOpportunityFromLead: (
    leadId: string,
    input: {
      title: string;
      estimated_value_cents: number;
      expected_close_date?: string;
      next_step: string;
      next_step_due_date: string;
      description?: string;
    }
  ) => ActionResult<Opportunity>;
  updateOpportunity: (
    id: string,
    patch: {
      title?: string;
      stage?: OpportunityStage;
      estimated_value_cents?: number;
      probability?: number;
      expected_close_date?: string | null;
      next_step?: string;
      next_step_due_date?: string | null;
      description?: string;
      close_reason?: string;
      owner_id?: string;
    }
  ) => ActionResult<Opportunity>;

  // Products
  createProduct: (input: { sku: string; name: string; description: string; unit: string; unit_price_cents: number }) => ActionResult<Product>;
  updateProduct: (id: string, patch: Partial<Product>) => ActionResult<Product>;

  // Quotes
  createQuote: (input: {
    opportunity_id: string;
    contact_id: string;
    valid_until: string;
    notes_terms?: string;
    lines: Array<{
      product_id: string | null;
      description: string;
      quantity_thousandths: number;
      unit: string;
      unit_price_cents: number;
      discount_cents: number;
    }>;
  }) => ActionResult<Quote>;
  updateQuote: (
    id: string,
    patch: {
      contact_id: string;
      valid_until: string;
      notes_terms: string;
      lines: Array<{
        product_id: string | null;
        description: string;
        quantity_thousandths: number;
        unit: string;
        unit_price_cents: number;
        discount_cents: number;
      }>;
    }
  ) => ActionResult<Quote>;
  markQuoteSent: (id: string) => ActionResult<Quote>;
  recordQuoteDecision: (id: string, decision: 'Accepted' | 'Declined', declineReason?: string) => ActionResult<Quote>;
  reviseQuote: (id: string) => ActionResult<Quote>;
  deleteQuote: (id: string) => ActionResult;

  // Orders
  createOrderFromQuote: (quoteId: string) => ActionResult<Order>;
  cancelOrder: (orderId: string, reason: string) => ActionResult<Order>;

  // Invoices & Payments
  createDraftInvoiceFromOrder: (orderId: string) => ActionResult<Invoice>;
  updateDraftInvoice: (id: string, patch: { due_date: string; notes: string }) => ActionResult<Invoice>;
  issueInvoice: (id: string) => ActionResult<Invoice>;
  voidInvoice: (id: string, reason: string) => ActionResult<Invoice>;
  recordPayment: (
    invoiceId: string,
    input: { amount_cents: number; payment_date: string; method: PaymentMethod; reference?: string }
  ) => ActionResult<Payment>;
  reversePayment: (paymentId: string, reason: string) => ActionResult<Payment>;

  // Enquiries, Notifications, Suggestions, Admin & CSV
  submitWebsiteEnquiry: (input: {
    enquiry_type: 'booking' | 'contact';
    org_name: string;
    country: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    purpose: string;
    message: string;
    preferred_date?: string;
  }) => ActionResult<Enquiry>;
  approveEnquiry: (enquiryId: string, reviewNote?: string) => ActionResult<Lead>;
  dismissEnquiry: (enquiryId: string, reviewNote: string) => ActionResult<Enquiry>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setSuggestionStatus: (key: string, status: 'accepted' | 'dismissed' | 'snoozed', snoozeDays?: number) => void;
  importOrganizationsCsv: (rows: Array<Record<string, string>>) => ActionResult<{ imported: number; skipped: Array<{ row: number; reason: string }> }>;
  createUser: (input: { name: string; email: string; password: string; role: UserRole; team_id: string | null }) => ActionResult<User>;
  updateUser: (id: string, patch: Partial<Pick<User, 'name' | 'role' | 'team_id' | 'is_active'>>) => ActionResult<User>;
  createTeam: (input: { name: string; description: string; is_partner_team: boolean }) => ActionResult<Team>;
  updateSettings: (patch: Partial<AppSettings>) => ActionResult<AppSettings>;
  recordAuditExport: (reportName: string, rowCount: number) => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CrmDatabaseState>(loadInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId && u.is_active) ?? null,
    [state.users, state.currentUserId]
  );

  const canAccess = (rec: { owner_id?: string | null; created_by?: string | null; team_id?: string | null }) =>
    canAccessRecord(currentUser, rec, state.settings);

  const canEdit = (rec: { owner_id?: string | null; created_by?: string | null; team_id?: string | null }) =>
    canEditRecord(currentUser, rec, state.settings);

  const visibleOrganizations = useMemo(
    () => state.organizations.filter((o) => !o.merged_into_id && canAccessRecord(currentUser, o, state.settings)),
    [state.organizations, currentUser, state.settings]
  );

  const visibleContacts = useMemo(
    () => state.contacts.filter((c) => canAccessRecord(currentUser, c, state.settings)),
    [state.contacts, currentUser, state.settings]
  );

  const visibleLeads = useMemo(
    () => state.leads.filter((l) => canAccessRecord(currentUser, l, state.settings)),
    [state.leads, currentUser, state.settings]
  );

  const visibleOpportunities = useMemo(
    () => state.opportunities.filter((o) => canAccessRecord(currentUser, o, state.settings)),
    [state.opportunities, currentUser, state.settings]
  );

  const visibleActivities = useMemo(
    () => state.activities.filter((a) => canAccessRecord(currentUser, a, state.settings)),
    [state.activities, currentUser, state.settings]
  );

  const visibleQuotes = useMemo(
    () => state.quotes.filter((q) => canAccessRecord(currentUser, q, state.settings)),
    [state.quotes, currentUser, state.settings]
  );

  const visibleOrders = useMemo(
    () => state.orders.filter((o) => canAccessRecord(currentUser, o, state.settings)),
    [state.orders, currentUser, state.settings]
  );

  const visibleInvoices = useMemo(
    () => state.invoices.filter((i) => canAccessRecord(currentUser, i, state.settings)),
    [state.invoices, currentUser, state.settings]
  );

  const visiblePayments = useMemo(
    () => state.payments.filter((p) => canAccessRecord(currentUser, p, state.settings)),
    [state.payments, currentUser, state.settings]
  );

  const visibleNotifications = useMemo(() => {
    if (!currentUser) return [];
    return state.notifications.filter((n) => n.user_id === currentUser.id);
  }, [state.notifications, currentUser]);

  const visibleEnquiries = useMemo(() => {
    if (!canAccessEnquiries(currentUser, state.settings)) return [];
    return state.enquiries;
  }, [state.enquiries, currentUser, state.settings]);

  const appendAudit = (
    draft: CrmDatabaseState,
    actor: User,
    action: string,
    entity_type: string,
    entity_id: string,
    summary: string
  ) => {
    draft.auditLogs = [
      {
        id: uid('aud'),
        actor_id: actor.id,
        actor_email: actor.email,
        actor_role: actor.role,
        action,
        entity_type,
        entity_id,
        summary,
        created_at: new Date().toISOString(),
      },
      ...draft.auditLogs,
    ].slice(0, 500);
  };

  const pushNotif = (
    draft: CrmDatabaseState,
    userId: string,
    type: string,
    title: string,
    body: string,
    entity_type: CrmDatabaseState['notifications'][0]['entity_type'],
    entity_id: string
  ) => {
    draft.notifications = [
      {
        id: uid('notif'),
        user_id: userId,
        type,
        title,
        body,
        entity_type,
        entity_id,
        is_read: false,
        created_at: new Date().toISOString(),
      },
      ...draft.notifications,
    ].slice(0, 200);
  };

  // --- Auth ---
  const signIn = (email: string, password: string): ActionResult<User> => {
    const cleanEmail = email.trim().toLowerCase();
    const user = state.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) return { ok: false, error: 'No account found with that email address.' };
    if (!user.is_active) return { ok: false, error: 'This user account is deactivated. Contact an Administrator.' };
    if (user.password !== password) return { ok: false, error: 'Incorrect password. (Demo accounts use password "demo".)' };
    setState((prev) => ({ ...prev, currentUserId: user.id }));
    return { ok: true, data: user };
  };

  const signInAsUser = (userId: string): ActionResult<User> => {
    const user = state.users.find((u) => u.id === userId);
    if (!user || !user.is_active) return { ok: false, error: 'Selected user is unavailable.' };
    setState((prev) => ({ ...prev, currentUserId: user.id }));
    return { ok: true, data: user };
  };

  const signOut = () => {
    setState((prev) => ({ ...prev, currentUserId: null }));
  };

  const resetDemoWorkspace = () => {
    const fresh = createInitialDemoState();
    setState(fresh);
  };

  // --- Organizations ---
  const createOrganization: CrmContextValue['createOrganization'] = (input) => {
    if (!currentUser || isReadOnlyRole(currentUser.role)) {
      return { ok: false, error: 'Read-only roles cannot create organizations.' };
    }
    const name = input.name.trim();
    const country = input.country.trim();
    if (!name || !country) {
      return { ok: false, error: 'Organization name and country are required.' };
    }

    const activeOrgs = state.organizations.filter((o) => !o.merged_into_id);
    const matches = activeOrgs.filter(
      (o) => o.country.toLowerCase() === country.toLowerCase() && areOrgNamesSimilar(o.name, name)
    );

    if (matches.length > 0 && !input.confirmDuplicate) {
      return {
        ok: false,
        code: 'DUPLICATE_CONFIRM_REQUIRED',
        error: `Found ${matches.length} similar organization(s) in ${country}. Confirm if you want to create a separate record.`,
        duplicates: matches.map((m) => ({
          id: m.id,
          label: canAccess(m) ? m.name : 'Existing organization (outside your visibility scope)',
          detail: canAccess(m) ? `${m.org_type} · ${m.city_region || m.country}` : `Same country match (${m.country})`,
        })),
      };
    }

    const now = new Date().toISOString();
    const ownerId = input.owner_id || currentUser.id;
    const ownerUser = state.users.find((u) => u.id === ownerId) || currentUser;

    const org: Organization = {
      id: uid('org'),
      name,
      normalized_name: normalizeOrgName(name),
      org_type: input.org_type,
      country,
      city_region: (input.city_region || '').trim(),
      website: (input.website || '').trim(),
      notes: (input.notes || '').trim(),
      owner_id: ownerUser.id,
      team_id: ownerUser.team_id,
      main_phone: (input.main_phone || '').trim(),
      main_email: (input.main_email || '').trim(),
      billing_address: (input.billing_address || '').trim(),
      shipping_address: (input.shipping_address || '').trim(),
      legal_name: (input.legal_name || '').trim(),
      tax_registration_number: (input.tax_registration_number || '').trim(),
      industry: (input.industry || '').trim(),
      org_size: (input.org_size || '').trim(),
      parent_org_id: input.parent_org_id || null,
      account_status: input.account_status || 'Prospect',
      merged_into_id: null,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = { ...prev, organizations: [org, ...prev.organizations] };
      appendAudit(next, currentUser, 'ORG_CREATED', 'organization', org.id, `Created organization ${org.name} (${org.country})`);
      return next;
    });
    return { ok: true, data: org };
  };

  const updateOrganization: CrmContextValue['updateOrganization'] = (id, patch, confirmDuplicate) => {
    const existing = state.organizations.find((o) => o.id === id && !o.merged_into_id);
    if (!existing) return { ok: false, error: 'Organization not found.' };
    if (!currentUser || !canEdit(existing)) return { ok: false, error: 'Permission denied to edit this organization.' };

    const nextName = (patch.name ?? existing.name).trim();
    const nextCountry = (patch.country ?? existing.country).trim();
    if (!nextName || !nextCountry) return { ok: false, error: 'Name and country are required.' };

    const matches = state.organizations.filter(
      (o) =>
        o.id !== id &&
        !o.merged_into_id &&
        o.country.toLowerCase() === nextCountry.toLowerCase() &&
        areOrgNamesSimilar(o.name, nextName)
    );
    if (matches.length > 0 && !confirmDuplicate) {
      return {
        ok: false,
        code: 'DUPLICATE_CONFIRM_REQUIRED',
        error: `Similar organization found in ${nextCountry}. Confirm to save changes.`,
        duplicates: matches.map((m) => ({
          id: m.id,
          label: canAccess(m) ? m.name : 'Existing organization (outside your visibility scope)',
          detail: `${m.org_type} · ${m.country}`,
        })),
      };
    }

    const updated: Organization = {
      ...existing,
      ...patch,
      name: nextName,
      normalized_name: normalizeOrgName(nextName),
      country: nextCountry,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => {
      const next = {
        ...prev,
        organizations: prev.organizations.map((o) => (o.id === id ? updated : o)),
      };
      appendAudit(next, currentUser, 'ORG_UPDATED', 'organization', id, `Updated organization ${updated.name}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const mergeOrganizations: CrmContextValue['mergeOrganizations'] = (sourceId, targetId) => {
    if (!currentUser || !isManagerPlus(currentUser.role)) {
      return { ok: false, error: 'Only Manager or Admin roles can merge organizations.' };
    }
    if (sourceId === targetId) return { ok: false, error: 'Source and target organizations must be different.' };
    const source = state.organizations.find((o) => o.id === sourceId && !o.merged_into_id);
    const target = state.organizations.find((o) => o.id === targetId && !o.merged_into_id);
    if (!source || !target) return { ok: false, error: 'Both organizations must exist and be active.' };
    if (!canAccess(source) || !canAccess(target)) return { ok: false, error: 'You do not have access to both organizations.' };

    setState((prev) => {
      const now = new Date().toISOString();
      // Move contact memberships avoiding duplicate (contact_id, targetId)
      const targetMemberContactIds = new Set(
        prev.contactMemberships.filter((m) => m.organization_id === targetId).map((m) => m.contact_id)
      );
      const updatedMemberships = prev.contactMemberships
        .filter((m) => !(m.organization_id === sourceId && targetMemberContactIds.has(m.contact_id)))
        .map((m) => (m.organization_id === sourceId ? { ...m, organization_id: targetId } : m));

      const next: CrmDatabaseState = {
        ...prev,
        organizations: prev.organizations.map((o) =>
          o.id === sourceId ? { ...o, merged_into_id: targetId, account_status: 'Inactive', updated_at: now } : o
        ),
        contactMemberships: updatedMemberships,
        leads: prev.leads.map((l) => (l.organization_id === sourceId ? { ...l, organization_id: targetId, updated_at: now } : l)),
        opportunities: prev.opportunities.map((op) =>
          op.organization_id === sourceId ? { ...op, organization_id: targetId, updated_at: now } : op
        ),
        activities: prev.activities.map((a) =>
          a.organization_id === sourceId
            ? {
                ...a,
                organization_id: targetId,
                entity_id: a.entity_type === 'organization' ? targetId : a.entity_id,
              }
            : a
        ),
        quotes: prev.quotes.map((q) => (q.organization_id === sourceId ? { ...q, organization_id: targetId } : q)),
        orders: prev.orders.map((ord) => (ord.organization_id === sourceId ? { ...ord, organization_id: targetId } : ord)),
        invoices: prev.invoices.map((inv) => (inv.organization_id === sourceId ? { ...inv, organization_id: targetId } : inv)),
        payments: prev.payments.map((p) => (p.organization_id === sourceId ? { ...p, organization_id: targetId } : p)),
        orgFiles: prev.orgFiles.map((f) => (f.organization_id === sourceId ? { ...f, organization_id: targetId } : f)),
      };
      appendAudit(next, currentUser, 'ORG_MERGED', 'organization', targetId, `Merged ${source.name} into ${target.name}`);
      return next;
    });
    return { ok: true };
  };

  const deleteOrganization: CrmContextValue['deleteOrganization'] = (id) => {
    if (!currentUser || !isManagerPlus(currentUser.role)) {
      return { ok: false, error: 'Only Manager or Admin roles can delete organizations.' };
    }
    const org = state.organizations.find((o) => o.id === id);
    if (!org || !canEdit(org)) return { ok: false, error: 'Permission denied or organization not found.' };

    const hasDeps =
      state.leads.some((l) => l.organization_id === id) ||
      state.opportunities.some((o) => o.organization_id === id) ||
      state.quotes.some((q) => q.organization_id === id) ||
      state.orders.some((o) => o.organization_id === id) ||
      state.invoices.some((i) => i.organization_id === id) ||
      state.contactMemberships.some((m) => m.organization_id === id && m.is_active);

    if (hasDeps) {
      return { ok: false, error: 'Cannot delete organization while linked contacts, leads, opportunities, or commercial documents remain.' };
    }

    setState((prev) => {
      const next = {
        ...prev,
        organizations: prev.organizations.filter((o) => o.id !== id),
      };
      appendAudit(next, currentUser, 'ORG_DELETED', 'organization', id, `Deleted organization ${org.name}`);
      return next;
    });
    return { ok: true };
  };

  const addOrgFile: CrmContextValue['addOrgFile'] = (orgId, fileName, mimeType, sizeBytes, note) => {
    const org = state.organizations.find((o) => o.id === orgId && !o.merged_into_id);
    if (!org || !currentUser || !canEdit(org)) {
      return { ok: false, error: 'Permission denied to attach files to this organization.' };
    }
    const file: OrgFile = {
      id: uid('file'),
      organization_id: orgId,
      file_name: fileName.trim(),
      mime_type: mimeType || 'application/octet-stream',
      size_bytes: sizeBytes,
      note: note.trim(),
      uploaded_by: currentUser.id,
      created_at: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, orgFiles: [file, ...prev.orgFiles] };
      appendAudit(next, currentUser, 'FILE_ATTACHED', 'organization', orgId, `Attached ${file.file_name} to ${org.name}`);
      return next;
    });
    return { ok: true, data: file };
  };

  // --- Contacts ---
  const findContactDuplicates = (
    phoneNorm: string,
    personalEmail: string,
    workEmail: string,
    excludeId?: string
  ) => {
    const pEmail = personalEmail.trim().toLowerCase();
    const wEmail = workEmail.trim().toLowerCase();
    return state.contacts.filter((c) => {
      if (excludeId && c.id === excludeId) return false;
      if (phoneNorm && c.normalized_phone && c.normalized_phone === phoneNorm) return true;
      const cp = c.personal_email.trim().toLowerCase();
      const cw = c.work_email.trim().toLowerCase();
      if (pEmail && (cp === pEmail || cw === pEmail)) return true;
      if (wEmail && (cp === wEmail || cw === wEmail)) return true;
      return false;
    });
  };

  const createContact: CrmContextValue['createContact'] = (input) => {
    if (!currentUser || isReadOnlyRole(currentUser.role)) {
      return { ok: false, error: 'Read-only roles cannot create contacts.' };
    }
    const first = input.first_name.trim();
    const last = input.last_name.trim();
    const phone = (input.phone || '').trim();
    const pEmail = (input.personal_email || '').trim();
    const wEmail = (input.work_email || '').trim();

    if (!first || !last) return { ok: false, error: 'First name and last name are required.' };
    if (!phone && !pEmail) {
      return { ok: false, error: 'At least a phone number or personal email is required.' };
    }

    const normPhone = normalizePhone(phone, input.country);
    const dupes = findContactDuplicates(normPhone, pEmail, wEmail);
    if (dupes.length > 0) {
      return {
        ok: false,
        code: 'DUPLICATE_CONTACT',
        error: 'Duplicate phone number or email address detected. Contacts must have unique email and phone numbers.',
        duplicates: dupes.map((d) => ({
          id: d.id,
          label: canAccess(d) ? `${d.first_name} ${d.last_name}` : 'Existing contact (restricted scope)',
          detail: canAccess(d) ? `${d.work_email || d.personal_email || d.normalized_phone}` : 'Email/phone uniqueness conflict',
        })),
      };
    }

    const now = new Date().toISOString();
    const contact: Contact = {
      id: uid('cnt'),
      first_name: first,
      last_name: last,
      country: input.country,
      phone,
      normalized_phone: normPhone,
      personal_email: pEmail,
      work_email: wEmail,
      preferred_language: input.preferred_language || 'English',
      relationship: (input.relationship || '').trim(),
      how_known: (input.how_known || '').trim(),
      do_not_contact: Boolean(input.do_not_contact),
      consent_basis: (input.consent_basis || '').trim(),
      consent_timestamp: input.consent_basis ? now : null,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const newMembership: ContactMembership | null = input.initial_org_id
      ? {
          id: uid('mem'),
          contact_id: contact.id,
          organization_id: input.initial_org_id,
          designation: (input.initial_designation || '').trim(),
          is_active: true,
          started_at: now,
          ended_at: null,
        }
      : null;

    setState((prev) => {
      const next = {
        ...prev,
        contacts: [contact, ...prev.contacts],
        contactMemberships: newMembership ? [newMembership, ...prev.contactMemberships] : prev.contactMemberships,
      };
      appendAudit(next, currentUser, 'CONTACT_CREATED', 'contact', contact.id, `Created contact ${first} ${last}`);
      return next;
    });
    return { ok: true, data: contact };
  };

  const updateContact: CrmContextValue['updateContact'] = (id, patch) => {
    const existing = state.contacts.find((c) => c.id === id);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or contact not found.' };
    }
    const phone = (patch.phone ?? existing.phone).trim();
    const country = patch.country ?? existing.country;
    const pEmail = (patch.personal_email ?? existing.personal_email).trim();
    const wEmail = (patch.work_email ?? existing.work_email).trim();

    if (!phone && !pEmail) {
      return { ok: false, error: 'At least a phone number or personal email is required.' };
    }

    const normPhone = normalizePhone(phone, country);
    const dupes = findContactDuplicates(normPhone, pEmail, wEmail, id);
    if (dupes.length > 0) {
      return {
        ok: false,
        code: 'DUPLICATE_CONTACT',
        error: 'Another contact already uses this email or normalized phone number.',
      };
    }

    const updated: Contact = {
      ...existing,
      ...patch,
      phone,
      normalized_phone: normPhone,
      personal_email: pEmail,
      work_email: wEmail,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => {
      const next = {
        ...prev,
        contacts: prev.contacts.map((c) => (c.id === id ? updated : c)),
      };
      appendAudit(next, currentUser, 'CONTACT_UPDATED', 'contact', id, `Updated contact ${updated.first_name} ${updated.last_name}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const addContactMembership: CrmContextValue['addContactMembership'] = (contactId, organizationId, designation) => {
    const contact = state.contacts.find((c) => c.id === contactId);
    const org = state.organizations.find((o) => o.id === organizationId && !o.merged_into_id);
    if (!contact || !org || !currentUser || !canEdit(contact) || !canAccess(org)) {
      return { ok: false, error: 'Permission denied or record not found.' };
    }

    const currentActive = state.contactMemberships.filter((m) => m.contact_id === contactId && m.is_active);
    if (currentActive.length >= 20) {
      return { ok: false, error: 'A contact may belong to at most 20 organizations.' };
    }
    if (currentActive.some((m) => m.organization_id === organizationId)) {
      return { ok: false, error: 'Contact is already an active member of this organization.' };
    }

    const mem: ContactMembership = {
      id: uid('mem'),
      contact_id: contactId,
      organization_id: organizationId,
      designation: designation.trim(),
      is_active: true,
      started_at: new Date().toISOString(),
      ended_at: null,
    };
    setState((prev) => {
      const next = { ...prev, contactMemberships: [mem, ...prev.contactMemberships] };
      appendAudit(
        next,
        currentUser,
        'MEMBERSHIP_ADDED',
        'contact',
        contactId,
        `Linked ${contact.first_name} ${contact.last_name} to ${org.name} (${designation || 'Member'})`
      );
      return next;
    });
    return { ok: true, data: mem };
  };

  const removeContactMembership: CrmContextValue['removeContactMembership'] = (membershipId) => {
    const mem = state.contactMemberships.find((m) => m.id === membershipId);
    if (!mem) return { ok: false, error: 'Membership not found.' };
    const contact = state.contacts.find((c) => c.id === mem.contact_id);
    if (!contact || !currentUser || !canEdit(contact)) {
      return { ok: false, error: 'Permission denied.' };
    }

    const activeLeadBlocking = state.leads.some(
      (l) =>
        l.organization_id === mem.organization_id &&
        l.primary_contact_id === mem.contact_id &&
        l.stage !== 'Lost'
    );
    if (activeLeadBlocking) {
      return {
        ok: false,
        error: 'Cannot remove person from this organization while they are the primary contact on one of its active leads.',
      };
    }

    const now = new Date().toISOString();
    setState((prev) => {
      const next = {
        ...prev,
        contactMemberships: prev.contactMemberships.map((m) =>
          m.id === membershipId ? { ...m, is_active: false, ended_at: now } : m
        ),
      };
      appendAudit(next, currentUser, 'MEMBERSHIP_ENDED', 'contact', mem.contact_id, `Ended organization membership ${membershipId}`);
      return next;
    });
    return { ok: true };
  };

  const deleteContact: CrmContextValue['deleteContact'] = (id) => {
    const contact = state.contacts.find((c) => c.id === id);
    if (!contact || !currentUser || !canEdit(contact)) return { ok: false, error: 'Permission denied or contact not found.' };

    const isPrimaryOnLead = state.leads.some((l) => l.primary_contact_id === id);
    if (isPrimaryOnLead) {
      return { ok: false, error: 'Cannot delete a contact who is a primary contact on a lead.' };
    }
    const usedInCommercial =
      state.opportunities.some((o) => o.primary_contact_id === id) ||
      state.quotes.some((q) => q.contact_id === id);
    if (usedInCommercial) {
      return { ok: false, error: 'Cannot delete a contact referenced on opportunities or quotes.' };
    }

    setState((prev) => {
      const next = {
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== id),
        contactMemberships: prev.contactMemberships.filter((m) => m.contact_id !== id),
      };
      appendAudit(next, currentUser, 'CONTACT_DELETED', 'contact', id, `Deleted contact ${contact.first_name} ${contact.last_name}`);
      return next;
    });
    return { ok: true };
  };

  // --- Leads ---
  const createLead: CrmContextValue['createLead'] = (input) => {
    if (!currentUser || isReadOnlyRole(currentUser.role)) {
      return { ok: false, error: 'Read-only roles cannot create leads.' };
    }
    const org = state.organizations.find((o) => o.id === input.organization_id && !o.merged_into_id);
    const contact = state.contacts.find((c) => c.id === input.primary_contact_id);
    if (!org || !contact) return { ok: false, error: 'Valid organization and primary contact are required.' };
    if (!canAccess(org) || !canAccess(contact)) return { ok: false, error: 'Selected organization or contact is outside your access scope.' };

    const belongsToOrg = state.contactMemberships.some(
      (m) => m.contact_id === contact.id && m.organization_id === org.id && m.is_active
    );
    if (!belongsToOrg) {
      return { ok: false, error: 'Primary contact must actively belong to the selected organization.' };
    }

    if (!input.purpose.trim() || !input.lead_type.trim() || !input.source.trim()) {
      return { ok: false, error: 'Lead type, source, and purpose are required.' };
    }
    if (!input.next_action_text.trim() || !input.next_action_due_date) {
      return { ok: false, error: 'Every new lead requires an initial next action with text and due date.' };
    }
    if (isPastDate(input.next_action_due_date)) {
      return { ok: false, error: 'Initial next action due date cannot be in the past.' };
    }

    const openSameOrgPurpose = state.leads.filter(
      (l) =>
        l.organization_id === org.id &&
        l.stage !== 'Lost' &&
        l.stage !== 'Qualified' &&
        l.purpose.toLowerCase().trim() === input.purpose.toLowerCase().trim()
    );
    if (openSameOrgPurpose.length > 0 && !input.confirmDuplicate) {
      return {
        ok: false,
        code: 'DUPLICATE_CONFIRM_REQUIRED',
        error: `An open lead already exists for ${org.name} with purpose "${input.purpose}". Confirm to create a second lead.`,
        duplicates: openSameOrgPurpose.map((l) => ({
          id: l.id,
          label: `${l.lead_number} · ${l.purpose}`,
          detail: `Stage: ${l.stage}`,
        })),
      };
    }

    const now = new Date().toISOString();
    const leadId = uid('lead');
    const leadNumber = formatSeq('LD', state.sequences.lead);
    const actionOwnerId = input.next_action_owner_id || currentUser.id;
    const actionOwner = state.users.find((u) => u.id === actionOwnerId) || currentUser;

    const lead: Lead = {
      id: leadId,
      lead_number: leadNumber,
      organization_id: org.id,
      primary_contact_id: contact.id,
      additional_contact_ids: input.additional_contact_ids || [],
      lead_type: input.lead_type.trim(),
      source: input.source.trim(),
      purpose: input.purpose.trim(),
      purpose_details: (input.purpose_details || '').trim(),
      relationship: (input.relationship || contact.relationship || '').trim(),
      how_known: (input.how_known || contact.how_known || '').trim(),
      language: input.language || contact.preferred_language || 'English',
      priority: input.priority || 'Medium',
      stage: 'Prospect',
      response_status: 'Awaiting response',
      demonstration_status: 'Not yet offered',
      country: input.country || org.country,
      approach_date: todayIso(),
      response_date: null,
      demo_scheduled_at: null,
      demo_timezone: '',
      demo_attendees: '',
      demo_notes: '',
      close_reason: '',
      revisit_date: null,
      outcome_note: '',
      qualified_next_step: '',
      qualified_approved_by: null,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const actTypeMap: Record<ActionType, ActivityType> = {
      Call: 'Call',
      Email: 'Email',
      Meeting: 'Meeting',
      Demo: 'Demo',
      'Send material': 'Email',
      'Internal follow-up': 'Note',
      Other: 'Note',
    };

    const firstAction: Activity = {
      id: uid('act'),
      entity_type: 'lead',
      entity_id: lead.id,
      organization_id: org.id,
      lead_id: lead.id,
      opportunity_id: null,
      type: actTypeMap[input.next_action_type] || 'Note',
      summary: input.next_action_text.trim(),
      details: '',
      occurred_at: now,
      scheduled_at: null,
      duration_minutes: 30,
      timezone: 'UTC',
      location_or_link: '',
      action_type: input.next_action_type,
      is_next_action: true,
      due_date: input.next_action_due_date,
      status: 'Open',
      outcome_note: '',
      completed_at: null,
      owner_id: actionOwner.id,
      team_id: actionOwner.team_id,
      is_immutable: false,
      related_contact_ids: [contact.id],
      double_book_confirmed: false,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next: CrmDatabaseState = {
        ...prev,
        sequences: { ...prev.sequences, lead: prev.sequences.lead + 1 },
        leads: [lead, ...prev.leads],
        activities: [firstAction, ...prev.activities],
      };
      appendAudit(next, currentUser, 'LEAD_CREATED', 'lead', lead.id, `Created lead ${lead.lead_number} for ${org.name}`);
      if (actionOwner.id !== currentUser.id) {
        pushNotif(next, actionOwner.id, 'assignment', `Assigned action on ${lead.lead_number}`, firstAction.summary, 'lead', lead.id);
      }
      return next;
    });
    return { ok: true, data: lead };
  };

  const isLeadLockedByOpportunity = (leadId: string): boolean => {
    return state.opportunities.some((o) => o.lead_id === leadId);
  };

  const updateLead: CrmContextValue['updateLead'] = (id, patch) => {
    const existing = state.leads.find((l) => l.id === id);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or lead not found.' };
    }
    if (isLeadLockedByOpportunity(id) && !isOrgWideAdmin(currentUser.role)) {
      return { ok: false, error: 'This qualified lead already has an opportunity and is read-only for non-Admin roles.' };
    }

    const updated: Lead = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => {
      const next = { ...prev, leads: prev.leads.map((l) => (l.id === id ? updated : l)) };
      if (patch.owner_id && patch.owner_id !== existing.owner_id) {
        pushNotif(next, patch.owner_id, 'assignment', `Lead ${existing.lead_number} assigned to you`, existing.purpose, 'lead', id);
        appendAudit(next, currentUser, 'LEAD_REASSIGNED', 'lead', id, `Reassigned ${existing.lead_number}`);
      } else {
        appendAudit(next, currentUser, 'LEAD_UPDATED', 'lead', id, `Updated lead ${existing.lead_number}`);
      }
      return next;
    });
    return { ok: true, data: updated };
  };

  const changeLeadStage: CrmContextValue['changeLeadStage'] = (id, targetStage, details = {}) => {
    const existing = state.leads.find((l) => l.id === id);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or lead not found.' };
    }
    if (isLeadLockedByOpportunity(id) && !isOrgWideAdmin(currentUser.role)) {
      return { ok: false, error: 'Lead stage is locked once an opportunity has been created.' };
    }

    const nextDemoAt = details.demo_scheduled_at ?? existing.demo_scheduled_at;
    const nextDemoTz = (details.demo_timezone ?? existing.demo_timezone).trim();
    const nextDemoAtt = (details.demo_attendees ?? existing.demo_attendees).trim();
    const nextCloseReason = (details.close_reason ?? existing.close_reason).trim();
    const nextRevisit = details.revisit_date ?? existing.revisit_date;
    const nextQualStep = (details.qualified_next_step ?? existing.qualified_next_step).trim();

    if (targetStage === 'Demo scheduled') {
      if (!nextDemoAt || !nextDemoTz || !nextDemoAtt) {
        return { ok: false, error: 'Scheduling a demo requires date/time, timezone, and attendees.' };
      }
    }
    if (targetStage === 'On hold') {
      if (!nextCloseReason || !nextRevisit || !isFutureDate(nextRevisit)) {
        return { ok: false, error: 'Putting a lead On hold requires a reason and a future revisit date.' };
      }
    }
    if (targetStage === 'Qualified') {
      if (!isManagerPlus(currentUser.role)) {
        return { ok: false, error: 'Only an authorized Manager or Admin can qualify a lead.' };
      }
      if (!nextQualStep) {
        return { ok: false, error: 'Qualifying a lead requires an agreed next commercial step.' };
      }
    }
    if (targetStage === 'Lost') {
      if (!isManagerPlus(currentUser.role)) {
        return { ok: false, error: 'Only an authorized Manager or Admin can mark a lead Lost.' };
      }
      if (!nextCloseReason) {
        return { ok: false, error: 'Closing a lead as Lost requires a close reason.' };
      }
    }

    const now = new Date().toISOString();
    const updated: Lead = {
      ...existing,
      stage: targetStage,
      demo_scheduled_at: nextDemoAt,
      demo_timezone: nextDemoTz,
      demo_attendees: nextDemoAtt,
      demonstration_status:
        targetStage === 'Demo scheduled'
          ? 'Scheduled'
          : targetStage === 'Demo done'
          ? 'Completed'
          : existing.demonstration_status,
      close_reason: nextCloseReason,
      revisit_date: nextRevisit,
      qualified_next_step: nextQualStep,
      qualified_approved_by: targetStage === 'Qualified' ? currentUser.id : existing.qualified_approved_by,
      outcome_note: details.outcome_note ?? existing.outcome_note,
      updated_at: now,
    };

    const sysLog: Activity = {
      id: uid('act'),
      entity_type: 'lead',
      entity_id: id,
      organization_id: existing.organization_id,
      lead_id: id,
      opportunity_id: null,
      type: 'System',
      summary: `Stage changed from ${existing.stage} to ${targetStage}`,
      details: nextQualStep || nextCloseReason || '',
      occurred_at: now,
      scheduled_at: null,
      duration_minutes: 0,
      timezone: 'UTC',
      location_or_link: '',
      action_type: 'Other',
      is_next_action: false,
      due_date: null,
      status: 'Logged',
      outcome_note: '',
      completed_at: null,
      owner_id: currentUser.id,
      team_id: existing.team_id,
      is_immutable: true,
      related_contact_ids: [],
      double_book_confirmed: false,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = {
        ...prev,
        leads: prev.leads.map((l) => (l.id === id ? updated : l)),
        activities: [sysLog, ...prev.activities],
      };
      appendAudit(next, currentUser, 'LEAD_STAGE_CHANGED', 'lead', id, `${existing.lead_number}: ${existing.stage} -> ${targetStage}`);
      if (existing.owner_id !== currentUser.id) {
        pushNotif(next, existing.owner_id, 'stage', `${existing.lead_number} moved to ${targetStage}`, updated.purpose, 'lead', id);
      }
      return next;
    });
    return { ok: true, data: updated };
  };

  const saveLeadView: CrmContextValue['saveLeadView'] = (name, filters) => {
    if (!currentUser) return { ok: false, error: 'Authentication required.' };
    if (!name.trim()) return { ok: false, error: 'View name is required.' };
    const view: SavedView = {
      id: uid('sv'),
      user_id: currentUser.id,
      entity_type: 'leads',
      name: name.trim(),
      filters,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, savedViews: [view, ...prev.savedViews] }));
    return { ok: true, data: view };
  };

  const deleteLeadView = (id: string) => {
    setState((prev) => ({ ...prev, savedViews: prev.savedViews.filter((v) => v.id !== id) }));
  };

  // --- Activities & Actions ---
  const createActivity: CrmContextValue['createActivity'] = (input) => {
    if (!currentUser || isReadOnlyRole(currentUser.role)) {
      return { ok: false, error: 'Read-only roles cannot log activities or actions.' };
    }
    if (!input.summary.trim()) return { ok: false, error: 'Activity summary is required.' };
    if (input.due_date && isPastDate(input.due_date)) {
      return { ok: false, error: 'Action due date cannot be in the past.' };
    }

    const ownerId = input.owner_id || currentUser.id;
    const ownerUser = state.users.find((u) => u.id === ownerId) || currentUser;

    // Resolve parent org/lead/opp
    let orgId: string | null = null;
    let leadId: string | null = null;
    let oppId: string | null = null;

    if (input.entity_type === 'organization') {
      const o = state.organizations.find((x) => x.id === input.entity_id);
      if (!o || !canAccess(o)) return { ok: false, error: 'Organization unavailable.' };
      orgId = o.id;
    } else if (input.entity_type === 'lead') {
      const l = state.leads.find((x) => x.id === input.entity_id);
      if (!l || !canAccess(l)) return { ok: false, error: 'Lead unavailable.' };
      leadId = l.id;
      orgId = l.organization_id;
    } else if (input.entity_type === 'opportunity') {
      const op = state.opportunities.find((x) => x.id === input.entity_id);
      if (!op || !canAccess(op)) return { ok: false, error: 'Opportunity unavailable.' };
      oppId = op.id;
      orgId = op.organization_id;
    }

    // Calendar conflict check for timed Call, Meeting, Demo
    const duration = input.duration_minutes || 30;
    if (input.scheduled_at && ['Call', 'Meeting', 'Demo'].includes(input.type) && !input.doubleBookConfirmed) {
      const startMs = new Date(input.scheduled_at).getTime();
      const endMs = startMs + duration * 60000;
      if (!Number.isNaN(startMs)) {
        const conflicts = state.activities.filter((a) => {
          if (a.owner_id !== ownerId || !a.scheduled_at || a.status === 'Cancelled') return false;
          const aStart = new Date(a.scheduled_at).getTime();
          const aEnd = aStart + (a.duration_minutes || 30) * 60000;
          return startMs < aEnd && endMs > aStart;
        });
        if (conflicts.length > 0) {
          return {
            ok: false,
            code: 'CALENDAR_CONFLICT',
            error: `Owner has ${conflicts.length} overlapping calendar item(s) at that time. Confirm double-booking to proceed.`,
            conflicts: conflicts.map((c) => ({
              id: c.id,
              summary: canAccess(c) ? c.summary : 'Busy (scheduled commitment)',
              scheduled_at: c.scheduled_at || '',
              duration_minutes: c.duration_minutes,
            })),
          };
        }
      }
    }

    const now = new Date().toISOString();
    const isAction = Boolean(input.is_next_action || input.due_date);
    const act: Activity = {
      id: uid('act'),
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      organization_id: orgId,
      lead_id: leadId,
      opportunity_id: oppId,
      type: input.type,
      summary: input.summary.trim(),
      details: (input.details || '').trim(),
      occurred_at: now,
      scheduled_at: input.scheduled_at || null,
      duration_minutes: duration,
      timezone: input.timezone || 'UTC',
      location_or_link: (input.location_or_link || '').trim(),
      action_type: input.action_type || 'Other',
      is_next_action: Boolean(input.is_next_action),
      due_date: input.due_date || null,
      status: isAction ? 'Open' : 'Logged',
      outcome_note: '',
      completed_at: null,
      owner_id: ownerUser.id,
      team_id: ownerUser.team_id,
      is_immutable: input.type === 'Message' || input.type === 'System',
      related_contact_ids: input.related_contact_ids || [],
      double_book_confirmed: Boolean(input.doubleBookConfirmed),
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      // If setting as primary next action, demote existing open primary next actions on the same entity
      const mapped = prev.activities.map((a) =>
        input.is_next_action && a.entity_id === input.entity_id && a.is_next_action && a.status === 'Open'
          ? { ...a, is_next_action: false }
          : a
      );
      const next = { ...prev, activities: [act, ...mapped] };
      if (ownerUser.id !== currentUser.id && isAction) {
        pushNotif(next, ownerUser.id, 'action', 'New action assigned', act.summary, input.entity_type, input.entity_id);
      }
      return next;
    });

    return { ok: true, data: act };
  };

  const updateActivity: CrmContextValue['updateActivity'] = (id, patch) => {
    const existing = state.activities.find((a) => a.id === id);
    if (!existing || !currentUser || isReadOnlyRole(currentUser.role)) {
      return { ok: false, error: 'Permission denied or activity not found.' };
    }
    if (existing.is_immutable) {
      return { ok: false, error: 'System and message entries are immutable and cannot be edited.' };
    }
    if (existing.created_by !== currentUser.id && !isAdminPlus(currentUser.role)) {
      return { ok: false, error: 'You may only edit your own activity entries unless you are an Admin.' };
    }
    const updated: Activity = { ...existing, ...patch, updated_at: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      activities: prev.activities.map((a) => (a.id === id ? updated : a)),
    }));
    return { ok: true, data: updated };
  };

  const completeAction: CrmContextValue['completeAction'] = (activityId, outcomeNote, followUp) => {
    const existing = state.activities.find((a) => a.id === activityId);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or action not found.' };
    }
    if (!outcomeNote.trim()) {
      return { ok: false, error: 'Completing an action requires an outcome note.' };
    }
    if (followUp && (!followUp.summary.trim() || !followUp.due_date || isPastDate(followUp.due_date))) {
      return { ok: false, error: 'Next action requires summary and a non-past due date.' };
    }

    const now = new Date().toISOString();
    setState((prev) => {
      let updatedActivities = prev.activities.map((a) =>
        a.id === activityId
          ? {
              ...a,
              status: 'Completed' as const,
              is_next_action: false,
              outcome_note: outcomeNote.trim(),
              completed_at: now,
              updated_at: now,
            }
          : a
      );

      if (followUp) {
        const owner = prev.users.find((u) => u.id === followUp.owner_id) || currentUser;
        const newAct: Activity = {
          id: uid('act'),
          entity_type: existing.entity_type,
          entity_id: existing.entity_id,
          organization_id: existing.organization_id,
          lead_id: existing.lead_id,
          opportunity_id: existing.opportunity_id,
          type: followUp.action_type === 'Call' || followUp.action_type === 'Email' || followUp.action_type === 'Meeting' || followUp.action_type === 'Demo' ? followUp.action_type : 'Note',
          summary: followUp.summary.trim(),
          details: '',
          occurred_at: now,
          scheduled_at: null,
          duration_minutes: 30,
          timezone: 'UTC',
          location_or_link: '',
          action_type: followUp.action_type,
          is_next_action: true,
          due_date: followUp.due_date,
          status: 'Open',
          outcome_note: '',
          completed_at: null,
          owner_id: owner.id,
          team_id: owner.team_id,
          is_immutable: false,
          related_contact_ids: existing.related_contact_ids,
          double_book_confirmed: false,
          created_by: currentUser.id,
          created_at: now,
          updated_at: now,
        };
        updatedActivities = [newAct, ...updatedActivities];
      } else {
        // Promote earliest open planned activity on same entity
        const candidates = updatedActivities
          .filter((a) => a.entity_id === existing.entity_id && a.status === 'Open')
          .sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'));
        if (candidates.length > 0) {
          const promoteId = candidates[0].id;
          updatedActivities = updatedActivities.map((a) =>
            a.id === promoteId ? { ...a, is_next_action: true } : a
          );
        }
      }

      const next = { ...prev, activities: updatedActivities };
      appendAudit(next, currentUser, 'ACTION_COMPLETED', existing.entity_type, existing.entity_id, `Completed action: ${existing.summary}`);
      return next;
    });

    return { ok: true };
  };

  // --- Opportunities ---
  const createOpportunityFromLead: CrmContextValue['createOpportunityFromLead'] = (leadId, input) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || !currentUser || !canEdit(lead)) {
      return { ok: false, error: 'Permission denied or lead not found.' };
    }
    if (lead.stage !== 'Qualified') {
      return { ok: false, error: 'An opportunity can only be created from a Qualified lead.' };
    }
    if (state.opportunities.some((o) => o.lead_id === leadId)) {
      return { ok: false, error: 'This qualified lead already has an opportunity.' };
    }
    if (!input.title.trim() || !input.next_step.trim() || !input.next_step_due_date) {
      return { ok: false, error: 'Title, next step, and due date are required.' };
    }

    const now = new Date().toISOString();
    const prob = OPP_STAGE_PROBABILITY.Discovery;
    const val = Math.max(0, Math.round(input.estimated_value_cents));
    const opp: Opportunity = {
      id: uid('opp'),
      opp_number: formatSeq('OPP', state.sequences.opportunity),
      title: input.title.trim(),
      lead_id: lead.id,
      organization_id: lead.organization_id,
      primary_contact_id: lead.primary_contact_id,
      owner_id: lead.owner_id,
      team_id: lead.team_id,
      stage: 'Discovery',
      estimated_value_cents: val,
      probability: prob,
      weighted_value_cents: Math.round((val * prob) / 100),
      expected_close_date: input.expected_close_date || null,
      next_step: input.next_step.trim(),
      next_step_due_date: input.next_step_due_date,
      description: (input.description || '').trim(),
      close_reason: '',
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const sysLog: Activity = {
      id: uid('act'),
      entity_type: 'opportunity',
      entity_id: opp.id,
      organization_id: opp.organization_id,
      lead_id: lead.id,
      opportunity_id: opp.id,
      type: 'System',
      summary: `Opportunity ${opp.opp_number} created from ${lead.lead_number}`,
      details: `Initial stage: Discovery (${prob}%)`,
      occurred_at: now,
      scheduled_at: null,
      duration_minutes: 0,
      timezone: 'UTC',
      location_or_link: '',
      action_type: 'Other',
      is_next_action: false,
      due_date: null,
      status: 'Logged',
      outcome_note: '',
      completed_at: null,
      owner_id: currentUser.id,
      team_id: opp.team_id,
      is_immutable: true,
      related_contact_ids: [],
      double_book_confirmed: false,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = {
        ...prev,
        sequences: { ...prev.sequences, opportunity: prev.sequences.opportunity + 1 },
        opportunities: [opp, ...prev.opportunities],
        activities: [sysLog, ...prev.activities],
      };
      appendAudit(next, currentUser, 'OPP_CREATED', 'opportunity', opp.id, `Created ${opp.opp_number} (${opp.title}) from ${lead.lead_number}`);
      return next;
    });
    return { ok: true, data: opp };
  };

  const updateOpportunity: CrmContextValue['updateOpportunity'] = (id, patch) => {
    const existing = state.opportunities.find((o) => o.id === id);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or opportunity not found.' };
    }

    if (existing.stage === 'Lost' && patch.stage && patch.stage !== 'Lost' && !isManagerPlus(currentUser.role)) {
      return { ok: false, error: 'Only an authorized Manager or Admin can reopen a Lost opportunity.' };
    }
    if (patch.stage === 'Won' && existing.stage !== 'Won') {
      return { ok: false, error: 'Only order creation from an accepted quote can mark an opportunity Won.' };
    }
    if (patch.stage === 'Lost' && !(patch.close_reason || existing.close_reason).trim()) {
      return { ok: false, error: 'A close reason is required when marking an opportunity Lost.' };
    }

    const nextStage = patch.stage ?? existing.stage;
    const stageChanged = nextStage !== existing.stage;
    const nextProb = stageChanged
      ? OPP_STAGE_PROBABILITY[nextStage]
      : patch.probability !== undefined
      ? Math.max(0, Math.min(100, Math.round(patch.probability)))
      : existing.probability;
    const nextVal = patch.estimated_value_cents !== undefined ? Math.max(0, Math.round(patch.estimated_value_cents)) : existing.estimated_value_cents;
    const weighted = Math.round((nextVal * nextProb) / 100);
    const now = new Date().toISOString();

    const updated: Opportunity = {
      ...existing,
      title: patch.title !== undefined ? patch.title.trim() : existing.title,
      stage: nextStage,
      estimated_value_cents: nextVal,
      probability: nextProb,
      weighted_value_cents: weighted,
      expected_close_date: patch.expected_close_date !== undefined ? patch.expected_close_date : existing.expected_close_date,
      next_step: patch.next_step !== undefined ? patch.next_step.trim() : existing.next_step,
      next_step_due_date: patch.next_step_due_date !== undefined ? patch.next_step_due_date : existing.next_step_due_date,
      description: patch.description !== undefined ? patch.description.trim() : existing.description,
      close_reason: patch.close_reason !== undefined ? patch.close_reason.trim() : existing.close_reason,
      owner_id: patch.owner_id ?? existing.owner_id,
      updated_at: now,
    };

    const logs: Activity[] = [];
    if (stageChanged || nextVal !== existing.estimated_value_cents) {
      logs.push({
        id: uid('act'),
        entity_type: 'opportunity',
        entity_id: id,
        organization_id: existing.organization_id,
        lead_id: existing.lead_id,
        opportunity_id: id,
        type: 'System',
        summary: stageChanged
          ? `Stage updated: ${existing.stage} -> ${nextStage} (${nextProb}%)`
          : `Estimated value updated to $${(nextVal / 100).toLocaleString()}`,
        details: updated.close_reason || '',
        occurred_at: now,
        scheduled_at: null,
        duration_minutes: 0,
        timezone: 'UTC',
        location_or_link: '',
        action_type: 'Other',
        is_next_action: false,
        due_date: null,
        status: 'Logged',
        outcome_note: '',
        completed_at: null,
        owner_id: currentUser.id,
        team_id: existing.team_id,
        is_immutable: true,
        related_contact_ids: [],
        double_book_confirmed: false,
        created_by: currentUser.id,
        created_at: now,
        updated_at: now,
      });
    }

    setState((prev) => {
      const next = {
        ...prev,
        opportunities: prev.opportunities.map((o) => (o.id === id ? updated : o)),
        activities: [...logs, ...prev.activities],
      };
      appendAudit(next, currentUser, 'OPP_UPDATED', 'opportunity', id, `Updated ${existing.opp_number} (${updated.stage})`);
      return next;
    });
    return { ok: true, data: updated };
  };

  // --- Products ---
  const createProduct: CrmContextValue['createProduct'] = (input) => {
    if (!canManageProducts(currentUser) || !currentUser) {
      return { ok: false, error: 'Only Admin or Super Admin roles can manage products.' };
    }
    const sku = input.sku.trim().toUpperCase();
    if (!sku || !input.name.trim()) return { ok: false, error: 'SKU and product name are required.' };
    if (state.products.some((p) => p.sku.toUpperCase() === sku)) {
      return { ok: false, error: `A product with SKU "${sku}" already exists.` };
    }
    const now = new Date().toISOString();
    const product: Product = {
      id: uid('prod'),
      sku,
      name: input.name.trim(),
      description: input.description.trim(),
      unit: input.unit.trim() || 'Unit',
      unit_price_cents: Math.max(0, Math.round(input.unit_price_cents)),
      is_active: true,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };
    setState((prev) => {
      const next = { ...prev, products: [product, ...prev.products] };
      appendAudit(next, currentUser, 'PRODUCT_CREATED', 'product', product.id, `Created product ${product.sku} — ${product.name}`);
      return next;
    });
    return { ok: true, data: product };
  };

  const updateProduct: CrmContextValue['updateProduct'] = (id, patch) => {
    if (!canManageProducts(currentUser) || !currentUser) {
      return { ok: false, error: 'Only Admin or Super Admin roles can edit products.' };
    }
    const existing = state.products.find((p) => p.id === id);
    if (!existing) return { ok: false, error: 'Product not found.' };
    const updated: Product = { ...existing, ...patch, updated_at: new Date().toISOString() };
    setState((prev) => {
      const next = { ...prev, products: prev.products.map((p) => (p.id === id ? updated : p)) };
      appendAudit(next, currentUser, 'PRODUCT_UPDATED', 'product', id, `Updated product ${updated.sku} (snapshot history preserved)`);
      return next;
    });
    return { ok: true, data: updated };
  };

  // --- Quotes ---
  const buildSnapshotLines = (
    rawLines: Array<{
      product_id: string | null;
      description: string;
      quantity_thousandths: number;
      unit: string;
      unit_price_cents: number;
      discount_cents: number;
    }>
  ): { ok: true; lines: QuoteLine[]; subtotal: number; discountTotal: number; total: number } | { ok: false; error: string } => {
    if (rawLines.length > 100) return { ok: false, error: 'A quote may have at most 100 lines.' };
    const lines: QuoteLine[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    let total = 0;

    for (const rl of rawLines) {
      let skuSnap = '';
      let nameSnap = '';
      if (rl.product_id) {
        const prod = state.products.find((p) => p.id === rl.product_id);
        if (!prod) return { ok: false, error: 'Referenced product does not exist.' };
        if (!prod.is_active) return { ok: false, error: `Inactive product "${prod.name}" cannot be used on new quotes.` };
        skuSnap = prod.sku;
        nameSnap = prod.name;
      }
      const qty = Math.max(1, Math.round(rl.quantity_thousandths));
      const price = Math.max(0, Math.round(rl.unit_price_cents));
      const disc = Math.max(0, Math.round(rl.discount_cents));
      const gross = Math.round((qty * price) / 1000);
      if (disc > gross) return { ok: false, error: 'Line discount cannot exceed gross line amount.' };
      const lineTotal = calcLineTotalCents(qty, price, disc);
      subtotal += gross;
      discountTotal += disc;
      total += lineTotal;
      lines.push({
        id: uid('ql'),
        product_id: rl.product_id,
        sku_snapshot: skuSnap,
        product_name_snapshot: nameSnap,
        description: rl.description.trim() || nameSnap || 'Line item',
        quantity_thousandths: qty,
        unit: rl.unit.trim() || 'Unit',
        unit_price_cents: price,
        discount_cents: disc,
        line_total_cents: lineTotal,
      });
    }
    return { ok: true, lines, subtotal, discountTotal, total };
  };

  const createQuote: CrmContextValue['createQuote'] = (input) => {
    const opp = state.opportunities.find((o) => o.id === input.opportunity_id);
    if (!opp || !currentUser || !canEdit(opp)) {
      return { ok: false, error: 'Permission denied or opportunity not found.' };
    }
    if (opp.stage === 'Won' || opp.stage === 'Lost') {
      return { ok: false, error: 'Quotes can only be created on open opportunities.' };
    }
    const org = state.organizations.find((o) => o.id === opp.organization_id);
    const contact = state.contacts.find((c) => c.id === input.contact_id);
    if (!org || !contact) return { ok: false, error: 'Valid organization and contact required.' };

    const built = buildSnapshotLines(input.lines);
    if (!built.ok) return { ok: false, error: built.error };

    const now = new Date().toISOString();
    const quote: Quote = {
      id: uid('qt'),
      quote_number: formatSeq('QT', state.sequences.quote),
      opportunity_id: opp.id,
      organization_id: org.id,
      contact_id: contact.id,
      org_snapshot: {
        name: org.name,
        legal_name: org.legal_name,
        country: org.country,
        city_region: org.city_region,
        billing_address: org.billing_address,
      },
      contact_snapshot: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        work_email: contact.work_email,
        personal_email: contact.personal_email,
        phone: contact.normalized_phone || contact.phone,
      },
      status: 'Draft',
      valid_until: input.valid_until || addDaysIso(todayIso(), 30),
      notes_terms: (input.notes_terms || '').trim(),
      lines: built.lines,
      subtotal_cents: built.subtotal,
      discount_total_cents: built.discountTotal,
      total_cents: built.total,
      sent_at: null,
      accepted_at: null,
      declined_at: null,
      decline_reason: '',
      revised_from_quote_id: null,
      owner_id: opp.owner_id,
      team_id: opp.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = {
        ...prev,
        sequences: { ...prev.sequences, quote: prev.sequences.quote + 1 },
        quotes: [quote, ...prev.quotes],
      };
      appendAudit(next, currentUser, 'QUOTE_CREATED', 'quote', quote.id, `Created draft quote ${quote.quote_number} on ${opp.opp_number}`);
      return next;
    });
    return { ok: true, data: quote };
  };

  const updateQuote: CrmContextValue['updateQuote'] = (id, patch) => {
    const existing = state.quotes.find((q) => q.id === id);
    if (!existing || !currentUser || !canEdit(existing)) {
      return { ok: false, error: 'Permission denied or quote not found.' };
    }
    if (existing.status !== 'Draft') {
      return { ok: false, error: 'Only Draft quotes can be edited. Revise the quote to create a new draft.' };
    }
    const contact = state.contacts.find((c) => c.id === patch.contact_id);
    if (!contact) return { ok: false, error: 'Valid contact required.' };

    const built = buildSnapshotLines(patch.lines);
    if (!built.ok) return { ok: false, error: built.error };

    const updated: Quote = {
      ...existing,
      contact_id: contact.id,
      contact_snapshot: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        work_email: contact.work_email,
        personal_email: contact.personal_email,
        phone: contact.normalized_phone || contact.phone,
      },
      valid_until: patch.valid_until,
      notes_terms: patch.notes_terms.trim(),
      lines: built.lines,
      subtotal_cents: built.subtotal,
      discount_total_cents: built.discountTotal,
      total_cents: built.total,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => {
      const next = { ...prev, quotes: prev.quotes.map((q) => (q.id === id ? updated : q)) };
      appendAudit(next, currentUser, 'QUOTE_UPDATED', 'quote', id, `Updated draft quote ${updated.quote_number}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const markQuoteSent: CrmContextValue['markQuoteSent'] = (id) => {
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !currentUser || !canEdit(q)) return { ok: false, error: 'Permission denied or quote not found.' };
    if (q.status !== 'Draft') return { ok: false, error: 'Only Draft quotes can be marked Sent.' };
    if (q.lines.length === 0 || q.total_cents <= 0) {
      return { ok: false, error: 'Quote must have at least one line and a total above zero before marking Sent.' };
    }
    if (!q.contact_id || !q.valid_until || isPastDate(q.valid_until)) {
      return { ok: false, error: 'Quote must have a contact and a valid-until date of today or later.' };
    }

    const now = new Date().toISOString();
    const updated: Quote = { ...q, status: 'Sent', sent_at: now, updated_at: now };
    setState((prev) => {
      const next = { ...prev, quotes: prev.quotes.map((x) => (x.id === id ? updated : x)) };
      appendAudit(next, currentUser, 'QUOTE_MARKED_SENT', 'quote', id, `Marked ${q.quote_number} as Sent (locked; no email dispatched)`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const recordQuoteDecision: CrmContextValue['recordQuoteDecision'] = (id, decision, declineReason = '') => {
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !currentUser || !canEdit(q)) return { ok: false, error: 'Permission denied or quote not found.' };
    if (q.status !== 'Sent') return { ok: false, error: 'Only Sent quotes can record a customer decision.' };

    if (decision === 'Accepted' && isPastDate(q.valid_until)) {
      return { ok: false, error: `Quote ${q.quote_number} expired on ${q.valid_until} and cannot be accepted. Create a revision instead.` };
    }

    const now = new Date().toISOString();
    const updated: Quote = {
      ...q,
      status: decision,
      accepted_at: decision === 'Accepted' ? now : null,
      declined_at: decision === 'Declined' ? now : null,
      decline_reason: decision === 'Declined' ? declineReason.trim() : '',
      updated_at: now,
    };

    setState((prev) => {
      const next = { ...prev, quotes: prev.quotes.map((x) => (x.id === id ? updated : x)) };
      appendAudit(next, currentUser, `QUOTE_${decision.toUpperCase()}`, 'quote', id, `Recorded ${decision} on ${q.quote_number}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const reviseQuote: CrmContextValue['reviseQuote'] = (id) => {
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !currentUser || !canEdit(q)) return { ok: false, error: 'Permission denied or quote not found.' };
    const hasLiveOrder = state.orders.some((o) => o.quote_id === id && o.status === 'Active');
    if (hasLiveOrder) return { ok: false, error: 'Cannot revise a quote that already has an active order.' };

    const now = new Date().toISOString();
    const rev: Quote = {
      ...q,
      id: uid('qt'),
      quote_number: formatSeq('QT', state.sequences.quote),
      status: 'Draft',
      valid_until: addDaysIso(todayIso(), 30),
      lines: q.lines.map((l) => ({ ...l, id: uid('ql') })),
      sent_at: null,
      accepted_at: null,
      declined_at: null,
      decline_reason: '',
      revised_from_quote_id: q.id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = {
        ...prev,
        sequences: { ...prev.sequences, quote: prev.sequences.quote + 1 },
        quotes: [rev, ...prev.quotes.map((x) => (x.id === id && x.status === 'Sent' ? { ...x, status: 'Revised' as const } : x))],
      };
      appendAudit(next, currentUser, 'QUOTE_REVISED', 'quote', rev.id, `Created revision ${rev.quote_number} from ${q.quote_number}`);
      return next;
    });
    return { ok: true, data: rev };
  };

  const deleteQuote: CrmContextValue['deleteQuote'] = (id) => {
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !currentUser || !canEdit(q)) return { ok: false, error: 'Permission denied or quote not found.' };
    if (state.orders.some((o) => o.quote_id === id)) {
      return { ok: false, error: 'Cannot delete a quote that has an associated order.' };
    }
    setState((prev) => {
      const next = { ...prev, quotes: prev.quotes.filter((x) => x.id !== id) };
      appendAudit(next, currentUser, 'QUOTE_DELETED', 'quote', id, `Deleted quote ${q.quote_number}`);
      return next;
    });
    return { ok: true };
  };

  // --- Orders ---
  const createOrderFromQuote: CrmContextValue['createOrderFromQuote'] = (quoteId) => {
    const q = state.quotes.find((x) => x.id === quoteId);
    if (!q || !currentUser || !canEdit(q)) return { ok: false, error: 'Permission denied or quote not found.' };
    if (q.status !== 'Accepted') return { ok: false, error: 'An order can only be created from an Accepted quote.' };

    // Idempotent guard against double-click
    const existingOrder = state.orders.find((o) => o.quote_id === quoteId);
    if (existingOrder) {
      return { ok: false, error: `Order ${existingOrder.order_number} has already been created for this quote.` };
    }

    const now = new Date().toISOString();
    const order: Order = {
      id: uid('ord'),
      order_number: formatSeq('ORD', state.sequences.order),
      quote_id: q.id,
      opportunity_id: q.opportunity_id,
      organization_id: q.organization_id,
      contact_id: q.contact_id,
      org_snapshot: q.org_snapshot,
      contact_snapshot: q.contact_snapshot,
      lines_snapshot: q.lines,
      notes_terms: q.notes_terms,
      total_cents: q.total_cents,
      status: 'Active',
      cancel_reason: '',
      cancelled_at: null,
      cancelled_by: null,
      owner_id: q.owner_id,
      team_id: q.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const sysLog: Activity = {
      id: uid('act'),
      entity_type: 'opportunity',
      entity_id: q.opportunity_id,
      organization_id: q.organization_id,
      lead_id: null,
      opportunity_id: q.opportunity_id,
      type: 'System',
      summary: `Order ${order.order_number} created — Opportunity marked Won`,
      details: `Order total: $${(order.total_cents / 100).toLocaleString()}`,
      occurred_at: now,
      scheduled_at: null,
      duration_minutes: 0,
      timezone: 'UTC',
      location_or_link: '',
      action_type: 'Other',
      is_next_action: false,
      due_date: null,
      status: 'Logged',
      outcome_note: '',
      completed_at: null,
      owner_id: currentUser.id,
      team_id: q.team_id,
      is_immutable: true,
      related_contact_ids: [],
      double_book_confirmed: false,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      if (prev.orders.some((o) => o.quote_id === quoteId)) return prev;
      const next = {
        ...prev,
        sequences: { ...prev.sequences, order: prev.sequences.order + 1 },
        orders: [order, ...prev.orders],
        opportunities: prev.opportunities.map((o) =>
          o.id === q.opportunity_id
            ? {
                ...o,
                stage: 'Won' as const,
                probability: 100,
                estimated_value_cents: order.total_cents,
                weighted_value_cents: order.total_cents,
                updated_at: now,
              }
            : o
        ),
        activities: [sysLog, ...prev.activities],
      };
      appendAudit(next, currentUser, 'ORDER_CREATED', 'order', order.id, `Created ${order.order_number} from ${q.quote_number}; opportunity marked Won`);
      return next;
    });
    return { ok: true, data: order };
  };

  const cancelOrder: CrmContextValue['cancelOrder'] = (orderId, reason) => {
    const ord = state.orders.find((o) => o.id === orderId);
    if (!ord || !currentUser || !canEdit(ord)) return { ok: false, error: 'Permission denied or order not found.' };
    if (ord.status === 'Cancelled') return { ok: false, error: 'Order is already cancelled.' };
    if (!reason.trim()) return { ok: false, error: 'A cancellation reason is required.' };

    const blockingInvoices = state.invoices.some((i) => i.order_id === orderId && i.status !== 'Void');
    if (blockingInvoices) {
      return { ok: false, error: 'Cannot cancel order while active (non-void) invoices exist. Void unpaid invoices first.' };
    }

    const now = new Date().toISOString();
    const updated: Order = {
      ...ord,
      status: 'Cancelled',
      cancel_reason: reason.trim(),
      cancelled_at: now,
      cancelled_by: currentUser.id,
      updated_at: now,
    };

    setState((prev) => {
      const otherActiveOrders = prev.orders.some(
        (o) => o.id !== orderId && o.opportunity_id === ord.opportunity_id && o.status === 'Active'
      );
      const next = {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updated : o)),
        opportunities: prev.opportunities.map((opp) =>
          opp.id === ord.opportunity_id && !otherActiveOrders
            ? {
                ...opp,
                stage: 'Negotiation' as const,
                probability: 70,
                weighted_value_cents: Math.round((opp.estimated_value_cents * 70) / 100),
                updated_at: now,
              }
            : opp
        ),
      };
      appendAudit(next, currentUser, 'ORDER_CANCELLED', 'order', orderId, `Cancelled ${ord.order_number}: ${reason.trim()}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  // --- Invoices & Payments ---
  const createDraftInvoiceFromOrder: CrmContextValue['createDraftInvoiceFromOrder'] = (orderId) => {
    const ord = state.orders.find((o) => o.id === orderId);
    if (!ord || !currentUser || !canEdit(ord)) return { ok: false, error: 'Permission denied or order not found.' };
    if (ord.status !== 'Active') return { ok: false, error: 'Invoices can only be created for Active orders.' };
    const existingInv = state.invoices.find((i) => i.order_id === orderId && i.status !== 'Void');
    if (existingInv) {
      return { ok: false, error: 'This order already has an active or draft invoice.' };
    }

    const org = state.organizations.find((o) => o.id === ord.organization_id);
    const now = new Date().toISOString();
    const terms = state.settings.payment_terms_days || 30;
    const inv: Invoice = {
      id: uid('inv'),
      invoice_number: null, // Allocated only when issued
      order_id: ord.id,
      organization_id: ord.organization_id,
      contact_id: ord.contact_id,
      org_snapshot: { ...ord.org_snapshot, tax_registration_number: org?.tax_registration_number || '' },
      contact_snapshot: ord.contact_snapshot,
      lines_snapshot: ord.lines_snapshot,
      status: 'Draft',
      currency: state.settings.currency || 'USD',
      issue_date: null,
      due_date: addDaysIso(todayIso(), terms),
      total_cents: ord.total_cents,
      amount_paid_cents: 0,
      balance_due_cents: ord.total_cents,
      payment_terms_days: terms,
      notes: ord.notes_terms,
      void_reason: '',
      voided_at: null,
      voided_by: null,
      owner_id: ord.owner_id,
      team_id: ord.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next = { ...prev, invoices: [inv, ...prev.invoices] };
      appendAudit(next, currentUser, 'INVOICE_DRAFT_CREATED', 'invoice', inv.id, `Created draft invoice for ${ord.order_number}`);
      return next;
    });
    return { ok: true, data: inv };
  };

  const updateDraftInvoice: CrmContextValue['updateDraftInvoice'] = (id, patch) => {
    const inv = state.invoices.find((i) => i.id === id);
    if (!inv || !currentUser || !canEdit(inv)) return { ok: false, error: 'Permission denied or invoice not found.' };
    if (inv.status !== 'Draft') return { ok: false, error: 'Only Draft invoices can be edited.' };
    const updated: Invoice = { ...inv, due_date: patch.due_date, notes: patch.notes.trim(), updated_at: new Date().toISOString() };
    setState((prev) => ({ ...prev, invoices: prev.invoices.map((i) => (i.id === id ? updated : i)) }));
    return { ok: true, data: updated };
  };

  const issueInvoice: CrmContextValue['issueInvoice'] = (id) => {
    const inv = state.invoices.find((i) => i.id === id);
    if (!inv || !currentUser || !canAccess(inv)) return { ok: false, error: 'Invoice not found.' };
    if (!isManagerPlus(currentUser.role)) return { ok: false, error: 'Only an authorized Manager or Admin can issue invoices.' };
    if (inv.status !== 'Draft') return { ok: false, error: 'Only Draft invoices can be issued.' };

    const invNum = formatSeq('INV', state.sequences.invoice, true);
    const now = new Date().toISOString();
    const issueDate = todayIso();
    const updated: Invoice = {
      ...inv,
      invoice_number: invNum,
      status: 'Issued',
      issue_date: issueDate,
      due_date: inv.due_date || addDaysIso(issueDate, inv.payment_terms_days || 30),
      updated_at: now,
    };

    setState((prev) => {
      const next = {
        ...prev,
        sequences: { ...prev.sequences, invoice: prev.sequences.invoice + 1 },
        invoices: prev.invoices.map((i) => (i.id === id ? updated : i)),
      };
      appendAudit(next, currentUser, 'INVOICE_ISSUED', 'invoice', id, `Issued invoice ${invNum} ($${(inv.total_cents / 100).toLocaleString()})`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const voidInvoice: CrmContextValue['voidInvoice'] = (id, reason) => {
    const inv = state.invoices.find((i) => i.id === id);
    if (!inv || !currentUser || !canAccess(inv)) return { ok: false, error: 'Invoice not found.' };
    if (!isManagerPlus(currentUser.role)) return { ok: false, error: 'Only an authorized Manager or Admin can void invoices.' };
    if (!reason.trim()) return { ok: false, error: 'A void reason is required.' };
    if (inv.status !== 'Issued') return { ok: false, error: 'Only Issued invoices can be voided (delete Drafts instead if needed).' };
    if (inv.amount_paid_cents > 0) return { ok: false, error: 'Cannot void an invoice that has recorded payments. Reverse payments first.' };

    const now = new Date().toISOString();
    const updated: Invoice = {
      ...inv,
      status: 'Void',
      balance_due_cents: 0,
      void_reason: reason.trim(),
      voided_at: now,
      voided_by: currentUser.id,
      updated_at: now,
    };
    setState((prev) => {
      const next = { ...prev, invoices: prev.invoices.map((i) => (i.id === id ? updated : i)) };
      appendAudit(next, currentUser, 'INVOICE_VOIDED', 'invoice', id, `Voided ${inv.invoice_number}: ${reason.trim()}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const recordPayment: CrmContextValue['recordPayment'] = (invoiceId, input) => {
    const inv = state.invoices.find((i) => i.id === invoiceId);
    if (!inv || !currentUser || !canAccess(inv)) return { ok: false, error: 'Invoice not found.' };
    if (!isManagerPlus(currentUser.role)) return { ok: false, error: 'Only an authorized Manager or Admin can record payments.' };
    if (inv.status !== 'Issued' && inv.status !== 'Partially Paid') {
      return { ok: false, error: `Cannot record payment on an invoice with status "${inv.status}".` };
    }
    const amt = Math.round(input.amount_cents);
    if (amt <= 0) return { ok: false, error: 'Payment amount must be greater than zero.' };
    if (amt > inv.balance_due_cents) {
      return { ok: false, error: `Payment exceeds current balance due ($${(inv.balance_due_cents / 100).toFixed(2)}).` };
    }
    if (!input.payment_date || isFutureDate(input.payment_date)) {
      return { ok: false, error: 'Payment date cannot be in the future.' };
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: uid('pay'),
      invoice_id: inv.id,
      order_id: inv.order_id,
      organization_id: inv.organization_id,
      amount_cents: amt,
      payment_date: input.payment_date,
      method: input.method,
      reference: (input.reference || '').trim(),
      status: 'Valid',
      reversed_at: null,
      reversed_by: null,
      reversal_reason: '',
      owner_id: inv.owner_id,
      team_id: inv.team_id,
      recorded_by: currentUser.id,
      created_at: now,
    };

    const newPaid = inv.amount_paid_cents + amt;
    const newBal = Math.max(0, inv.total_cents - newPaid);
    const newStatus: Invoice['status'] = newBal === 0 ? 'Paid' : 'Partially Paid';

    setState((prev) => {
      const next = {
        ...prev,
        payments: [payment, ...prev.payments],
        invoices: prev.invoices.map((i) =>
          i.id === invoiceId
            ? { ...i, amount_paid_cents: newPaid, balance_due_cents: newBal, status: newStatus, updated_at: now }
            : i
        ),
      };
      appendAudit(
        next,
        currentUser,
        'PAYMENT_RECORDED',
        'invoice',
        inv.id,
        `Recorded $${(amt / 100).toFixed(2)} (${input.method}) on ${inv.invoice_number}`
      );
      return next;
    });
    return { ok: true, data: payment };
  };

  const reversePayment: CrmContextValue['reversePayment'] = (paymentId, reason) => {
    const pay = state.payments.find((p) => p.id === paymentId);
    if (!pay || !currentUser || !canAccess(pay)) return { ok: false, error: 'Payment not found.' };
    if (!isManagerPlus(currentUser.role)) return { ok: false, error: 'Only an authorized Manager or Admin can reverse payments.' };
    if (pay.status === 'Reversed') return { ok: false, error: 'Payment is already reversed.' };
    if (!reason.trim()) return { ok: false, error: 'A reversal reason is required.' };

    const inv = state.invoices.find((i) => i.id === pay.invoice_id);
    if (!inv) return { ok: false, error: 'Associated invoice not found.' };

    const now = new Date().toISOString();
    const reversed: Payment = {
      ...pay,
      status: 'Reversed',
      reversed_at: now,
      reversed_by: currentUser.id,
      reversal_reason: reason.trim(),
    };

    const newPaid = Math.max(0, inv.amount_paid_cents - pay.amount_cents);
    const newBal = Math.max(0, inv.total_cents - newPaid);
    const newStatus: Invoice['status'] = newPaid === 0 ? 'Issued' : 'Partially Paid';

    setState((prev) => {
      const next = {
        ...prev,
        payments: prev.payments.map((p) => (p.id === paymentId ? reversed : p)),
        invoices: prev.invoices.map((i) =>
          i.id === inv.id
            ? { ...i, amount_paid_cents: newPaid, balance_due_cents: newBal, status: newStatus, updated_at: now }
            : i
        ),
      };
      appendAudit(
        next,
        currentUser,
        'PAYMENT_REVERSED',
        'invoice',
        inv.id,
        `Reversed payment $${(pay.amount_cents / 100).toFixed(2)} on ${inv.invoice_number}: ${reason.trim()}`
      );
      return next;
    });
    return { ok: true, data: reversed };
  };

  // --- Enquiries, Notifications, Suggestions, Admin & CSV ---
  const submitWebsiteEnquiry: CrmContextValue['submitWebsiteEnquiry'] = (input) => {
    if (!state.settings.website_enquiries_enabled) {
      return { ok: false, error: 'Website enquiry intake is currently disabled in Launch Settings.' };
    }
    if (!input.org_name.trim() || !input.contact_name.trim() || !input.purpose.trim()) {
      return { ok: false, error: 'Organization, contact name, and purpose are required.' };
    }
    const enq: Enquiry = {
      id: uid('enq'),
      enquiry_type: input.enquiry_type,
      org_name: input.org_name.trim(),
      country: input.country.trim() || 'United States',
      contact_name: input.contact_name.trim(),
      contact_email: input.contact_email.trim(),
      contact_phone: input.contact_phone.trim(),
      purpose: input.purpose.trim(),
      message: input.message.trim(),
      preferred_date: input.preferred_date || null,
      status: 'Pending',
      lead_id: null,
      reviewed_by: null,
      reviewed_at: null,
      review_note: '',
      created_at: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, enquiries: [enq, ...prev.enquiries] };
      const managers = prev.users.filter((u) => u.is_active && isManagerPlus(u.role) && u.role !== 'Partner Admin');
      for (const m of managers) {
        pushNotif(next, m.id, 'enquiry', 'New website enquiry pending review', `${enq.org_name} — ${enq.purpose}`, 'enquiry', enq.id);
      }
      return next;
    });
    return { ok: true, data: enq };
  };

  const approveEnquiry: CrmContextValue['approveEnquiry'] = (enquiryId, reviewNote = '') => {
    if (!currentUser || !canAccessEnquiries(currentUser, state.settings)) {
      return { ok: false, error: 'Permission denied to review enquiries.' };
    }
    const enq = state.enquiries.find((e) => e.id === enquiryId);
    if (!enq || enq.status !== 'Pending') return { ok: false, error: 'Pending enquiry not found.' };

    const now = new Date().toISOString();
    const orgId = uid('org');
    const contactId = uid('cnt');
    const leadId = uid('lead');
    const leadNumber = formatSeq('LD', state.sequences.lead);
    const [first, ...rest] = enq.contact_name.trim().split(/\s+/);
    const last = rest.join(' ') || 'Contact';

    const org: Organization = {
      id: orgId,
      name: enq.org_name,
      normalized_name: normalizeOrgName(enq.org_name),
      org_type: 'Other',
      country: enq.country || 'United States',
      city_region: '',
      website: '',
      notes: enq.message,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      main_phone: enq.contact_phone,
      main_email: enq.contact_email,
      billing_address: '',
      shipping_address: '',
      legal_name: '',
      tax_registration_number: '',
      industry: '',
      org_size: '',
      parent_org_id: null,
      account_status: 'Prospect',
      merged_into_id: null,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const contact: Contact = {
      id: contactId,
      first_name: first,
      last_name: last,
      country: org.country,
      phone: enq.contact_phone,
      normalized_phone: normalizePhone(enq.contact_phone, org.country),
      personal_email: enq.contact_email,
      work_email: enq.contact_email,
      preferred_language: 'English',
      relationship: 'Inbound Enquiry',
      how_known: 'Website Enquiry Form',
      do_not_contact: false,
      consent_basis: 'Direct Inbound Request',
      consent_timestamp: now,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const membership: ContactMembership = {
      id: uid('mem'),
      contact_id: contactId,
      organization_id: orgId,
      designation: 'Enquiry Contact',
      is_active: true,
      started_at: now,
      ended_at: null,
    };

    const lead: Lead = {
      id: leadId,
      lead_number: leadNumber,
      organization_id: orgId,
      primary_contact_id: contactId,
      additional_contact_ids: [],
      lead_type: 'Website Enquiry',
      source: 'Website Form',
      purpose: enq.purpose,
      purpose_details: enq.message,
      relationship: 'Inbound Enquiry',
      how_known: 'Website Enquiry Form',
      language: 'English',
      priority: 'Medium',
      stage: 'Prospect',
      response_status: 'Awaiting response',
      demonstration_status: 'Not yet offered',
      country: org.country,
      approach_date: todayIso(),
      response_date: null,
      demo_scheduled_at: null,
      demo_timezone: '',
      demo_attendees: '',
      demo_notes: '',
      close_reason: '',
      revisit_date: null,
      outcome_note: '',
      qualified_next_step: '',
      qualified_approved_by: null,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const firstAction: Activity = {
      id: uid('act'),
      entity_type: 'lead',
      entity_id: leadId,
      organization_id: orgId,
      lead_id: leadId,
      opportunity_id: null,
      type: 'Email',
      summary: `Respond to website enquiry from ${enq.contact_name}`,
      details: enq.message,
      occurred_at: now,
      scheduled_at: null,
      duration_minutes: 30,
      timezone: 'UTC',
      location_or_link: '',
      action_type: 'Email',
      is_next_action: true,
      due_date: addDaysIso(todayIso(), 1),
      status: 'Open',
      outcome_note: '',
      completed_at: null,
      owner_id: currentUser.id,
      team_id: currentUser.team_id,
      is_immutable: false,
      related_contact_ids: [contactId],
      double_book_confirmed: false,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => {
      const next: CrmDatabaseState = {
        ...prev,
        sequences: { ...prev.sequences, lead: prev.sequences.lead + 1 },
        organizations: [org, ...prev.organizations],
        contacts: [contact, ...prev.contacts],
        contactMemberships: [membership, ...prev.contactMemberships],
        leads: [lead, ...prev.leads],
        activities: [firstAction, ...prev.activities],
        enquiries: prev.enquiries.map((e) =>
          e.id === enquiryId
            ? { ...e, status: 'Approved', lead_id: leadId, reviewed_by: currentUser.id, reviewed_at: now, review_note: reviewNote }
            : e
        ),
      };
      appendAudit(next, currentUser, 'ENQUIRY_APPROVED', 'enquiry', enquiryId, `Approved enquiry ${enq.org_name} -> ${leadNumber}`);
      return next;
    });
    return { ok: true, data: lead };
  };

  const dismissEnquiry: CrmContextValue['dismissEnquiry'] = (enquiryId, reviewNote) => {
    if (!currentUser || !canAccessEnquiries(currentUser, state.settings)) {
      return { ok: false, error: 'Permission denied.' };
    }
    const enq = state.enquiries.find((e) => e.id === enquiryId);
    if (!enq || enq.status !== 'Pending') return { ok: false, error: 'Pending enquiry not found.' };
    const now = new Date().toISOString();
    const updated: Enquiry = {
      ...enq,
      status: 'Dismissed',
      reviewed_by: currentUser.id,
      reviewed_at: now,
      review_note: reviewNote.trim(),
    };
    setState((prev) => {
      const next = { ...prev, enquiries: prev.enquiries.map((e) => (e.id === enquiryId ? updated : e)) };
      appendAudit(next, currentUser, 'ENQUIRY_DISMISSED', 'enquiry', enquiryId, `Dismissed enquiry from ${enq.org_name}`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    }));
  };

  const markAllNotificationsRead = () => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.user_id === currentUser.id ? { ...n, is_read: true } : n)),
    }));
  };

  const setSuggestionStatus: CrmContextValue['setSuggestionStatus'] = (key, status, snoozeDays = 7) => {
    const snoozeUntil = status === 'snoozed' ? addDaysIso(todayIso(), snoozeDays) : null;
    setState((prev) => ({
      ...prev,
      suggestionStates: {
        ...prev.suggestionStates,
        [key]: { suggestion_key: key, status, snooze_until: snoozeUntil },
      },
    }));
  };

  const importOrganizationsCsv: CrmContextValue['importOrganizationsCsv'] = (rows) => {
    if (!currentUser || !isManagerPlus(currentUser.role)) {
      return { ok: false, error: 'Only Manager or Admin roles can run CSV imports.' };
    }
    if (rows.length > 500) {
      return { ok: false, error: 'CSV import is limited to 500 rows per batch.' };
    }
    const skipped: Array<{ row: number; reason: string }> = [];
    const created: Organization[] = [];
    const now = new Date().toISOString();

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;
      const name = (r.name || r.Name || '').trim();
      const country = (r.country || r.Country || '').trim();
      const orgType = ((r.org_type || r.type || 'Other').trim() || 'Other') as OrgType;
      if (!name || !country) {
        skipped.push({ row: rowNum, reason: 'Missing required name or country' });
        return;
      }
      const dup = state.organizations.some(
        (o) => !o.merged_into_id && o.country.toLowerCase() === country.toLowerCase() && normalizeOrgName(o.name) === normalizeOrgName(name)
      );
      if (dup) {
        skipped.push({ row: rowNum, reason: `Duplicate organization "${name}" in ${country}` });
        return;
      }
      created.push({
        id: uid('org'),
        name,
        normalized_name: normalizeOrgName(name),
        org_type: orgType,
        country,
        city_region: (r.city_region || r.city || '').trim(),
        website: (r.website || '').trim(),
        notes: (r.notes || '').trim(),
        owner_id: currentUser.id,
        team_id: currentUser.team_id,
        main_phone: (r.main_phone || '').trim(),
        main_email: (r.main_email || '').trim(),
        billing_address: '',
        shipping_address: '',
        legal_name: '',
        tax_registration_number: '',
        industry: '',
        org_size: '',
        parent_org_id: null,
        account_status: 'Prospect',
        merged_into_id: null,
        created_by: currentUser.id,
        created_at: now,
        updated_at: now,
      });
    });

    setState((prev) => {
      const next = { ...prev, organizations: [...created, ...prev.organizations] };
      appendAudit(next, currentUser, 'CSV_IMPORT', 'organization', 'batch', `Imported ${created.length} organizations (${skipped.length} skipped)`);
      return next;
    });
    return { ok: true, data: { imported: created.length, skipped } };
  };

  const createUser: CrmContextValue['createUser'] = (input) => {
    if (!currentUser || !isAdminPlus(currentUser.role)) {
      return { ok: false, error: 'Only Admin roles can create users.' };
    }
    if (currentUser.role === 'Partner Admin' && input.role !== 'Partner Viewer' && input.role !== 'Partner Admin') {
      return { ok: false, error: 'Partner Admin may only create Partner roles.' };
    }
    if (input.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      return { ok: false, error: 'Only Super Admin can create Super Admin accounts.' };
    }
    const email = input.email.trim().toLowerCase();
    if (!email || !input.name.trim()) return { ok: false, error: 'Name and email are required.' };
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: 'A user with this email already exists.' };
    }
    const user: User = {
      id: uid('usr'),
      name: input.name.trim(),
      email,
      password: input.password || 'demo',
      role: input.role,
      team_id: input.team_id,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, users: [...prev.users, user] };
      appendAudit(next, currentUser, 'USER_CREATED', 'user', user.id, `Created user ${user.email} (${user.role})`);
      return next;
    });
    return { ok: true, data: user };
  };

  const updateUser: CrmContextValue['updateUser'] = (id, patch) => {
    if (!currentUser || !isAdminPlus(currentUser.role)) {
      return { ok: false, error: 'Only Admin roles can update users.' };
    }
    const target = state.users.find((u) => u.id === id);
    if (!target) return { ok: false, error: 'User not found.' };
    if (target.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      return { ok: false, error: 'Only Super Admin can modify a Super Admin account.' };
    }
    if (currentUser.role === 'Partner Admin' && target.team_id !== currentUser.team_id) {
      return { ok: false, error: 'Partner Admin can only manage users within their partner team.' };
    }

    const updated: User = { ...target, ...patch };
    setState((prev) => {
      const next = { ...prev, users: prev.users.map((u) => (u.id === id ? updated : u)) };
      appendAudit(next, currentUser, 'USER_UPDATED', 'user', id, `Updated user ${updated.email} (${updated.role})`);
      return next;
    });
    return { ok: true, data: updated };
  };

  const createTeam: CrmContextValue['createTeam'] = (input) => {
    if (!currentUser || !isOrgWideAdmin(currentUser.role)) {
      return { ok: false, error: 'Only Admin or Super Admin can create teams.' };
    }
    if (!input.name.trim()) return { ok: false, error: 'Team name is required.' };
    const team: Team = {
      id: uid('team'),
      name: input.name.trim(),
      description: input.description.trim(),
      is_partner_team: input.is_partner_team,
      created_at: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, teams: [...prev.teams, team] };
      appendAudit(next, currentUser, 'TEAM_CREATED', 'team', team.id, `Created team ${team.name}`);
      return next;
    });
    return { ok: true, data: team };
  };

  const updateSettings: CrmContextValue['updateSettings'] = (patch) => {
    if (!currentUser || !isOrgWideAdmin(currentUser.role)) {
      return { ok: false, error: 'Only Admin or Super Admin can update launch settings.' };
    }
    const updated: AppSettings = { ...state.settings, ...patch };
    setState((prev) => {
      const next = { ...prev, settings: updated };
      appendAudit(next, currentUser, 'SETTINGS_UPDATED', 'settings', '1', 'Updated workspace launch settings');
      return next;
    });
    return { ok: true, data: updated };
  };

  const recordAuditExport = (reportName: string, rowCount: number) => {
    if (!currentUser) return;
    setState((prev) => {
      const next = { ...prev };
      appendAudit(next, currentUser, 'CSV_EXPORT', 'report', reportName, `Exported ${rowCount} authorized rows from ${reportName}`);
      return next;
    });
  };

  return (
    <CrmContext.Provider
      value={{
        state,
        currentUser,
        visibleOrganizations,
        visibleContacts,
        visibleLeads,
        visibleOpportunities,
        visibleActivities,
        visibleQuotes,
        visibleOrders,
        visibleInvoices,
        visiblePayments,
        visibleNotifications,
        visibleEnquiries,
        canAccess,
        canEdit,
        signIn,
        signInAsUser,
        signOut,
        resetDemoWorkspace,
        createOrganization,
        updateOrganization,
        mergeOrganizations,
        deleteOrganization,
        addOrgFile,
        createContact,
        updateContact,
        addContactMembership,
        removeContactMembership,
        deleteContact,
        createLead,
        updateLead,
        changeLeadStage,
        saveLeadView,
        deleteLeadView,
        createActivity,
        updateActivity,
        completeAction,
        createOpportunityFromLead,
        updateOpportunity,
        createProduct,
        updateProduct,
        createQuote,
        updateQuote,
        markQuoteSent,
        recordQuoteDecision,
        reviseQuote,
        deleteQuote,
        createOrderFromQuote,
        cancelOrder,
        createDraftInvoiceFromOrder,
        updateDraftInvoice,
        issueInvoice,
        voidInvoice,
        recordPayment,
        reversePayment,
        submitWebsiteEnquiry,
        approveEnquiry,
        dismissEnquiry,
        markNotificationRead,
        markAllNotificationsRead,
        setSuggestionStatus,
        importOrganizationsCsv,
        createUser,
        updateUser,
        createTeam,
        updateSettings,
        recordAuditExport,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used inside CrmProvider');
  return ctx;
}
