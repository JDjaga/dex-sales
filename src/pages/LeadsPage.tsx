import React, { useMemo, useState } from 'react';
import { Bookmark, Columns3, List, Plus, Search, Target } from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  Modal,
  PageHeader,
  StatusIndicator,
  SuccessBanner,
  inputCls,
  selectCls,
} from '../components/ui';
import { addDaysIso, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isReadOnlyRole } from '../store/policy';
import type { ActionType, LeadPriority, LeadStage } from '../types/crm';

const STAGES: LeadStage[] = [
  'Prospect',
  'Approached',
  'Engaged',
  'Demo scheduled',
  'Demo done',
  'On hold',
  'Qualified',
  'Lost',
];

export const LeadsPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const {
    state,
    currentUser,
    visibleLeads,
    visibleOrganizations,
    visibleContacts,
    visibleActivities,
    createLead,
    saveLeadView,
    deleteLeadView,
  } = useCrm();

  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'updated' | 'priority'>('updated');
  const [createOpen, setCreateOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  // Create lead form
  const [orgId, setOrgId] = useState('');
  const [contactId, setContactId] = useState('');
  const [leadType, setLeadType] = useState('Direct Institutional');
  const [source, setSource] = useState('Executive Referral');
  const [purpose, setPurpose] = useState('');
  const [purposeDetails, setPurposeDetails] = useState('');
  const [priority, setPriority] = useState<LeadPriority>('Medium');
  const [nextActionText, setNextActionText] = useState('');
  const [nextActionType, setNextActionType] = useState<ActionType>('Call');
  const [nextActionDue, setNextActionDue] = useState(addDaysIso(todayIso(), 2));
  const [dupMatches, setDupMatches] = useState<Array<{ id: string; label: string; detail: string }>>([]);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const orgContacts = useMemo(() => {
    if (!orgId) return [];
    const memberIds = new Set(
      state.contactMemberships
        .filter((m) => m.organization_id === orgId && m.is_active)
        .map((m) => m.contact_id)
    );
    return visibleContacts.filter((c) => memberIds.has(c.id));
  }, [orgId, state.contactMemberships, visibleContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const prioOrder: Record<LeadPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return visibleLeads
      .filter((l) => {
        if (stageFilter !== 'All' && l.stage !== stageFilter) return false;
        if (priorityFilter !== 'All' && l.priority !== priorityFilter) return false;
        if (!q) return true;
        const org = visibleOrganizations.find((o) => o.id === l.organization_id);
        return (
          l.lead_number.toLowerCase().includes(q) ||
          l.purpose.toLowerCase().includes(q) ||
          (org?.name || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortBy === 'priority'
          ? prioOrder[a.priority] - prioOrder[b.priority]
          : b.updated_at.localeCompare(a.updated_at)
      );
  }, [visibleLeads, visibleOrganizations, search, stageFilter, priorityFilter, sortBy]);

  const mySavedViews = state.savedViews.filter((v) => v.user_id === currentUser?.id);

  const submitLead = (confirmDuplicate: boolean) => {
    setFormError('');
    const res = createLead({
      organization_id: orgId,
      primary_contact_id: contactId,
      lead_type: leadType,
      source,
      purpose,
      purpose_details: purposeDetails,
      priority,
      next_action_text: nextActionText,
      next_action_type: nextActionType,
      next_action_due_date: nextActionDue,
      confirmDuplicate,
    });
    if (!res.ok) {
      if (res.code === 'DUPLICATE_CONFIRM_REQUIRED' && res.duplicates) {
        setDupMatches(res.duplicates);
        return;
      }
      setFormError(res.error || 'Could not create lead.');
      return;
    }
    setCreateOpen(false);
    setOrgId('');
    setContactId('');
    setPurpose('');
    setPurposeDetails('');
    setNextActionText('');
    setDupMatches([]);
    setToast(`Created lead ${res.data?.lead_number} with initial next action.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Track institutional approaches from initial outreach to manager-approved qualification"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#BFDBFE] bg-[#F4F8FF] p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  viewMode === 'board' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                Stage Board
              </button>
            </div>
            {currentUser && !isReadOnlyRole(currentUser.role) && (
              <Button
                size="sm"
                onClick={() => {
                  setFormError('');
                  setDupMatches([]);
                  setCreateOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Lead
              </Button>
            )}
          </div>
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {/* Filters & Saved Views */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead #, organization, or purpose..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={`${selectCls} md:w-44`}>
            <option value="All">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={`${selectCls} md:w-40`}>
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'updated' | 'priority')} className={`${selectCls} md:w-44`}>
            <option value="updated">Sort: Recently Updated</option>
            <option value="priority">Sort: Priority</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => setSaveViewOpen(true)}>
            <Bookmark className="w-3.5 h-3.5" />
            Save View
          </Button>
        </div>

        {mySavedViews.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#3B5998] font-medium">Saved views:</span>
            {mySavedViews.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#0F295C]">
                <button
                  onClick={() => {
                    setStageFilter(v.filters.stage || 'All');
                    setPriorityFilter(v.filters.priority || 'All');
                    setSearch(v.filters.search || '');
                  }}
                  className="font-medium hover:text-[#1D4ED8] cursor-pointer"
                >
                  {v.name}
                </button>
                <button onClick={() => deleteLeadView(v.id)} className="text-[#3B5998] hover:text-[#0F295C] cursor-pointer" aria-label="Remove view">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No leads match"
          description="Try clearing filters or create a new institutional lead."
        />
      ) : viewMode === 'list' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Organization &amp; Contact</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Next Action</th>
                  <th className="py-3 px-4">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((l) => {
                  const org = visibleOrganizations.find((o) => o.id === l.organization_id);
                  const contact = visibleContacts.find((c) => c.id === l.primary_contact_id);
                  const owner = state.users.find((u) => u.id === l.owner_id);
                  const nextAct = visibleActivities.find((a) => a.lead_id === l.id && a.status === 'Open' && a.is_next_action);
                  return (
                    <tr key={l.id} className="hover:bg-[#F4F8FF] transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'lead', id: l.id })}
                          className="font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1.5 text-left cursor-pointer"
                        >
                          <Target className="w-3.5 h-3.5 shrink-0" />
                          <span>{l.lead_number} · {l.purpose}</span>
                        </button>
                        <div className="text-xs text-[#3B5998] mt-0.5">{l.lead_type} · {l.source}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0A1936]">{org?.name || 'Organization'}</div>
                        <div className="text-xs text-[#3B5998]">
                          {contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={l.stage} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={l.priority} />
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {nextAct ? (
                          <div>
                            <div className="font-medium text-[#0A1936]">{nextAct.summary}</div>
                            <div className="text-[#3B5998] tabular-nums">Due {formatShortDate(nextAct.due_date)}</div>
                          </div>
                        ) : (
                          <span className="text-[#3B5998]">None scheduled</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#0F295C]">{owner?.name || 'Unassigned'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Stage Board View */
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-8 gap-3 min-w-[1180px]">
            {STAGES.map((st) => {
              const items = filtered.filter((l) => l.stage === st);
              return (
                <div key={st} className="bg-[#F4F8FF] border border-[#DBEAFE] rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#0F295C] pb-2 border-b border-[#DBEAFE]">
                    <span>{st}</span>
                    <span className="tabular-nums text-[#1D4ED8]">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[11px] text-[#3B5998] py-4 text-center">No leads</div>
                  ) : (
                    items.map((l) => {
                      const org = visibleOrganizations.find((o) => o.id === l.organization_id);
                      return (
                        <button
                          key={l.id}
                          onClick={() => onNavigate({ page: 'lead', id: l.id })}
                          className="w-full text-left p-3 rounded-lg bg-white border border-[#DBEAFE] hover:border-[#1D4ED8] space-y-1.5 cursor-pointer"
                        >
                          <div className="text-[11px] font-mono text-[#1D4ED8] font-semibold">{l.lead_number}</div>
                          <div className="text-xs font-semibold text-[#0A1936] leading-snug">{l.purpose}</div>
                          <div className="text-[11px] text-[#3B5998] truncate">{org?.name}</div>
                          <div className="pt-1">
                            <StatusIndicator status={l.priority} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Institutional Lead"
        subtitle="Defaults: Stage = Prospect, Priority = Medium, Response = Awaiting response, Demo = Not yet offered."
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitLead(false);
          }}
          className="space-y-4"
        >
          {formError && <ErrorAlert message={formError} />}

          {dupMatches.length > 0 && (
            <div className="p-4 rounded-lg bg-[#EFF6FF] border border-[#1D4ED8] space-y-2">
              <div className="text-sm font-semibold text-[#0F295C]">Open Lead Duplicate Warning</div>
              <p className="text-xs text-[#3B5998]">
                An open lead already exists for this organization with the same purpose:
              </p>
              {dupMatches.map((d) => (
                <div key={d.id} className="text-xs p-2 bg-white border border-[#BFDBFE] rounded">
                  <strong>{d.label}</strong> ({d.detail})
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setDupMatches([])}>
                  Adjust Purpose
                </Button>
                <Button type="button" size="sm" onClick={() => submitLead(true)}>
                  Confirm &amp; Create Second Lead
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Organization" required>
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setContactId('');
                  setDupMatches([]);
                }}
                className={selectCls}
                required
              >
                <option value="">Select organization...</option>
                {visibleOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.country})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Primary Contact (must belong to organization)" required>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={selectCls}
                disabled={!orgId}
                required
              >
                <option value="">{orgId ? 'Select primary contact...' : 'Select organization first'}</option>
                {orgContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lead Type" required>
              <select value={leadType} onChange={(e) => setLeadType(e.target.value)} className={selectCls}>
                <option value="Direct Institutional">Direct Institutional</option>
                <option value="Regulatory Pilot">Regulatory Pilot</option>
                <option value="Academic Consortium">Academic Consortium</option>
                <option value="Partner Co-Sell">Partner Co-Sell</option>
                <option value="Website Enquiry">Website Enquiry</option>
              </select>
            </Field>

            <Field label="Source" required>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
                <option value="Executive Referral">Executive Referral</option>
                <option value="Inbound Briefing">Inbound Briefing</option>
                <option value="Partner Referral">Partner Referral</option>
                <option value="Institutional Forum">Institutional Forum</option>
                <option value="Website Form">Website Form</option>
              </select>
            </Field>

            <Field label="Purpose" required>
              <input
                type="text"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  setDupMatches([]);
                }}
                className={inputCls}
                placeholder="e.g., Institutional Settlement Pilot"
                required
              />
            </Field>

            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as LeadPriority)} className={selectCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </Field>
          </div>

          <Field label="Purpose Details">
            <textarea
              rows={2}
              value={purposeDetails}
              onChange={(e) => setPurposeDetails(e.target.value)}
              className={inputCls}
              placeholder="Scope, regulatory mandate, or institutional goals..."
            />
          </Field>

          <div className="p-4 rounded-lg bg-[#F4F8FF] border border-[#DBEAFE] space-y-3">
            <div className="text-xs font-semibold text-[#0F295C]">Required First Next Action</div>
            <Field label="Action Text" required>
              <input
                type="text"
                value={nextActionText}
                onChange={(e) => setNextActionText(e.target.value)}
                className={inputCls}
                placeholder="e.g., Send introductory architecture brief and propose call"
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Action Type" required>
                <select value={nextActionType} onChange={(e) => setNextActionType(e.target.value as ActionType)} className={selectCls}>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Demo">Demo</option>
                  <option value="Send material">Send material</option>
                  <option value="Internal follow-up">Internal follow-up</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Due Date (not in past)" required>
                <input
                  type="date"
                  min={todayIso()}
                  value={nextActionDue}
                  onChange={(e) => setNextActionDue(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Save View Modal */}
      <Modal open={saveViewOpen} onClose={() => setSaveViewOpen(false)} title="Save Lead View">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveLeadView(viewName, { stage: stageFilter, priority: priorityFilter, search });
            setSaveViewOpen(false);
            setViewName('');
            setToast('Saved lead filter view.');
          }}
          className="space-y-4"
        >
          <Field label="View Name" required>
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className={inputCls}
              placeholder="e.g., High Priority Qualified Leads"
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save View</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
