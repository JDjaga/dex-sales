import React, { useMemo, useState } from 'react';
import { ArrowLeft, Edit3, FileSpreadsheet, Plus } from 'lucide-react';
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
import { addDaysIso, formatCents, formatDateTime, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus } from '../store/policy';
import type { OpportunityStage } from '../types/crm';

export const OpportunityDetailPage: React.FC<{ oppId: string; onNavigate: (r: NavRoute) => void }> = ({
  oppId,
  onNavigate,
}) => {
  const {
    state,
    currentUser,
    visibleOpportunities,
    visibleOrganizations,
    visibleContacts,
    visibleLeads,
    visibleQuotes,
    visibleOrders,
    visibleActivities,
    canEdit,
    updateOpportunity,
    createQuote,
  } = useCrm();

  const opp = visibleOpportunities.find((o) => o.id === oppId);
  const [editOpen, setEditOpen] = useState(false);
  const [editStage, setEditStage] = useState<OpportunityStage>(opp?.stage || 'Discovery');
  const [editValueDollars, setEditValueDollars] = useState(String((opp?.estimated_value_cents || 0) / 100));
  const [editProb, setEditProb] = useState(String(opp?.probability || 20));
  const [editNextStep, setEditNextStep] = useState(opp?.next_step || '');
  const [editNextDue, setEditNextDue] = useState(opp?.next_step_due_date || todayIso());
  const [editCloseReason, setEditCloseReason] = useState(opp?.close_reason || '');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const oppQuotes = useMemo(() => visibleQuotes.filter((q) => q.opportunity_id === oppId), [visibleQuotes, oppId]);
  const oppOrders = useMemo(() => visibleOrders.filter((o) => o.opportunity_id === oppId), [visibleOrders, oppId]);
  const timeline = useMemo(
    () =>
      visibleActivities
        .filter((a) => a.opportunity_id === oppId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [visibleActivities, oppId]
  );

  if (!opp) {
    return (
      <EmptyState
        title="Opportunity not accessible"
        description="This opportunity does not exist or is outside your current visibility scope."
        action={<Button onClick={() => onNavigate({ page: 'opportunities' })}>Back to Opportunities</Button>}
      />
    );
  }

  const org = visibleOrganizations.find((o) => o.id === opp.organization_id);
  const contact = visibleContacts.find((c) => c.id === opp.primary_contact_id);
  const lead = visibleLeads.find((l) => l.id === opp.lead_id);
  const owner = state.users.find((u) => u.id === opp.owner_id);
  const editable = canEdit(opp);
  const currency = state.settings.currency || 'USD';

  const handleCreateDraftQuote = () => {
    setError('');
    const activeProd = state.products.find((p) => p.is_active);
    const res = createQuote({
      opportunity_id: opp.id,
      contact_id: opp.primary_contact_id,
      valid_until: addDaysIso(todayIso(), 30),
      notes_terms: 'Net 30 days from invoice issue.',
      lines: activeProd
        ? [
            {
              product_id: activeProd.id,
              description: activeProd.description,
              quantity_thousandths: 1000,
              unit: activeProd.unit,
              unit_price_cents: activeProd.unit_price_cents,
              discount_cents: 0,
            },
          ]
        : [],
    });
    if (!res.ok) {
      setError(res.error || 'Could not create draft quote.');
      return;
    }
    if (res.data) onNavigate({ page: 'quote', id: res.data.id });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = updateOpportunity(opp.id, {
      stage: editStage,
      estimated_value_cents: Math.round(Number(editValueDollars || 0) * 100),
      probability: editStage === opp.stage ? Number(editProb) : undefined,
      next_step: editNextStep,
      next_step_due_date: editNextDue,
      close_reason: editCloseReason,
    });
    if (!res.ok) {
      setError(res.error || 'Could not update opportunity.');
      return;
    }
    setEditOpen(false);
    setToast('Opportunity updated.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE]">
        <div>
          <button
            onClick={() => onNavigate({ page: 'opportunities' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Opportunities
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936]">
              {opp.opp_number} · {opp.title}
            </h1>
            <StatusIndicator status={opp.stage} />
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {org?.name} · Contact: {contact ? `${contact.first_name} ${contact.last_name}` : '—'} · Owner: {owner?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && opp.stage !== 'Won' && opp.stage !== 'Lost' && (
            <Button size="sm" onClick={handleCreateDraftQuote}>
              <Plus className="w-3.5 h-3.5" />
              New Quote
            </Button>
          )}
          {editable && (opp.stage !== 'Lost' || isManagerPlus(currentUser?.role || 'Viewer')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditStage(opp.stage);
                setEditValueDollars(String(opp.estimated_value_cents / 100));
                setEditProb(String(opp.probability));
                setEditNextStep(opp.next_step);
                setEditNextDue(opp.next_step_due_date || todayIso());
                setEditCloseReason(opp.close_reason);
                setEditOpen(true);
              }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Update Deal
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {/* Deal Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-[#3B5998]">Estimated Value</div>
          <div className="text-xl font-semibold text-[#0A1936] tabular-nums mt-1">
            {formatCents(opp.estimated_value_cents, currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#3B5998]">Probability</div>
          <div className="text-xl font-semibold text-[#0A1936] tabular-nums mt-1">{opp.probability}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#3B5998]">Weighted Value</div>
          <div className="text-xl font-semibold text-[#1D4ED8] tabular-nums mt-1">
            {formatCents(opp.weighted_value_cents, currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#3B5998]">Visible Next Step</div>
          <div className="text-sm font-semibold text-[#0A1936] mt-1">{opp.next_step || '—'}</div>
          <div className="text-xs text-[#3B5998] tabular-nums">Due {formatShortDate(opp.next_step_due_date)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          {/* Quote History */}
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#1D4ED8]" />
              Quotes ({oppQuotes.length})
            </h2>
            {oppQuotes.length === 0 ? (
              <p className="text-xs text-[#3B5998]">No quotes created on this opportunity yet.</p>
            ) : (
              <div className="space-y-2">
                {oppQuotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => onNavigate({ page: 'quote', id: q.id })}
                    className="w-full text-left p-3 rounded-lg border border-[#DBEAFE] hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#1D4ED8]">
                        {q.quote_number} · {formatCents(q.total_cents, currency)}
                      </div>
                      <div className="text-xs text-[#3B5998] tabular-nums">
                        Valid until {formatShortDate(q.valid_until)}
                      </div>
                    </div>
                    <StatusIndicator status={q.status} />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Orders & Origin Lead */}
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#0A1936]">Orders &amp; Source Records</h2>
            {oppOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => onNavigate({ page: 'order', id: ord.id })}
                className="w-full text-left p-3 rounded-lg border border-[#93C5FD] bg-[#F4F8FF] hover:bg-[#EFF6FF] flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-sm font-semibold text-[#1D4ED8]">
                    {ord.order_number} · {formatCents(ord.total_cents, currency)}
                  </div>
                  <div className="text-xs text-[#3B5998]">Created {formatShortDate(ord.created_at)}</div>
                </div>
                <StatusIndicator status={ord.status} />
              </button>
            ))}
            <div className="pt-2 border-t border-[#EFF6FF] text-xs space-y-1">
              {lead && (
                <div>
                  Source Lead:{' '}
                  <button
                    onClick={() => onNavigate({ page: 'lead', id: lead.id })}
                    className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    {lead.lead_number} · {lead.purpose}
                  </button>
                </div>
              )}
              {org && (
                <div>
                  Organization:{' '}
                  <button
                    onClick={() => onNavigate({ page: 'organization', id: org.id })}
                    className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    {org.name}
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="lg:col-span-6 p-5 space-y-3">
          <h2 className="text-base font-semibold text-[#0A1936]">Opportunity Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No opportunity timeline entries yet.</p>
          ) : (
            <div className="divide-y divide-[#EFF6FF]">
              {timeline.map((act) => (
                <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <StatusIndicator status={act.type} />
                    <span className="text-xs text-[#3B5998] tabular-nums">{formatDateTime(act.occurred_at)}</span>
                  </div>
                  <div className="text-sm font-medium text-[#0A1936] mt-1">{act.summary}</div>
                  {act.details && <div className="text-xs text-[#3B5998]">{act.details}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update Opportunity">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Stage (Won requires Order creation)">
              <select
                value={editStage}
                onChange={(e) => setEditStage(e.target.value as OpportunityStage)}
                className={selectCls}
                disabled={opp.stage === 'Won'}
              >
                <option value="Discovery">Discovery (20%)</option>
                <option value="Proposal">Proposal (40%)</option>
                <option value="Negotiation">Negotiation (70%)</option>
                {opp.stage === 'Won' && <option value="Won">Won (100%)</option>}
                <option value="Lost">Lost (0%)</option>
              </select>
            </Field>
            <Field label="Probability % (resets on stage change)">
              <input
                type="number"
                min={0}
                max={100}
                value={editProb}
                onChange={(e) => setEditProb(e.target.value)}
                disabled={editStage !== opp.stage}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label={`Estimated Value (${currency})`}>
            <input type="number" min={0} step="0.01" value={editValueDollars} onChange={(e) => setEditValueDollars(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Next Step">
              <input type="text" value={editNextStep} onChange={(e) => setEditNextStep(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Next Step Due Date">
              <input type="date" value={editNextDue} onChange={(e) => setEditNextDue(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {editStage === 'Lost' && (
            <Field label="Close Reason" required>
              <textarea rows={2} value={editCloseReason} onChange={(e) => setEditCloseReason(e.target.value)} className={inputCls} required />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Deal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
