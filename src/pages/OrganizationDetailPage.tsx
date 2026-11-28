import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Edit3,
  FileText,
  Paperclip,
  Printer,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import type { NavRoute } from '../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  Modal,
  StatusIndicator,
  SuccessBanner,
  inputCls,
  selectCls,
} from '../components/ui';
import { formatCents, formatDateTime, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus } from '../store/policy';

export const OrganizationDetailPage: React.FC<{
  orgId: string;
  initialTab?: 'profile' | 'brief';
  onNavigate: (r: NavRoute) => void;
}> = ({ orgId, initialTab = 'profile', onNavigate }) => {
  const {
    state,
    currentUser,
    visibleOrganizations,
    visibleContacts,
    visibleLeads,
    visibleOpportunities,
    visibleActivities,
    visibleQuotes,
    visibleInvoices,
    canEdit,
    updateOrganization,
    deleteOrganization,
    addOrgFile,
  } = useCrm();

  const org = visibleOrganizations.find((o) => o.id === orgId);
  const [tab, setTab] = useState<'profile' | 'brief'>(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileNote, setFileNote] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Edit fields
  const [editName, setEditName] = useState(org?.name || '');
  const [editCity, setEditCity] = useState(org?.city_region || '');
  const [editWebsite, setEditWebsite] = useState(org?.website || '');
  const [editNotes, setEditNotes] = useState(org?.notes || '');
  const [editLegal, setEditLegal] = useState(org?.legal_name || '');
  const [editBilling, setEditBilling] = useState(org?.billing_address || '');
  const [editStatus, setEditStatus] = useState(org?.account_status || 'Active');

  const people = useMemo(() => {
    if (!org) return [];
    return state.contactMemberships
      .filter((m) => m.organization_id === org.id && m.is_active)
      .map((m) => {
        const contact = visibleContacts.find((c) => c.id === m.contact_id);
        return contact ? { membership: m, contact } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [org, state.contactMemberships, visibleContacts]);

  const orgLeads = useMemo(
    () => (org ? visibleLeads.filter((l) => l.organization_id === org.id) : []),
    [org, visibleLeads]
  );

  const orgOpps = useMemo(
    () => (org ? visibleOpportunities.filter((op) => op.organization_id === org.id) : []),
    [org, visibleOpportunities]
  );

  const orgActivities = useMemo(
    () =>
      org
        ? visibleActivities
            .filter((a) => a.organization_id === org.id)
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        : [],
    [org, visibleActivities]
  );

  const orgFiles = useMemo(
    () => (org ? state.orgFiles.filter((f) => f.organization_id === org.id) : []),
    [org, state.orgFiles]
  );

  const orgQuotes = useMemo(
    () => (org ? visibleQuotes.filter((q) => q.organization_id === org.id) : []),
    [org, visibleQuotes]
  );

  const orgInvoices = useMemo(
    () => (org ? visibleInvoices.filter((i) => i.organization_id === org.id) : []),
    [org, visibleInvoices]
  );

  if (!org) {
    return (
      <EmptyState
        title="Organization not accessible"
        description="This company doesn't exist, or you don't have access to it."
        action={<Button onClick={() => onNavigate({ page: 'organizations' })}>Back to Organizations</Button>}
      />
    );
  }

  const editable = canEdit(org);
  const owner = state.users.find((u) => u.id === org.owner_id);
  const currency = state.settings.currency || 'USD';
  const today = todayIso();

  // Deterministic Institutional Engagement Brief gaps & blockers
  const openNextActions = orgActivities
    .filter((a) => a.status === 'Open')
    .sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'));

  const blockersAndGaps: Array<{ text: string; nav?: NavRoute }> = [];
  if (!org.owner_id) blockersAndGaps.push({ text: 'Missing relationship owner on organization profile.' });
  if (people.length === 0) blockersAndGaps.push({ text: 'Missing stakeholders: No active contacts linked to this organization.', nav: { page: 'contacts' } });
  if (!org.legal_name) blockersAndGaps.push({ text: 'Missing legal entity name (needed prior to invoicing).' });
  if (!org.billing_address) blockersAndGaps.push({ text: 'Missing billing address on organization record.' });
  for (const act of openNextActions) {
    if (act.due_date && act.due_date < today) {
      blockersAndGaps.push({
        text: `Overdue action (${formatShortDate(act.due_date)}): ${act.summary}`,
        nav: act.lead_id ? { page: 'lead', id: act.lead_id } : act.opportunity_id ? { page: 'opportunity', id: act.opportunity_id } : undefined,
      });
    }
  }
  for (const l of orgLeads) {
    if (l.stage !== 'Lost' && l.stage !== 'Qualified') {
      const hasOpen = orgActivities.some((a) => a.lead_id === l.id && a.status === 'Open');
      if (!hasOpen) {
        blockersAndGaps.push({
          text: `Active lead ${l.lead_number} (${l.purpose}) has no scheduled open next action.`,
          nav: { page: 'lead', id: l.id },
        });
      }
      if (l.stage === 'On hold' && l.close_reason) {
        blockersAndGaps.push({
          text: `Lead ${l.lead_number} is On hold: ${l.close_reason} (revisit ${formatShortDate(l.revisit_date)})`,
          nav: { page: 'lead', id: l.id },
        });
      }
    }
  }
  if (openNextActions.length === 0 && orgOpps.every((o) => o.stage === 'Won' || o.stage === 'Lost')) {
    blockersAndGaps.push({ text: 'No open next action recorded for this organization.' });
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = updateOrganization(org.id, {
      name: editName,
      city_region: editCity,
      website: editWebsite,
      notes: editNotes,
      legal_name: editLegal,
      billing_address: editBilling,
      account_status: editStatus,
    });
    if (!res.ok) {
      setError(res.error || 'Could not update organization.');
      return;
    }
    setEditOpen(false);
    setToast('Organization profile updated.');
  };

  const handleDelete = () => {
    setError('');
    const res = deleteOrganization(org.id);
    if (!res.ok) {
      setError(res.error || 'Could not delete organization.');
      return;
    }
    onNavigate({ page: 'organizations' });
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    const res = addOrgFile(org.id, fileName, 'application/pdf', 124000, fileNote);
    if (!res.ok) {
      setError(res.error || 'Could not attach file.');
      return;
    }
    setFileOpen(false);
    setFileName('');
    setFileNote('');
    setToast('Document reference recorded on organization.');
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE] no-print">
        <div>
          <button
            onClick={() => onNavigate({ page: 'organizations' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Organizations
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936]">{org.name}</h1>
            <StatusIndicator status={org.account_status} />
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {org.org_type} · {org.city_region ? `${org.city_region}, ` : ''}{org.country} · Owner: {owner?.name || 'Unassigned'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#BFDBFE] bg-[#F4F8FF] p-0.5">
            <button
              onClick={() => setTab('profile')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                tab === 'profile' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
              }`}
            >
              Record Workspace
            </button>
            <button
              onClick={() => setTab('brief')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                tab === 'brief' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
              }`}
            >
              Engagement Summary
            </button>
          </div>

          {tab === 'brief' && (
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </Button>
          )}
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditName(org.name);
                setEditCity(org.city_region);
                setEditWebsite(org.website);
                setEditNotes(org.notes);
                setEditLegal(org.legal_name);
                setEditBilling(org.billing_address);
                setEditStatus(org.account_status);
                setEditOpen(true);
              }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {tab === 'brief' ? (
        /* DISTINCTIVE FEATURE: INSTITUTIONAL ENGAGEMENT BRIEF */
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#DBEAFE]">
            <div>
              <BrandLogo size="sm" className="mb-3" />
              <h2 className="text-xl font-semibold text-[#0A1936]">
                Engagement Summary — {org.name}
              </h2>
              <p className="text-xs text-[#3B5998] mt-1">
                Built from your recorded data · Generated {formatDateTime(new Date().toISOString())}
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-[#3B5998] space-y-1">
              <div>
                <span className="font-semibold text-[#0F295C]">Account Status:</span> {org.account_status}
              </div>
              <div>
                <span className="font-semibold text-[#0F295C]">Owner:</span>{' '}
                {owner ? `${owner.name} (${owner.role})` : 'Missing information'}
              </div>
              <div>
                <span className="font-semibold text-[#0F295C]">Location:</span>{' '}
                {org.city_region ? `${org.city_region}, ` : ''}{org.country}
              </div>
            </div>
          </div>

          {/* 1. Organization Profile */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              1. Company Profile &amp; Owner
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-1">
              <div>
                <span className="text-xs text-[#3B5998] block">Legal Name</span>
                <span className="font-medium text-[#0A1936]">
                  {org.legal_name || <em className="text-[#3B5998]">Missing information</em>}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#3B5998] block">Type &amp; Industry</span>
                <span className="font-medium text-[#0A1936]">
                  {org.org_type}{org.industry ? ` · ${org.industry}` : ''}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#3B5998] block">Website / Email</span>
                <span className="font-medium text-[#0A1936]">
                  {org.website || org.main_email || <em className="text-[#3B5998]">Not recorded</em>}
                </span>
              </div>
            </div>
            {org.notes && <p className="text-sm text-[#0F295C] pt-1">{org.notes}</p>}
          </section>

          {/* 2. People Involved */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              2. People We Deal With
            </h3>
            {people.length === 0 ? (
              <p className="text-sm text-[#3B5998] italic">
                No contacts are linked to this company yet.
              </p>
            ) : (
              <div className="divide-y divide-[#EFF6FF]">
                {people.map(({ contact, membership }) => (
                  <div key={membership.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <button
                        onClick={() => onNavigate({ page: 'contact', id: contact.id })}
                        className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        {contact.first_name} {contact.last_name}
                      </button>
                      <span className="text-[#3B5998]">
                        {' '}— {membership.designation || 'Designation not recorded'}
                      </span>
                    </div>
                    <div className="text-xs text-[#3B5998] flex items-center gap-2">
                      <span>{contact.work_email || contact.personal_email || 'No email'}</span>
                      <span>·</span>
                      <span className="tabular-nums">{contact.normalized_phone || contact.phone || 'No phone'}</span>
                      {contact.do_not_contact && <StatusIndicator status="Do Not Contact" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Active Leads & Opportunities */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              3. Leads &amp; Deals
            </h3>
            {orgLeads.length === 0 && orgOpps.length === 0 ? (
              <p className="text-sm text-[#3B5998] italic">No leads or opportunities recorded for this organization.</p>
            ) : (
              <div className="space-y-2">
                {orgLeads.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-[#DBEAFE] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <button
                        onClick={() => onNavigate({ page: 'lead', id: l.id })}
                        className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        {l.lead_number} · {l.purpose}
                      </button>
                      <div className="text-xs text-[#3B5998]">
                        Source: {l.source} · Response: {l.response_status} · Demo: {l.demonstration_status}
                      </div>
                    </div>
                    <StatusIndicator status={l.stage} />
                  </div>
                ))}
                {orgOpps.map((op) => (
                  <div key={op.id} className="p-3 rounded-lg border border-[#93C5FD] bg-[#F4F8FF] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <button
                        onClick={() => onNavigate({ page: 'opportunity', id: op.id })}
                        className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        {op.opp_number} · {op.title}
                      </button>
                      <div className="text-xs text-[#3B5998] tabular-nums">
                        Estimated: {formatCents(op.estimated_value_cents, currency)} ({op.probability}% weighted:{' '}
                        {formatCents(op.weighted_value_cents, currency)})
                      </div>
                    </div>
                    <StatusIndicator status={op.stage} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Recent Interactions & Decisions */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              4. Recent Activity &amp; Documents
            </h3>
            {orgActivities.length === 0 && orgQuotes.length === 0 && orgInvoices.length === 0 ? (
              <p className="text-sm text-[#3B5998] italic">No recorded interactions or commercial documents yet.</p>
            ) : (
              <div className="divide-y divide-[#EFF6FF] text-sm">
                {orgActivities.slice(0, 6).map((act) => {
                  const actOwner = state.users.find((u) => u.id === act.owner_id);
                  return (
                    <div key={act.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-[#0A1936]">[{act.type}] {act.summary}</span>
                        {act.outcome_note && (
                          <div className="text-xs text-[#3B5998]">Outcome: {act.outcome_note}</div>
                        )}
                      </div>
                      <div className="text-xs text-[#3B5998] tabular-nums shrink-0">
                        {formatShortDate(act.occurred_at)} · {actOwner?.name || 'System'}
                      </div>
                    </div>
                  );
                })}
                {orgQuotes.map((q) => (
                  <div key={q.id} className="py-2 flex items-center justify-between text-sm">
                    <button
                      onClick={() => onNavigate({ page: 'quote', id: q.id })}
                      className="text-[#1D4ED8] font-medium hover:underline cursor-pointer"
                    >
                      Quote {q.quote_number} ({formatCents(q.total_cents, currency)})
                    </button>
                    <StatusIndicator status={q.status} />
                  </div>
                ))}
                {orgInvoices.map((inv) => (
                  <div key={inv.id} className="py-2 flex items-center justify-between text-sm">
                    <button
                      onClick={() => onNavigate({ page: 'invoice', id: inv.id })}
                      className="text-[#1D4ED8] font-medium hover:underline cursor-pointer"
                    >
                      Invoice {inv.invoice_number || 'Draft'} · Paid {formatCents(inv.amount_paid_cents, currency)} / {formatCents(inv.total_cents, currency)}
                    </button>
                    <StatusIndicator status={inv.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Current Blockers & Missing Information */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              5. What's Missing or Blocking
            </h3>
            {blockersAndGaps.length === 0 ? (
              <p className="text-sm text-[#3B5998]">Nothing is missing or blocking right now.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {blockersAndGaps.map((g, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[#0F295C]">
                    <AlertCircle className="w-4 h-4 text-[#1D4ED8] mt-0.5 shrink-0" />
                    <div>
                      <span>{g.text}</span>
                      {g.nav && (
                        <button
                          onClick={() => onNavigate(g.nav!)}
                          className="ml-2 text-xs font-medium text-[#1D4ED8] hover:underline no-print cursor-pointer"
                        >
                          View source record
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 6. Next Action, Owner & Due Date */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0F295C] bg-[#EFF6FF] px-3 py-1.5 rounded-md">
              6. Next Step, Owner &amp; Due Date
            </h3>
            {openNextActions.length === 0 ? (
              <p className="text-sm text-[#3B5998] italic">
                No follow-up is scheduled for this company yet.
              </p>
            ) : (
              <div className="space-y-2">
                {openNextActions.slice(0, 4).map((na) => {
                  const naOwner = state.users.find((u) => u.id === na.owner_id);
                  return (
                    <div key={na.id} className="p-3 rounded-lg border border-[#DBEAFE] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-semibold text-[#0A1936]">{na.action_type}: </span>
                        <span>{na.summary}</span>
                      </div>
                      <div className="text-xs text-[#3B5998] tabular-nums shrink-0">
                        Owner: <strong className="text-[#0F295C]">{naOwner?.name || 'Unassigned'}</strong> · Due:{' '}
                        <strong className="text-[#0F295C]">{formatShortDate(na.due_date)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </Card>
      ) : (
        /* STANDARD ORGANIZATION RECORD WORKSPACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1D4ED8]" />
                  Organization Profile
                </h2>
                {currentUser && isManagerPlus(currentUser.role) && editable && (
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 text-xs text-[#3B5998] hover:text-[#0F295C] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[#3B5998]">Legal Name</dt>
                  <dd className="font-medium text-[#0A1936]">{org.legal_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#3B5998]">Tax ID</dt>
                  <dd className="font-medium text-[#0A1936]">{org.tax_registration_number || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#3B5998]">Main Email</dt>
                  <dd className="font-medium text-[#0A1936]">{org.main_email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#3B5998]">Website</dt>
                  <dd className="font-medium text-[#1D4ED8] truncate">{org.website || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[#3B5998]">Billing Address</dt>
                  <dd className="font-medium text-[#0A1936]">{org.billing_address || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[#3B5998]">Notes</dt>
                  <dd className="text-[#0F295C] mt-0.5">{org.notes || 'No notes recorded.'}</dd>
                </div>
              </dl>
              <div className="pt-3 border-t border-[#EFF6FF] text-xs text-[#3B5998] flex justify-between">
                <span>Created {formatShortDate(org.created_at)}</span>
                <span>Updated {formatShortDate(org.updated_at)}</span>
              </div>
            </Card>

            {/* Stakeholders */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0A1936]">People &amp; Roles</h2>
                <Button size="sm" variant="outline" onClick={() => onNavigate({ page: 'contacts' })}>
                  <UserPlus className="w-3.5 h-3.5" />
                  Manage
                </Button>
              </div>
              {people.length === 0 ? (
                <p className="text-xs text-[#3B5998]">No active contacts linked to this organization yet.</p>
              ) : (
                <div className="divide-y divide-[#EFF6FF]">
                  {people.map(({ contact, membership }) => (
                    <div key={membership.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <button
                          onClick={() => onNavigate({ page: 'contact', id: contact.id })}
                          className="text-sm font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                        >
                          {contact.first_name} {contact.last_name}
                        </button>
                        <div className="text-xs text-[#3B5998]">{membership.designation || 'No designation'}</div>
                      </div>
                      {contact.do_not_contact && <StatusIndicator status="Do Not Contact" />}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Files */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#1D4ED8]" />
                  Files &amp; Briefs
                </h2>
                {editable && (
                  <Button size="sm" variant="outline" onClick={() => setFileOpen(true)}>
                    Attach
                  </Button>
                )}
              </div>
              {orgFiles.length === 0 ? (
                <p className="text-xs text-[#3B5998]">No files attached yet.</p>
              ) : (
                <div className="space-y-2">
                  {orgFiles.map((f) => (
                    <div key={f.id} className="p-2.5 rounded-lg border border-[#DBEAFE] text-xs">
                      <div className="font-semibold text-[#0A1936] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        {f.file_name}
                      </div>
                      {f.note && <div className="text-[#3B5998] mt-0.5">{f.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {/* Related Leads & Opportunities */}
            <Card className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-[#0A1936]">Leads &amp; Opportunities</h2>
              {orgLeads.length === 0 && orgOpps.length === 0 ? (
                <p className="text-xs text-[#3B5998]">No leads or opportunities linked to this organization yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {orgLeads.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => onNavigate({ page: 'lead', id: l.id })}
                      className="w-full text-left p-3 rounded-lg border border-[#DBEAFE] hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0A1936]">
                          {l.lead_number} · {l.purpose}
                        </div>
                        <div className="text-xs text-[#3B5998]">
                          Priority: {l.priority} · Updated {formatShortDate(l.updated_at)}
                        </div>
                      </div>
                      <StatusIndicator status={l.stage} />
                    </button>
                  ))}
                  {orgOpps.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => onNavigate({ page: 'opportunity', id: op.id })}
                      className="w-full text-left p-3 rounded-lg border border-[#93C5FD] bg-[#F4F8FF] hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0A1936]">
                          {op.opp_number} · {op.title}
                        </div>
                        <div className="text-xs text-[#3B5998] tabular-nums">
                          {formatCents(op.estimated_value_cents, currency)} ({op.probability}%)
                        </div>
                      </div>
                      <StatusIndicator status={op.stage} />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Activity Timeline */}
            <Card className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#1D4ED8]" />
                Chronological Activity Timeline
              </h2>
              {orgActivities.length === 0 ? (
                <p className="text-xs text-[#3B5998]">No activities logged yet.</p>
              ) : (
                <div className="divide-y divide-[#EFF6FF]">
                  {orgActivities.map((act) => {
                    const actOwner = state.users.find((u) => u.id === act.owner_id);
                    return (
                      <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusIndicator status={act.type} />
                            <span className="text-sm font-medium text-[#0A1936]">{act.summary}</span>
                          </div>
                          <span className="text-xs text-[#3B5998] tabular-nums shrink-0">
                            {formatShortDate(act.occurred_at)}
                          </span>
                        </div>
                        {act.details && <p className="text-xs text-[#3B5998] mt-1">{act.details}</p>}
                        {act.outcome_note && (
                          <p className="text-xs text-[#0F295C] mt-1">Outcome: {act.outcome_note}</p>
                        )}
                        <div className="text-[11px] text-[#3B5998] mt-1">
                          Owner: {actOwner?.name || 'System'} · Status: {act.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Organization">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Field label="Organization Name" required>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="City / Region">
              <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Account Status">
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} className={selectCls}>
                <option value="Prospect">Prospect</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Legal Entity Name">
            <input type="text" value={editLegal} onChange={(e) => setEditLegal(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Billing Address">
            <input type="text" value={editBilling} onChange={(e) => setEditBilling(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Website">
            <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Notes">
            <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Attach File Reference Modal */}
      <Modal
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        title="Attach Document Reference"
        subtitle="Static demo records document metadata locally in your browser."
      >
        <form onSubmit={handleAddFile} className="space-y-4">
          <Field label="Document File Name" required>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className={inputCls}
              placeholder="e.g., MSA_Draft_v2.pdf"
              required
            />
          </Field>
          <Field label="Note">
            <input
              type="text"
              value={fileNote}
              onChange={(e) => setFileNote(e.target.value)}
              className={inputCls}
              placeholder="Brief context..."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFileOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record File</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
