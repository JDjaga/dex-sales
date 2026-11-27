import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lightbulb,
  Plus,
} from 'lucide-react';
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
import { addDaysIso, formatCents, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isReadOnlyRole } from '../store/policy';
import type { ActionType } from '../types/crm';
import { AreaChart, AnimatedBar, CHART_COLORS, DonutChart } from '../components/charts';
import { CountUp, FadeIn, StaggerContainer, StaggerItem } from '../components/motion';

export const DashboardPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const {
    state,
    currentUser,
    visibleOrganizations,
    visibleLeads,
    visibleOpportunities,
    visibleActivities,
    visibleQuotes,
    visibleOrders,
    visibleInvoices,
    visiblePayments,
    completeAction,
    setSuggestionStatus,
  } = useCrm();

  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(90);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [followUpSummary, setFollowUpSummary] = useState('');
  const [followUpType, setFollowUpType] = useState<ActionType>('Follow-up' as ActionType);
  const [followUpDue, setFollowUpDue] = useState(addDaysIso(todayIso(), 3));
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');

  const today = todayIso();
  const windowCutoff = addDaysIso(today, -windowDays);
  const nearExpiryCutoff = addDaysIso(today, 7);
  const currency = state.settings.currency || 'USD';

  const myOpenLeads = useMemo(
    () =>
      visibleLeads.filter(
        (l) => l.owner_id === currentUser?.id && l.stage !== 'Lost' && l.stage !== 'Qualified'
      ),
    [visibleLeads, currentUser]
  );

  const openActions = useMemo(
    () =>
      visibleActivities
        .filter((a) => a.status === 'Open' && a.due_date)
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [visibleActivities]
  );

  const overdueActions = openActions.filter((a) => (a.due_date || '') < today);
  const dueTodayActions = openActions.filter((a) => a.due_date === today);

  const activeOpps = useMemo(
    () => visibleOpportunities.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost'),
    [visibleOpportunities]
  );
  const weightedPipelineCents = activeOpps.reduce((sum, o) => sum + o.weighted_value_cents, 0);

  const awaitingQuotes = useMemo(
    () => visibleQuotes.filter((q) => q.status === 'Sent'),
    [visibleQuotes]
  );
  const expiringQuotes = awaitingQuotes.filter((q) => q.valid_until <= nearExpiryCutoff);

  const ordersAwaitingInvoice = useMemo(
    () =>
      visibleOrders.filter(
        (ord) =>
          ord.status === 'Active' &&
          !visibleInvoices.some((inv) => inv.order_id === ord.id && inv.status !== 'Void')
      ),
    [visibleOrders, visibleInvoices]
  );

  const outstandingInvoices = useMemo(
    () =>
      visibleInvoices.filter(
        (i) => (i.status === 'Issued' || i.status === 'Partially Paid') && i.balance_due_cents > 0
      ),
    [visibleInvoices]
  );
  const outstandingCents = outstandingInvoices.reduce((s, i) => s + i.balance_due_cents, 0);
  const overdueInvoices = outstandingInvoices.filter((i) => i.due_date < today);
  const overdueCents = overdueInvoices.reduce((s, i) => s + i.balance_due_cents, 0);

  const earnedRevenueCents = useMemo(
    () =>
      visiblePayments
        .filter((p) => p.status === 'Valid' && p.payment_date >= windowCutoff)
        .reduce((s, p) => s + p.amount_cents, 0),
    [visiblePayments, windowCutoff]
  );

  const leadsByStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of visibleLeads) {
      counts[l.stage] = (counts[l.stage] || 0) + 1;
    }
    return Object.entries(counts);
  }, [visibleLeads]);

  const leadsBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of visibleLeads) {
      counts[l.source] = (counts[l.source] || 0) + 1;
    }
    return Object.entries(counts);
  }, [visibleLeads]);

  // Revenue trend: equal time buckets across the selected window
  const revenueTrend = useMemo(() => {
    const bucketCount = 6;
    const windowStart = addDaysIso(today, -windowDays);
    const bucketDays = windowDays / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      label: formatShortDate(addDaysIso(windowStart, Math.round(i * bucketDays))),
      value: 0,
    }));
    const startMs = Date.parse(`${windowStart}T00:00:00`);
    for (const p of visiblePayments) {
      if (p.status !== 'Valid') continue;
      const t = Date.parse(`${p.payment_date}T00:00:00`);
      if (Number.isNaN(t) || t < startMs) continue;
      const idx = Math.min(bucketCount - 1, Math.floor((t - startMs) / (bucketDays * 86400000)));
      buckets[idx].value += p.amount_cents;
    }
    return buckets;
  }, [visiblePayments, windowDays, today]);

  // Open pipeline value grouped by stage
  const pipelineByStage = useMemo(() => {
    const order = ['Discovery', 'Proposal', 'Negotiation'];
    const map = new Map<string, { value: number; count: number }>();
    for (const o of activeOpps) {
      const cur = map.get(o.stage) || { value: 0, count: 0 };
      cur.value += o.estimated_value_cents;
      cur.count += 1;
      map.set(o.stage, cur);
    }
    return order
      .filter((s) => map.has(s))
      .map((s) => ({ stage: s, ...(map.get(s) as { value: number; count: number }) }));
  }, [activeOpps]);
  const maxPipelineValue = Math.max(1, ...pipelineByStage.map((p) => p.value));

  // Rule-based explainable suggestions strictly within permitted visibility
  const suggestions = useMemo(() => {
    const list: Array<{
      key: string;
      title: string;
      reason: string;
      nav: NavRoute;
    }> = [];

    for (const act of overdueActions.slice(0, 2)) {
      list.push({
        key: `overdue-${act.id}`,
        title: `Follow up overdue action: ${act.summary}`,
        reason: `Due date (${formatShortDate(act.due_date)}) is past due.`,
        nav:
          act.entity_type === 'lead'
            ? { page: 'lead', id: act.entity_id }
            : act.entity_type === 'opportunity'
            ? { page: 'opportunity', id: act.entity_id }
            : { page: 'actions' },
      });
    }

    for (const q of expiringQuotes.slice(0, 2)) {
      const org = visibleOrganizations.find((o) => o.id === q.organization_id);
      list.push({
        key: `exp-qt-${q.id}`,
        title: `Quote ${q.quote_number} nears expiry (${org?.name || 'Account'})`,
        reason: `Sent quote expires on ${formatShortDate(q.valid_until)} with no recorded decision.`,
        nav: { page: 'quote', id: q.id },
      });
    }

    for (const ord of ordersAwaitingInvoice.slice(0, 2)) {
      list.push({
        key: `inv-ord-${ord.id}`,
        title: `Create invoice for ${ord.order_number}`,
        reason: `Active order has no draft or issued invoice yet.`,
        nav: { page: 'order', id: ord.id },
      });
    }

    return list.filter((s) => {
      const st = state.suggestionStates[s.key];
      if (!st) return true;
      if (st.status === 'dismissed' || st.status === 'accepted') return false;
      if (st.status === 'snoozed' && st.snooze_until && st.snooze_until > today) return false;
      return true;
    });
  }, [overdueActions, expiringQuotes, ordersAwaitingInvoice, visibleOrganizations, state.suggestionStates, today]);

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingId) return;
    setActionError('');
    const res = completeAction(
      completingId,
      outcomeNote,
      followUpSummary.trim()
        ? {
            summary: followUpSummary.trim(),
            action_type: followUpType === ('Follow-up' as ActionType) ? 'Internal follow-up' : followUpType,
            due_date: followUpDue,
            owner_id: currentUser?.id || '',
          }
        : undefined
    );
    if (!res.ok) {
      setActionError(res.error || 'Could not complete action.');
      return;
    }
    setCompletingId(null);
    setOutcomeNote('');
    setFollowUpSummary('');
    setToast('Action completed and timeline updated.');
  };

  const maxStageCount = Math.max(1, ...leadsByStage.map(([, c]) => c));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Deal Desk"
        subtitle={`Permitted overview for ${currentUser?.name} (${currentUser?.role})`}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#BFDBFE] bg-[#F4F8FF] p-0.5">
              {([30, 90, 180] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setWindowDays(days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    windowDays === days ? 'bg-[#1D4ED8] text-white' : 'text-[#0F295C] hover:bg-white'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            {currentUser && !isReadOnlyRole(currentUser.role) && (
              <Button size="sm" onClick={() => onNavigate({ page: 'leads' })}>
                <Plus className="w-3.5 h-3.5" />
                New Lead
              </Button>
            )}
          </div>
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {/* KPI Summary Strip */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StaggerItem>
        <Card className="p-5">
          <div className="text-xs font-medium text-[#3B5998]">My Open Leads &amp; Actions</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-[#0A1936] tabular-nums">
              <CountUp value={myOpenLeads.length} />
            </span>
            <span className="text-xs text-[#1D4ED8] tabular-nums">
              {overdueActions.length} overdue · {dueTodayActions.length} today
            </span>
          </div>
          <button
            onClick={() => onNavigate({ page: 'actions' })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
          >
            View action queue
            <ArrowRight className="w-3 h-3" />
          </button>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="p-5">
          <div className="text-xs font-medium text-[#3B5998]">Weighted Pipeline</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-[#0A1936] tabular-nums">
              <CountUp value={weightedPipelineCents} format={(n) => formatCents(Math.round(n), currency)} />
            </span>
            <span className="text-xs text-[#3B5998] tabular-nums">{activeOpps.length} open deals</span>
          </div>
          <button
            onClick={() => onNavigate({ page: 'opportunities' })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
          >
            Open opportunities
            <ArrowRight className="w-3 h-3" />
          </button>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="p-5">
          <div className="text-xs font-medium text-[#3B5998]">Outstanding Invoices</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-[#0A1936] tabular-nums">
              <CountUp value={outstandingCents} format={(n) => formatCents(Math.round(n), currency)} />
            </span>
            <span className="text-xs text-[#0F295C] tabular-nums">
              {overdueInvoices.length > 0 ? `${formatCents(overdueCents, currency)} overdue` : 'None overdue'}
            </span>
          </div>
          <button
            onClick={() => onNavigate({ page: 'invoices' })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
          >
            Manage invoices
            <ArrowRight className="w-3 h-3" />
          </button>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="p-5">
          <div className="text-xs font-medium text-[#3B5998]">Earned Revenue ({windowDays}d)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-[#1D4ED8] tabular-nums">
              <CountUp value={earnedRevenueCents} format={(n) => formatCents(Math.round(n), currency)} />
            </span>
            <span className="text-xs text-[#3B5998]">Valid payments</span>
          </div>
          <button
            onClick={() => onNavigate({ page: 'reports' })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
          >
            Revenue report
            <ArrowRight className="w-3 h-3" />
          </button>
        </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Explainable Suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-[#1D4ED8]" />
            <h2 className="text-sm font-semibold text-[#0A1936]">Rule-Based Next Step Suggestions</h2>
          </div>
          <div className="divide-y divide-[#EFF6FF]">
            {suggestions.map((s) => (
              <div key={s.key} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <button
                    onClick={() => onNavigate(s.nav)}
                    className="text-sm font-medium text-[#1D4ED8] hover:underline text-left cursor-pointer"
                  >
                    {s.title}
                  </button>
                  <div className="text-xs text-[#3B5998] mt-0.5">{s.reason}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSuggestionStatus(s.key, 'accepted');
                      onNavigate(s.nav);
                    }}
                  >
                    Open
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSuggestionStatus(s.key, 'snoozed', 7)}>
                    Snooze 7d
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSuggestionStatus(s.key, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Middle Row: Action Queue + Pipeline & Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Actions */}
        <Card className="lg:col-span-7 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#0A1936]">Priority Action Queue</h2>
            <button
              onClick={() => onNavigate({ page: 'actions' })}
              className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
            >
              View all ({openActions.length})
            </button>
          </div>
          {openActions.length === 0 ? (
            <EmptyState
              title="No open actions"
              description="All scheduled actions in your visibility scope are complete."
            />
          ) : (
            <div className="divide-y divide-[#EFF6FF]">
              {openActions.slice(0, 6).map((act) => {
                const isOverdue = (act.due_date || '') < today;
                const isToday = act.due_date === today;
                const owner = state.users.find((u) => u.id === act.owner_id);
                return (
                  <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIndicator status={isOverdue ? 'Overdue' : isToday ? 'Due Today' : act.action_type} />
                        <span className="text-xs text-[#3B5998] tabular-nums">{formatShortDate(act.due_date)}</span>
                        <span className="text-xs text-[#3B5998]">· {owner?.name || 'Unassigned'}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (act.entity_type === 'lead') onNavigate({ page: 'lead', id: act.entity_id });
                          else if (act.entity_type === 'opportunity') onNavigate({ page: 'opportunity', id: act.entity_id });
                          else if (act.entity_type === 'organization') onNavigate({ page: 'organization', id: act.entity_id });
                        }}
                        className="mt-1 text-sm font-medium text-[#0A1936] hover:text-[#1D4ED8] text-left cursor-pointer"
                      >
                        {act.summary}
                      </button>
                    </div>
                    {currentUser && !isReadOnlyRole(currentUser.role) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCompletingId(act.id);
                          setActionError('');
                        }}
                      >
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

        {/* Commercial Attention: Quotes & Orders */}
        <Card className="lg:col-span-5 p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#0A1936]">Quotes Awaiting Decision</h2>
              <span className="text-xs font-medium text-[#1D4ED8] tabular-nums">{awaitingQuotes.length}</span>
            </div>
            {awaitingQuotes.length === 0 ? (
              <p className="text-xs text-[#3B5998]">No sent quotes currently awaiting customer decision.</p>
            ) : (
              <div className="space-y-2">
                {awaitingQuotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => onNavigate({ page: 'quote', id: q.id })}
                    className="w-full text-left p-3 rounded-lg border border-[#DBEAFE] hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#0A1936] truncate">
                        {q.quote_number} · {q.org_snapshot.name}
                      </div>
                      <div className="text-xs text-[#3B5998] tabular-nums">
                        Valid until {formatShortDate(q.valid_until)}
                        {q.valid_until <= nearExpiryCutoff ? ' (Nearing expiry)' : ''}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#1D4ED8] tabular-nums shrink-0">
                      {formatCents(q.total_cents, currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#DBEAFE]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#0A1936]">Orders Awaiting Invoice</h2>
              <span className="text-xs font-medium text-[#1D4ED8] tabular-nums">{ordersAwaitingInvoice.length}</span>
            </div>
            {ordersAwaitingInvoice.length === 0 ? (
              <p className="text-xs text-[#3B5998]">All active orders have a draft or issued invoice.</p>
            ) : (
              <div className="space-y-2">
                {ordersAwaitingInvoice.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => onNavigate({ page: 'order', id: ord.id })}
                    className="w-full text-left p-3 rounded-lg border border-[#DBEAFE] hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#0A1936]">
                        {ord.order_number} · {ord.org_snapshot.name}
                      </div>
                      <div className="text-xs text-[#3B5998]">Ready for invoice creation</div>
                    </div>
                    <span className="text-sm font-semibold text-[#1D4ED8] tabular-nums">
                      {formatCents(ord.total_cents, currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row: Leads by Stage & Source (Blue Bar Charts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-[#0A1936] mb-4">Leads by Stage</h2>
          {leadsByStage.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No leads in your permitted scope.</p>
          ) : (
            <div className="space-y-3">
              {leadsByStage.map(([stage, count], idx) => (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-[#0F295C]">{stage}</span>
                    <span className="text-[#1D4ED8] font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EFF6FF] overflow-hidden">
                    <AnimatedBar
                      pct={(count / maxStageCount) * 100}
                      delay={idx * 0.08}
                      className={idx % 2 === 0 ? 'bg-[#1D4ED8]' : 'bg-[#93C5FD]'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-[#0A1936] mb-4">Leads by Source</h2>
          {leadsBySource.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No leads in your permitted scope.</p>
          ) : (
            <DonutChart
              data={leadsBySource.map(([label, value], i) => ({
                label,
                value,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              size={150}
              thickness={20}
              centerLabel="Leads"
              centerValue={String(visibleLeads.length)}
            />
          )}
        </Card>
      </div>

      {/* Charts Row: Revenue Trend & Open Pipeline by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <FadeIn className="lg:col-span-7">
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#0A1936]">Revenue Trend</h2>
                <p className="text-xs text-[#3B5998] mt-0.5">
                  Valid payments across the last {windowDays} days
                </p>
              </div>
              <span className="text-sm font-semibold text-[#1D4ED8] tabular-nums">
                {formatCents(earnedRevenueCents, currency)}
              </span>
            </div>
            {revenueTrend.every((b) => b.value === 0) ? (
              <p className="text-xs text-[#3B5998] py-8 text-center">
                No valid payments recorded in this window.
              </p>
            ) : (
              <AreaChart
                data={revenueTrend}
                height={200}
                color="#1D4ED8"
                formatValue={(n) => formatCents(Math.round(n), currency)}
              />
            )}
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-5">
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#0A1936]">Open Pipeline by Stage</h2>
                <p className="text-xs text-[#3B5998] mt-0.5">Estimated deal value in active stages</p>
              </div>
              <span className="text-sm font-semibold text-[#1D4ED8] tabular-nums">
                {activeOpps.length} deals
              </span>
            </div>
            {pipelineByStage.length === 0 ? (
              <p className="text-xs text-[#3B5998] py-8 text-center">No open opportunities in scope.</p>
            ) : (
              <div className="space-y-4">
                {pipelineByStage.map((p, idx) => (
                  <div key={p.stage}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#0F295C]">
                        {p.stage}
                        <span className="text-[#3B5998] font-normal"> · {p.count} deal{p.count === 1 ? '' : 's'}</span>
                      </span>
                      <span className="text-[#1D4ED8] font-semibold tabular-nums">
                        {formatCents(p.value, currency)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#EFF6FF] overflow-hidden">
                      <AnimatedBar
                        pct={(p.value / maxPipelineValue) * 100}
                        delay={0.2 + idx * 0.1}
                        className={idx === 0 ? 'bg-[#0F295C]' : idx === 1 ? 'bg-[#1D4ED8]' : 'bg-[#93C5FD]'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </FadeIn>
      </div>

      {/* Complete Action Modal */}
      <Modal
        open={Boolean(completingId)}
        onClose={() => setCompletingId(null)}
        title="Complete Action"
        subtitle="Record an outcome note and optionally schedule the next action."
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          {actionError && <ErrorAlert message={actionError} />}
          <Field label="Outcome Note" required>
            <textarea
              rows={3}
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              className={inputCls}
              placeholder="Summarize what happened and any agreed commitments..."
              required
            />
          </Field>

          <div className="p-4 rounded-lg bg-[#F4F8FF] border border-[#DBEAFE] space-y-3">
            <div className="text-xs font-semibold text-[#0F295C] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
              Optional Follow-up Next Action
            </div>
            <Field label="Next Action Summary">
              <input
                type="text"
                value={followUpSummary}
                onChange={(e) => setFollowUpSummary(e.target.value)}
                className={inputCls}
                placeholder="Leave blank to auto-promote earliest open action"
              />
            </Field>
            {followUpSummary.trim() && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Action Type">
                  <select
                    value={followUpType}
                    onChange={(e) => setFollowUpType(e.target.value as ActionType)}
                    className={selectCls}
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Demo">Demo</option>
                    <option value="Send material">Send material</option>
                    <option value="Internal follow-up">Internal follow-up</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Due Date">
                  <input
                    type="date"
                    min={today}
                    value={followUpDue}
                    onChange={(e) => setFollowUpDue(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
            )}
          </div>

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
