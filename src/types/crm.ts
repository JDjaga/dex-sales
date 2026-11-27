export type UserRole =
  | 'Viewer'
  | 'Partner Viewer'
  | 'BD User'
  | 'Manager'
  | 'Admin'
  | 'Super Admin'
  | 'Partner Admin';

export interface Team {
  id: string;
  name: string;
  description: string;
  is_partner_team: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password: string; // Demo-only local credential for static preview
  role: UserRole;
  team_id: string | null;
  is_active: boolean;
  created_at: string;
}

export type OrgType =
  | 'Bank'
  | 'Financial Institution'
  | 'Regulator'
  | 'Government Agency'
  | 'University'
  | 'Investor'
  | 'Development Organization'
  | 'Corporate Partner'
  | 'Other';

export interface Organization {
  id: string;
  name: string;
  normalized_name: string;
  org_type: OrgType;
  country: string;
  city_region: string;
  website: string;
  notes: string;
  owner_id: string;
  team_id: string | null;
  main_phone: string;
  main_email: string;
  billing_address: string;
  shipping_address: string;
  legal_name: string;
  tax_registration_number: string;
  industry: string;
  org_size: string;
  parent_org_id: string | null;
  account_status: 'Active' | 'Prospect' | 'On Hold' | 'Inactive';
  merged_into_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMembership {
  id: string;
  contact_id: string;
  organization_id: string;
  designation: string;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  country: string;
  phone: string;
  normalized_phone: string;
  personal_email: string;
  work_email: string;
  preferred_language: string;
  relationship: string;
  how_known: string;
  do_not_contact: boolean;
  consent_basis: string;
  consent_timestamp: string | null;
  owner_id: string;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type LeadStage =
  | 'Prospect'
  | 'Approached'
  | 'Engaged'
  | 'Demo scheduled'
  | 'Demo done'
  | 'On hold'
  | 'Qualified'
  | 'Lost';

export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ResponseStatus =
  | 'Awaiting response'
  | 'Positive response'
  | 'Requested follow-up'
  | 'No response'
  | 'Declined';

export type DemonstrationStatus =
  | 'Not yet offered'
  | 'Offered'
  | 'Scheduled'
  | 'Completed'
  | 'Not required';

export interface Lead {
  id: string;
  lead_number: string;
  organization_id: string;
  primary_contact_id: string;
  additional_contact_ids: string[];
  lead_type: string;
  source: string;
  purpose: string;
  purpose_details: string;
  relationship: string;
  how_known: string;
  language: string;
  priority: LeadPriority;
  stage: LeadStage;
  response_status: ResponseStatus;
  demonstration_status: DemonstrationStatus;
  country: string;
  approach_date: string | null;
  response_date: string | null;
  demo_scheduled_at: string | null;
  demo_timezone: string;
  demo_attendees: string;
  demo_notes: string;
  close_reason: string;
  revisit_date: string | null;
  outcome_note: string;
  qualified_next_step: string;
  qualified_approved_by: string | null;
  owner_id: string;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Demo' | 'Message' | 'Note' | 'System';
export type ActionType = 'Call' | 'Email' | 'Meeting' | 'Demo' | 'Send material' | 'Internal follow-up' | 'Other';

export interface Activity {
  id: string;
  entity_type: 'organization' | 'contact' | 'lead' | 'opportunity';
  entity_id: string;
  organization_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  type: ActivityType;
  summary: string;
  details: string;
  occurred_at: string;
  scheduled_at: string | null;
  duration_minutes: number;
  timezone: string;
  location_or_link: string;
  action_type: ActionType;
  is_next_action: boolean;
  due_date: string | null;
  status: 'Open' | 'Completed' | 'Cancelled' | 'Logged';
  outcome_note: string;
  completed_at: string | null;
  owner_id: string;
  team_id: string | null;
  is_immutable: boolean;
  related_contact_ids: string[];
  double_book_confirmed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type OpportunityStage = 'Discovery' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';

export interface Opportunity {
  id: string;
  opp_number: string;
  title: string;
  lead_id: string;
  organization_id: string;
  primary_contact_id: string;
  owner_id: string;
  team_id: string | null;
  stage: OpportunityStage;
  estimated_value_cents: number;
  probability: number;
  weighted_value_cents: number;
  expected_close_date: string | null;
  next_step: string;
  next_step_due_date: string | null;
  description: string;
  close_reason: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  unit_price_cents: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Revised';

export interface QuoteLine {
  id: string;
  product_id: string | null;
  sku_snapshot: string;
  product_name_snapshot: string;
  description: string;
  quantity_thousandths: number; // e.g., 1000 = 1.000
  unit: string;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  opportunity_id: string;
  organization_id: string;
  contact_id: string;
  org_snapshot: {
    name: string;
    legal_name: string;
    country: string;
    city_region: string;
    billing_address: string;
  };
  contact_snapshot: {
    first_name: string;
    last_name: string;
    work_email: string;
    personal_email: string;
    phone: string;
  };
  status: QuoteStatus;
  valid_until: string;
  notes_terms: string;
  lines: QuoteLine[];
  subtotal_cents: number;
  discount_total_cents: number;
  total_cents: number;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string;
  revised_from_quote_id: string | null;
  owner_id: string;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  quote_id: string;
  opportunity_id: string;
  organization_id: string;
  contact_id: string;
  org_snapshot: Quote['org_snapshot'];
  contact_snapshot: Quote['contact_snapshot'];
  lines_snapshot: QuoteLine[];
  notes_terms: string;
  total_cents: number;
  status: 'Active' | 'Cancelled';
  cancel_reason: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  owner_id: string;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Void';

export interface Invoice {
  id: string;
  invoice_number: string | null;
  order_id: string;
  organization_id: string;
  contact_id: string;
  org_snapshot: Quote['org_snapshot'] & { tax_registration_number?: string };
  contact_snapshot: Quote['contact_snapshot'];
  lines_snapshot: QuoteLine[];
  status: InvoiceStatus;
  currency: string;
  issue_date: string | null;
  due_date: string;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  payment_terms_days: number;
  notes: string;
  void_reason: string;
  voided_at: string | null;
  voided_by: string | null;
  owner_id: string;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'bank_transfer' | 'card' | 'cheque' | 'other';

export interface Payment {
  id: string;
  invoice_id: string;
  order_id: string;
  organization_id: string;
  amount_cents: number;
  payment_date: string;
  method: PaymentMethod;
  reference: string;
  status: 'Valid' | 'Reversed';
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string;
  owner_id: string;
  team_id: string | null;
  recorded_by: string;
  created_at: string;
}

export interface Enquiry {
  id: string;
  enquiry_type: 'booking' | 'contact';
  org_name: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  purpose: string;
  message: string;
  preferred_date: string | null;
  status: 'Pending' | 'Approved' | 'Dismissed';
  lead_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}

export interface OrgFile {
  id: string;
  organization_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  note: string;
  uploaded_by: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: 'organization' | 'contact' | 'lead' | 'opportunity' | 'quote' | 'order' | 'invoice' | 'enquiry' | '';
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
}

export interface SavedView {
  id: string;
  user_id: string;
  entity_type: 'leads';
  name: string;
  filters: {
    stage?: string;
    priority?: string;
    owner?: string;
    search?: string;
  };
  created_at: string;
}

export interface SuggestionState {
  suggestion_key: string;
  status: 'accepted' | 'dismissed' | 'snoozed';
  snooze_until: string | null;
}

export interface AppSettings {
  company_name: string;
  currency: string;
  payment_terms_days: number;
  tax_enabled: boolean;
  tax_rate_bps: number;
  tax_label: string;
  legal_entity_name: string;
  tax_registration_number: string;
  invoice_address: string;
  partner_roles_enabled: boolean;
  website_enquiries_enabled: boolean;
  default_enquiry_owner_id: string | null;
}

export interface CrmDatabaseState {
  version: number;
  currentUserId: string | null;
  settings: AppSettings;
  sequences: {
    lead: number;
    opportunity: number;
    quote: number;
    order: number;
    invoice: number;
  };
  teams: Team[];
  users: User[];
  organizations: Organization[];
  contacts: Contact[];
  contactMemberships: ContactMembership[];
  leads: Lead[];
  activities: Activity[];
  opportunities: Opportunity[];
  products: Product[];
  quotes: Quote[];
  orders: Order[];
  invoices: Invoice[];
  payments: Payment[];
  enquiries: Enquiry[];
  orgFiles: OrgFile[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  savedViews: SavedView[];
  suggestionStates: Record<string, SuggestionState>;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  duplicates?: Array<{ id: string; label: string; detail: string }>;
  conflicts?: Array<{ id: string; summary: string; scheduled_at: string; duration_minutes: number }>;
}
