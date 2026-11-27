import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  InfoBanner,
  Modal,
  StatusIndicator,
  SuccessBanner,
  inputCls,
  selectCls,
} from '../components/ui';
import { addDaysIso, formatDateTime, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus, isOrgWideAdmin } from '../store/policy';
import type { ActionType, ActivityType, DemonstrationStatus, LeadStage, ResponseStatus } from '../types/crm';

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

export const LeadDetailPage: React.FC<{ leadId: string; onNavigate: (r: NavRoute) => void }> = ({
  leadId,
  onNavigate,
}) => {
  const {
    state,
    currentUser,
    visibleLeads,
    visibleOrganizations,
    visibleContacts,
    visibleOpportunities,
    visibleActivities,
    canEdit,
    updateLead,
    changeLeadStage,
    createActivity,
    completeAction,
    createOpportunityFromLead,
  } = useCrm();

  const lead = visibleLeads.find((l) => l.id === leadId);
  const linkedOpp = visibleOpportunities.find((o) => o.lead_id === leadId);

  const [stageModal, setStageModal] = useState<LeadStage | null>(null);
  const [demoAt, setDemoAt] = useState(lead?.demo_scheduled_at || `${addDaysIso(todayIso(), 3)}T10:00`);
  const [demoTz, setDemoTz] = useState(lead?.demo_timezone || 'UTC');
  const [demoAttendees, setDemoAttendees] = useState(lead?.demo_attendees || '');
  const [closeReason, setCloseReason] = useState(lead?.close_reason || '');
  const [revisitDate, setRevisitDate] = useState(lead?.revisit_date || addDaysIso(todayIso(), 14));
  const [qualNextStep, setQualNextStep] = useState(lead?.qualified_next_step || '');
  const [stageError, setStageError] = useState('');

  // Activity modal
  const [actOpen, setActOpen] = useState(false);
  const [actType, setActType] = useState<ActivityType>('Call');
  const [actSummary, setActSummary] = useState('');
  const [actDetails, setActDetails] = useState('');
  const [actIsNext, setActIsNext] = useState(true);
  const [actDue, setActDue] = useState(addDaysIso(todayIso(), 2));
  const [actScheduled, setActScheduled] = useState('');
  const [actDuration, setActDuration] = useState(30);
  const [actConflicts, setActConflicts] = useState<Array<{ id: string; summary: string; scheduled_at: string }>>([]);
  const [actError, setActError] = useState('');

  // Complete action modal
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');

  // Opportunity modal
  const [oppOpen, setOppOpen] = useState(false);
  const [oppTitle, setOppTitle] = useState('');
  const [oppAmountDollars, setOppAmountDollars] = useState('25000');
  const [oppNextStep, setOppNextStep] = useState('');
  const [oppDue, setOppDue] = useState(addDaysIso(todayIso(), 7));
  const [oppError, setOppError] = useState('');

  const [toast, setToast] = useState('');
  const [pageError, setPageError] = useState('');

  const leadActivities = useMemo(
    () =>
      visibleActivities
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [visibleActivities, leadId]
  );

  if (!lead) {
    return (
      <EmptyState
        title="Lead not accessible"
        description="This lead does not exist or is outside your current visibility scope."
        action={<Button onClick={() => onNavigate({ page: 'leads' })}>Back to Leads</Button>}
      />
    );
  }

  const org = visibleOrganizations.find((o) => o.id === lead.organization_id);
  const primaryContact = visibleContacts.find((c) => c.id === lead.primary_contact_id);
  const owner = state.users.find((u) => u.id === lead.owner_id);
  const isLocked = Boolean(linkedOpp) && !isOrgWideAdmin(currentUser?.role || 'Viewer');
  const editable = canEdit(lead) && !isLocked;

  // Explainable rule-based score
  const scoreBreakdown: Array<{ label: string; pts: number }> = [
    { label: `Priority (${lead.priority})`, pts: lead.priority === 'Critical' ? 30 : lead.priority === 'High' ? 25 : lead.priority === 'Medium' ? 15 : 5 },
    { label: `Response (${lead.response_status})`, pts: lead.response_status === 'Positive response' ? 30 : lead.response_status === 'Requested follow-up' ? 20 : 5 },
    { label: `Demonstration (${lead.demonstration_status})`, pts: lead.demonstration_status === 'Completed' ? 30 : lead.demonstration_status === 'Scheduled' ? 20 : 5 },
    { label: primaryContact?.work_email ? 'Verified institutional email' : 'Email missing', pts: primaryContact?.work_email ? 10 : 0 },
  ];
  const totalScore = scoreBreakdown.reduce((s, r) => s + r.pts, 0);

  // Suggest stage change without mutating automatically
  let suggestedStage: LeadStage | null = null;
  let suggestionReason = '';
  if (lead.stage === 'Prospect' && lead.response_status === 'Positive response') {
    suggestedStage = 'Engaged';
    suggestionReason = 'Response status is Positive response.';
  } else if (lead.stage === 'Engaged' && lead.demonstration_status === 'Scheduled') {
    suggestedStage = 'Demo scheduled';
    suggestionReason = 'Demonstration status is marked Scheduled.';
  } else if (lead.stage === 'Demo scheduled' && lead.demonstration_status === 'Completed') {
    suggestedStage = 'Demo done';
    suggestionReason = 'Demonstration status is marked Completed.';
  }

  const handleStageSelect = (target: LeadStage) => {
    setStageError('');
    if (['Demo scheduled', 'On hold', 'Qualified', 'Lost'].includes(target)) {
      setDemoAttendees(lead.demo_attendees || `${primaryContact?.first_name || ''} ${primaryContact?.last_name || ''}, ${owner?.name || ''}`.trim());
      setQualNextStep(lead.qualified_next_step || '');
      setStageModal(target);
      return;
    }
    const res = changeLeadStage(lead.id, target);
    if (!res.ok) {
      setPageError(res.error || 'Could not change stage.');
      return;
    }
    setToast(`Moved lead to ${target}.`);
  };

  const submitStageModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageModal) return;
    setStageError('');
    const res = changeLeadStage(lead.id, stageModal, {
      demo_scheduled_at: demoAt,
      demo_timezone: demoTz,
      demo_attendees: demoAttendees,
      close_reason: closeReason,
      revisit_date: revisitDate,
      qualified_next_step: qualNextStep,
    });
    if (!res.ok) {
      setStageError(res.error || 'Stage requirements not satisfied.');
      return;
    }
    setStageModal(null);
    setToast(`Lead transitioned to ${stageModal}.`);
  };

  const submitActivity = (doubleBookConfirmed: boolean) => {
    setActError('');
    const actionTypeMap: Record<ActivityType, ActionType> = {
      Call: 'Call',
      Email: 'Email',
      Meeting: 'Meeting',
      Demo: 'Demo',
      Message: 'Other',
      Note: 'Internal follow-up',
      System: 'Other',
    };
    const res = createActivity({
      entity_type: 'lead',
      entity_id: lead.id,
      type: actType,
      summary: actSummary,
      details: actDetails,
      scheduled_at: actScheduled || null,
      duration_minutes: actDuration,
      action_type: actionTypeMap[actType],
      is_next_action: actIsNext,
      due_date: actIsNext ? actDue : null,
      doubleBookConfirmed,
    });
    if (!res.ok) {
      if (res.code === 'CALENDAR_CONFLICT' && res.conflicts) {
        setActConflicts(res.conflicts);
        return;
      }
      setActError(res.error || 'Could not log activity.');
      return;
    }
    setActOpen(false);
    setActSummary('');
    setActDetails('');
    setActScheduled('');
    setActConflicts([]);
    setToast('Activity recorded on lead timeline.');
  };

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    setOppError('');
    const cents = Math.round(Number(oppAmountDollars || 0) * 100);
    const res = createOpportunityFromLead(lead.id, {
      title: oppTitle,
      estimated_value_cents: cents,
      next_step: oppNextStep,
      next_step_due_date: oppDue,
    });
    if (!res.ok) {
      setOppError(res.error || 'Could not create opportunity.');
      return;
    }
    setOppOpen(false);
    if (res.data) onNavigate({ page: 'opportunity', id: res.data.id });
  };

  const nextAction = leadActivities.find((a) => a.status === 'Open' && a.is_next_action);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE]">
        <div>
          <button
            onClick={() => onNavigate({ page: 'leads' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Leads
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936]">
              {lead.lead_number} · {lead.purpose}
            </h1>
            <StatusIndicator status={lead.stage} />
            <StatusIndicator status={lead.priority} />
            {isLocked && <StatusIndicator status="Locked" />}
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {org?.name} · Primary Contact: {primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : '—'} · Owner: {owner?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {linkedOpp ? (
            <Button size="sm" onClick={() => onNavigate({ page: 'opportunity', id: linkedOpp.id })}>
              <TrendingUp className="w-3.5 h-3.5" />
              Open {linkedOpp.opp_number}
            </Button>
          ) : (
            lead.stage === 'Qualified' &&
            editable && (
              <Button
                size="sm"
                onClick={() => {
                  setOppTitle(`${org?.name || 'Deal'} — ${lead.purpose}`);
                  setOppNextStep(lead.qualified_next_step || 'Prepare commercial proposal');
                  setOppOpen(true);
                }}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Create Opportunity
              </Button>
            )
          )}
          {editable && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActConflicts([]);
                setActError('');
                setActOpen(true);
              }}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Log Activity / Action
            </Button>
          )}
        </div>
      </div>

      {pageError && <ErrorAlert message={pageError} onClose={() => setPageError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {isLocked && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#0F295C]">
          <Lock className="w-4 h-4 text-[#1D4ED8]" />
          <span>This qualified lead already has an opportunity ({linkedOpp?.opp_number}) and is read-only for your role.</span>
        </div>
      )}

      {suggestedStage && editable && (
        <InfoBanner
          title={`Suggested Stage Change: ${suggestedStage}`}
          body={`${suggestionReason} Stage changes always require human confirmation.`}
          action={
            <Button size="sm" onClick={() => handleStageSelect(suggestedStage!)}>
              Move to {suggestedStage}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          }
        />
      )}

      {/* Stage Progression Bar */}
      <Card className="p-4">
        <div className="text-xs font-semibold text-[#0F295C] mb-2.5">Lead Stage Progression</div>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((st) => {
            const active = lead.stage === st;
            const requiresManager = (st === 'Qualified' || st === 'Lost') && !isManagerPlus(currentUser?.role || 'Viewer');
            return (
              <button
                key={st}
                disabled={!editable || active || requiresManager}
                onClick={() => handleStageSelect(st)}
                title={requiresManager ? 'Requires Manager or Admin role' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  active
                    ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                    : editable && !requiresManager
                    ? 'bg-white text-[#0F295C] border-[#BFDBFE] hover:bg-[#EFF6FF]'
                    : 'bg-[#F4F8FF] text-[#7C98C4] border-[#DBEAFE]'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          {/* Next Action Card */}
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#0A1936]">Current Next Action</h2>
            {nextAction ? (
              <div className="p-3.5 rounded-lg bg-[#F4F8FF] border border-[#BFDBFE] space-y-2">
                <div className="flex items-center justify-between">
                  <StatusIndicator status={nextAction.action_type} />
                  <span className="text-xs font-medium text-[#0F295C] tabular-nums">
                    Due {formatShortDate(nextAction.due_date)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[#0A1936]">{nextAction.summary}</div>
                {editable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOutcomeNote('');
                      setCompleteId(nextAction.id);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete Action
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#3B5998]">No open primary next action scheduled.</p>
            )}
          </Card>

          {/* Details & Status Selectors */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#0A1936]">Lead Context &amp; Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Response Status">
                <select
                  disabled={!editable}
                  value={lead.response_status}
                  onChange={(e) => updateLead(lead.id, { response_status: e.target.value as ResponseStatus })}
                  className={selectCls}
                >
                  <option value="Awaiting response">Awaiting response</option>
                  <option value="Positive response">Positive response</option>
                  <option value="Requested follow-up">Requested follow-up</option>
                  <option value="No response">No response</option>
                  <option value="Declined">Declined</option>
                </select>
              </Field>
              <Field label="Demonstration Status">
                <select
                  disabled={!editable}
                  value={lead.demonstration_status}
                  onChange={(e) => updateLead(lead.id, { demonstration_status: e.target.value as DemonstrationStatus })}
                  className={selectCls}
                >
                  <option value="Not yet offered">Not yet offered</option>
                  <option value="Offered">Offered</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Not required">Not required</option>
                </select>
              </Field>
            </div>
            <div className="text-sm space-y-2 pt-2 border-t border-[#EFF6FF]">
              <div>
                <span className="text-xs text-[#3B5998] block">Organization</span>
                <button
                  onClick={() => org && onNavigate({ page: 'organization', id: org.id })}
                  className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  {org?.name}
                </button>
              </div>
              <div>
                <span className="text-xs text-[#3B5998] block">Primary Contact</span>
                <button
                  onClick={() => primaryContact && onNavigate({ page: 'contact', id: primaryContact.id })}
                  className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  {primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : '—'}
                </button>
              </div>
              {lead.purpose_details && (
                <div>
                  <span className="text-xs text-[#3B5998] block">Purpose Details</span>
                  <span className="text-[#0F295C]">{lead.purpose_details}</span>
                </div>
              )}
              {lead.qualified_next_step && (
                <div>
                  <span className="text-xs text-[#3B5998] block">Manager-Approved Commercial Step</span>
                  <span className="font-medium text-[#0A1936]">{lead.qualified_next_step}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Rule-based Explainable Lead Score */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0A1936] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#1D4ED8]" />
                Explainable Lead Score
              </h2>
              <span className="text-lg font-semibold text-[#1D4ED8] tabular-nums">{totalScore} / 100</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {scoreBreakdown.map((row) => (
                <div key={row.label} className="flex justify-between text-[#3B5998]">
                  <span>{row.label}</span>
                  <span className="font-semibold text-[#0F295C] tabular-nums">+{row.pts} pts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="lg:col-span-7 p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#0A1936]">Lead Timeline &amp; Activities</h2>
          {leadActivities.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No activities logged yet.</p>
          ) : (
            <div className="divide-y divide-[#EFF6FF]">
              {leadActivities.map((act) => {
                const actOwner = state.users.find((u) => u.id === act.owner_id);
                return (
                  <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIndicator status={act.type} />
                        <span className="text-sm font-medium text-[#0A1936]">{act.summary}</span>
                      </div>
                      <span className="text-xs text-[#3B5998] tabular-nums shrink-0">
                        {formatDateTime(act.occurred_at)}
                      </span>
                    </div>
                    {act.details && <p className="text-xs text-[#3B5998] mt-1">{act.details}</p>}
                    {act.outcome_note && <p className="text-xs text-[#0F295C] mt-1">Outcome: {act.outcome_note}</p>}
                    <div className="text-[11px] text-[#3B5998] mt-1">
                      Owner: {actOwner?.name || 'System'} · Status: {act.status}
                      {act.due_date ? ` · Due ${formatShortDate(act.due_date)}` : ''}
                      {act.is_immutable ? ' · Immutable log' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Stage Transition Modal */}
      <Modal
        open={Boolean(stageModal)}
        onClose={() => setStageModal(null)}
        title={`Transition Lead to ${stageModal}`}
      >
        <form onSubmit={submitStageModal} className="space-y-4">
          {stageError && <ErrorAlert message={stageError} />}
          {stageModal === 'Demo scheduled' && (
            <>
              <Field label="Demo Date & Time" required>
                <input type="datetime-local" value={demoAt} onChange={(e) => setDemoAt(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Timezone" required>
                <input type="text" value={demoTz} onChange={(e) => setDemoTz(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Attendees" required>
                <input type="text" value={demoAttendees} onChange={(e) => setDemoAttendees(e.target.value)} className={inputCls} required />
              </Field>
            </>
          )}
          {stageModal === 'On hold' && (
            <>
              <Field label="Reason for On Hold" required>
                <input type="text" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Future Revisit Date" required>
                <input type="date" min={addDaysIso(todayIso(), 1)} value={revisitDate} onChange={(e) => setRevisitDate(e.target.value)} className={inputCls} required />
              </Field>
            </>
          )}
          {stageModal === 'Qualified' && (
            <Field label="Manager-Approved Agreed Next Commercial Step" required>
              <textarea rows={3} value={qualNextStep} onChange={(e) => setQualNextStep(e.target.value)} className={inputCls} required />
            </Field>
          )}
          {stageModal === 'Lost' && (
            <Field label="Close Reason" required>
              <textarea rows={3} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} className={inputCls} required />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStageModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Stage Change</Button>
          </div>
        </form>
      </Modal>

      {/* Log Activity Modal */}
      <Modal open={actOpen} onClose={() => setActOpen(false)} title="Log Activity / Schedule Next Action">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitActivity(false);
          }}
          className="space-y-4"
        >
          {actError && <ErrorAlert message={actError} />}
          {actConflicts.length > 0 && (
            <div className="p-4 rounded-lg bg-[#EFF6FF] border border-[#1D4ED8] space-y-2">
              <div className="text-sm font-semibold text-[#0F295C]">Calendar Conflict Detected</div>
              {actConflicts.map((c) => (
                <div key={c.id} className="text-xs bg-white p-2 rounded border border-[#BFDBFE]">
                  {c.summary} ({formatDateTime(c.scheduled_at)})
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setActConflicts([])}>
                  Change Time
                </Button>
                <Button type="button" size="sm" onClick={() => submitActivity(true)}>
                  Confirm Double-Booking
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type" required>
              <select value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className={selectCls}>
                <option value="Call">Call</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demo</option>
                <option value="Message">Message</option>
                <option value="Note">Note</option>
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" min={5} value={actDuration} onChange={(e) => setActDuration(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>

          <Field label="Summary" required>
            <input type="text" value={actSummary} onChange={(e) => setActSummary(e.target.value)} className={inputCls} required />
          </Field>

          <Field label="Details">
            <textarea rows={2} value={actDetails} onChange={(e) => setActDetails(e.target.value)} className={inputCls} />
          </Field>

          {['Call', 'Meeting', 'Demo'].includes(actType) && (
            <Field label="Scheduled Date & Time (optional; checks owner calendar)">
              <input
                type="datetime-local"
                value={actScheduled}
                onChange={(e) => {
                  setActScheduled(e.target.value);
                  setActConflicts([]);
                }}
                className={inputCls}
              />
            </Field>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-[#0F295C]">
            <input type="checkbox" checked={actIsNext} onChange={(e) => setActIsNext(e.target.checked)} />
            Set as open Next Action
          </label>

          {actIsNext && (
            <Field label="Due Date" required>
              <input type="date" min={todayIso()} value={actDue} onChange={(e) => setActDue(e.target.value)} className={inputCls} required />
            </Field>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Activity</Button>
          </div>
        </form>
      </Modal>

      {/* Complete Action Modal */}
      <Modal open={Boolean(completeId)} onClose={() => setCompleteId(null)} title="Complete Action">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!completeId) return;
            const res = completeAction(completeId, outcomeNote);
            if (!res.ok) {
              setPageError(res.error || 'Failed to complete action.');
              return;
            }
            setCompleteId(null);
            setToast('Action completed.');
          }}
          className="space-y-4"
        >
          <Field label="Outcome Note" required>
            <textarea rows={3} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} className={inputCls} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCompleteId(null)}>
              Cancel
            </Button>
            <Button type="submit">Mark Completed</Button>
          </div>
        </form>
      </Modal>

      {/* Create Opportunity Modal */}
      <Modal open={oppOpen} onClose={() => setOppOpen(false)} title="Create Opportunity from Qualified Lead">
        <form onSubmit={handleCreateOpp} className="space-y-4">
          {oppError && <ErrorAlert message={oppError} />}
          <Field label="Opportunity Title" required>
            <input type="text" value={oppTitle} onChange={(e) => setOppTitle(e.target.value)} className={inputCls} required />
          </Field>
          <Field label={`Estimated Deal Value (${state.settings.currency})`} required>
            <input type="number" min={0} step="0.01" value={oppAmountDollars} onChange={(e) => setOppAmountDollars(e.target.value)} className={inputCls} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Next Commercial Step" required>
              <input type="text" value={oppNextStep} onChange={(e) => setOppNextStep(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Next Step Due Date" required>
              <input type="date" min={todayIso()} value={oppDue} onChange={(e) => setOppDue(e.target.value)} className={inputCls} required />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOppOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Opportunity</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
