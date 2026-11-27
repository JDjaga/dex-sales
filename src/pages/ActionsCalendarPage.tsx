import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
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
} from '../components/ui';
import { addDaysIso, formatDateTime, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isReadOnlyRole } from '../store/policy';

export const ActionsCalendarPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, currentUser, visibleActivities, completeAction } = useCrm();
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const today = todayIso();
  const endOfWeek = addDaysIso(today, 7);

  const openActions = useMemo(() => {
    return visibleActivities
      .filter((a) => a.status === 'Open' && (scope === 'team' || a.owner_id === currentUser?.id))
      .sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'));
  }, [visibleActivities, scope, currentUser]);

  const groups = {
    overdue: openActions.filter((a) => a.due_date && a.due_date < today),
    today: openActions.filter((a) => a.due_date === today),
    thisWeek: openActions.filter((a) => a.due_date && a.due_date > today && a.due_date <= endOfWeek),
    later: openActions.filter((a) => !a.due_date || a.due_date > endOfWeek),
  };

  const scheduledEvents = useMemo(() => {
    return visibleActivities
      .filter((a) => a.scheduled_at && a.status !== 'Cancelled' && (scope === 'team' || a.owner_id === currentUser?.id))
      .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''));
  }, [visibleActivities, scope, currentUser]);

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingId) return;
    setError('');
    const res = completeAction(completingId, outcomeNote);
    if (!res.ok) {
      setError(res.error || 'Could not complete action.');
      return;
    }
    setCompletingId(null);
    setOutcomeNote('');
    setToast('Action completed.');
  };

  const renderBucket = (title: string, items: typeof openActions, badge: string) => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#DBEAFE]">
        <h2 className="text-sm font-semibold text-[#0A1936] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#1D4ED8]" />
          {title}
        </h2>
        <StatusIndicator status={`${items.length} ${badge}`} />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#3B5998]">No actions in this bucket.</p>
      ) : (
        <div className="divide-y divide-[#EFF6FF]">
          {items.map((act) => {
            const owner = state.users.find((u) => u.id === act.owner_id);
            return (
              <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <button
                    onClick={() => {
                      if (act.entity_type === 'lead') onNavigate({ page: 'lead', id: act.entity_id });
                      else if (act.entity_type === 'opportunity') onNavigate({ page: 'opportunity', id: act.entity_id });
                      else if (act.entity_type === 'organization') onNavigate({ page: 'organization', id: act.entity_id });
                    }}
                    className="text-sm font-medium text-[#1D4ED8] hover:underline text-left cursor-pointer"
                  >
                    {act.summary}
                  </button>
                  <div className="text-xs text-[#3B5998] tabular-nums">
                    {act.action_type} · Due {formatShortDate(act.due_date)} · Owner: {owner?.name || 'Unassigned'}
                  </div>
                </div>
                {currentUser && !isReadOnlyRole(currentUser.role) && (
                  <Button size="sm" variant="outline" onClick={() => setCompletingId(act.id)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actions & Authorized Calendar"
        subtitle="Prioritized follow-up queue and scheduled calls, meetings, and demos"
        actions={
          <div className="inline-flex rounded-lg border border-[#BFDBFE] bg-[#F4F8FF] p-0.5">
            <button
              onClick={() => setScope('mine')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                scope === 'mine' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
              }`}
            >
              My Actions
            </button>
            <button
              onClick={() => setScope('team')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                scope === 'team' ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C]'
              }`}
            >
              Permitted Team
            </button>
          </div>
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {renderBucket('Overdue', groups.overdue, 'overdue')}
          {renderBucket('Today', groups.today, 'today')}
          {renderBucket('This Week', groups.thisWeek, 'upcoming')}
          {renderBucket('Later', groups.later, 'later')}
        </div>

        <Card className="p-5 space-y-4 h-fit">
          <div className="flex items-center justify-between pb-2 border-b border-[#DBEAFE]">
            <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1D4ED8]" />
              Scheduled Calls, Meetings &amp; Demos
            </h2>
            <span className="text-xs text-[#3B5998]">Local CRM Calendar</span>
          </div>

          {scheduledEvents.length === 0 ? (
            <EmptyState
              title="No timed events scheduled"
              description="Schedule timed calls, meetings, or demos from any Lead or Opportunity page. Calendar conflicts are automatically checked."
            />
          ) : (
            <div className="divide-y divide-[#EFF6FF]">
              {scheduledEvents.map((ev) => {
                const owner = state.users.find((u) => u.id === ev.owner_id);
                return (
                  <div key={ev.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusIndicator status={ev.type} />
                      <span className="text-xs font-semibold text-[#1D4ED8] tabular-nums">
                        {formatDateTime(ev.scheduled_at)} ({ev.duration_minutes}m)
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#0A1936]">{ev.summary}</div>
                    <div className="text-xs text-[#3B5998]">
                      Owner: {owner?.name} · {ev.timezone}
                      {ev.location_or_link ? ` · ${ev.location_or_link}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal open={Boolean(completingId)} onClose={() => setCompletingId(null)} title="Complete Action">
        <form onSubmit={handleComplete} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <Field label="Outcome Note" required>
            <textarea rows={3} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} className={inputCls} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCompletingId(null)}>
              Cancel
            </Button>
            <Button type="submit">Complete Action</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
