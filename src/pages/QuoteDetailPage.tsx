import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CopyPlus,
  Mail,
  Plus,
  Printer,
  Send,
  ShoppingBag,
  Trash2,
  XCircle,
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
import { calcLineTotalCents, formatCents, formatShortDate, isPastDate } from '../lib/format';
import { useCrm } from '../store/crmStore';

interface EditableLine {
  product_id: string | null;
  description: string;
  quantity: string;
  unit: string;
  unit_price_dollars: string;
  discount_dollars: string;
}

export const QuoteDetailPage: React.FC<{ quoteId: string; onNavigate: (r: NavRoute) => void }> = ({
  quoteId,
  onNavigate,
}) => {
  const {
    state,
    visibleQuotes,
    visibleContacts,
    visibleOrders,
    visibleOpportunities,
    canEdit,
    updateQuote,
    markQuoteSent,
    recordQuoteDecision,
    reviseQuote,
    deleteQuote,
    createOrderFromQuote,
  } = useCrm();

  const quote = visibleQuotes.find((q) => q.id === quoteId);
  const existingOrder = visibleOrders.find((o) => o.quote_id === quoteId);
  const opp = visibleOpportunities.find((o) => o.id === quote?.opportunity_id);
  const currency = state.settings.currency || 'USD';

  const [contactId, setContactId] = useState(quote?.contact_id || '');
  const [validUntil, setValidUntil] = useState(quote?.valid_until || '');
  const [notesTerms, setNotesTerms] = useState(quote?.notes_terms || '');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [printPreview, setPrintPreview] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (quote) {
      setContactId(quote.contact_id);
      setValidUntil(quote.valid_until);
      setNotesTerms(quote.notes_terms);
      setLines(
        quote.lines.map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: String(l.quantity_thousandths / 1000),
          unit: l.unit,
          unit_price_dollars: (l.unit_price_cents / 100).toFixed(2),
          discount_dollars: (l.discount_cents / 100).toFixed(2),
        }))
      );
    }
  }, [quote?.id, quote?.updated_at]);

  if (!quote) {
    return (
      <EmptyState
        title="Quote not accessible"
        description="This quote does not exist or is outside your visibility scope."
        action={<Button onClick={() => onNavigate({ page: 'quotes' })}>Back to Quotes</Button>}
      />
    );
  }

  const editable = canEdit(quote) && quote.status === 'Draft';
  const activeProducts = state.products.filter((p) => p.is_active);
  const orgContacts = visibleContacts.filter((c) =>
    state.contactMemberships.some((m) => m.contact_id === c.id && m.organization_id === quote.organization_id && m.is_active)
  );

  const computedLines = lines.map((l) => {
    const qtyT = Math.max(1, Math.round(Number(l.quantity || 1) * 1000));
    const priceC = Math.max(0, Math.round(Number(l.unit_price_dollars || 0) * 100));
    const discC = Math.max(0, Math.round(Number(l.discount_dollars || 0) * 100));
    return {
      product_id: l.product_id,
      description: l.description,
      quantity_thousandths: qtyT,
      unit: l.unit,
      unit_price_cents: priceC,
      discount_cents: discC,
      line_total_cents: calcLineTotalCents(qtyT, priceC, discC),
    };
  });
  const liveTotalCents = computedLines.reduce((s, l) => s + l.line_total_cents, 0);

  const saveDraft = () => {
    setError('');
    const res = updateQuote(quote.id, {
      contact_id: contactId,
      valid_until: validUntil,
      notes_terms: notesTerms,
      lines: computedLines,
    });
    if (!res.ok) {
      setError(res.error || 'Could not save quote draft.');
      return false;
    }
    setToast('Draft quote saved.');
    return true;
  };

  const handleMarkSent = () => {
    setError('');
    if (editable && !saveDraft()) return;
    const res = markQuoteSent(quote.id);
    if (!res.ok) {
      setError(res.error || 'Could not mark quote Sent.');
      return;
    }
    setToast('Quote marked as Sent and locked. (Status recorded only — external email is not configured.)');
  };

  const handleAccept = () => {
    setError('');
    const res = recordQuoteDecision(quote.id, 'Accepted');
    if (!res.ok) {
      setError(res.error || 'Could not record acceptance.');
      return;
    }
    setToast('Quote marked Accepted. You may now create an order.');
  };

  const handleDecline = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = recordQuoteDecision(quote.id, 'Declined', declineReason);
    if (!res.ok) {
      setError(res.error || 'Could not record decline.');
      return;
    }
    setDeclineOpen(false);
    setToast('Quote marked Declined.');
  };

  const handleRevise = () => {
    setError('');
    const res = reviseQuote(quote.id);
    if (!res.ok) {
      setError(res.error || 'Could not revise quote.');
      return;
    }
    if (res.data) onNavigate({ page: 'quote', id: res.data.id });
  };

  const handleCreateOrder = () => {
    setError('');
    const res = createOrderFromQuote(quote.id);
    if (!res.ok) {
      setError(res.error || 'Could not create order.');
      return;
    }
    if (res.data) onNavigate({ page: 'order', id: res.data.id });
  };

  const handleDelete = () => {
    setError('');
    const res = deleteQuote(quote.id);
    if (!res.ok) {
      setError(res.error || 'Could not delete quote.');
      return;
    }
    onNavigate({ page: 'quotes' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE] no-print">
        <div>
          <button
            onClick={() => (opp ? onNavigate({ page: 'opportunity', id: opp.id }) : onNavigate({ page: 'quotes' }))}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {opp ? `Back to ${opp.opp_number}` : 'All Quotes'}
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936] font-mono">{quote.quote_number}</h1>
            <StatusIndicator status={quote.status} />
            {quote.status !== 'Draft' && <StatusIndicator status="Locked" />}
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {quote.org_snapshot.name} · Valid until {formatShortDate(quote.valid_until)}
            {isPastDate(quote.valid_until) && quote.status === 'Sent' ? ' (Expired)' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPrintPreview(!printPreview)}>
            <Printer className="w-3.5 h-3.5" />
            {printPreview ? 'Back to Builder' : 'PDF Preview & Print'}
          </Button>

          {(quote.status === 'Sent' || quote.status === 'Accepted') && (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Email dispatch is disabled in static demo (SMTP not configured)"
            >
              <Mail className="w-3.5 h-3.5" />
              Email PDF (SMTP unconfigured)
            </Button>
          )}

          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={saveDraft}>
                Save Draft
              </Button>
              <Button size="sm" onClick={handleMarkSent}>
                <Send className="w-3.5 h-3.5" />
                Mark as Sent
              </Button>
            </>
          )}

          {canEdit(quote) && quote.status === 'Sent' && (
            <>
              <Button size="sm" onClick={handleAccept}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Record Acceptance
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeclineOpen(true)}>
                <XCircle className="w-3.5 h-3.5" />
                Record Decline
              </Button>
            </>
          )}

          {canEdit(quote) && quote.status !== 'Draft' && !existingOrder && (
            <Button size="sm" variant="outline" onClick={handleRevise}>
              <CopyPlus className="w-3.5 h-3.5" />
              Revise Quote
            </Button>
          )}

          {canEdit(quote) && quote.status === 'Accepted' && !existingOrder && (
            <Button size="sm" onClick={handleCreateOrder}>
              <ShoppingBag className="w-3.5 h-3.5" />
              Create Order
            </Button>
          )}

          {existingOrder && (
            <Button size="sm" onClick={() => onNavigate({ page: 'order', id: existingOrder.id })}>
              <ShoppingBag className="w-3.5 h-3.5" />
              Open {existingOrder.order_number}
            </Button>
          )}

          {canEdit(quote) && !existingOrder && (
            <Button size="sm" variant="ghost" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {printPreview ? (
        /* BRANDED PRINT / PDF VIEW */
        <Card className="p-8 space-y-6">
          <div className="flex justify-between items-start pb-5 border-b border-[#DBEAFE]">
            <div>
              <BrandLogo size="sm" />
              <div className="text-xs text-[#3B5998] mt-2">{state.settings.legal_entity_name}</div>
              <div className="text-xs text-[#3B5998]">{state.settings.invoice_address}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-[#0A1936]">COMMERCIAL QUOTE</div>
              <div className="text-sm font-mono font-semibold text-[#1D4ED8]">{quote.quote_number}</div>
              <div className="text-xs text-[#3B5998] mt-1">
                Status: {quote.status} · Valid Until: {formatShortDate(quote.valid_until)}
              </div>
              <Button size="sm" className="mt-3 no-print" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                Print / Save as PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-xs font-semibold text-[#3B5998]">PREPARED FOR</div>
              <div className="font-semibold text-[#0A1936] mt-1">
                {quote.org_snapshot.legal_name || quote.org_snapshot.name}
              </div>
              <div className="text-xs text-[#3B5998]">
                Attn: {quote.contact_snapshot.first_name} {quote.contact_snapshot.last_name}
              </div>
              <div className="text-xs text-[#3B5998]">
                {quote.org_snapshot.billing_address || quote.org_snapshot.country}
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#EFF6FF] border-y border-[#BFDBFE] text-xs font-semibold text-[#0F295C]">
                <th className="py-2.5 px-3">Item / Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF6FF]">
              {quote.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[#0A1936]">
                      {l.product_name_snapshot || l.description}
                      {l.sku_snapshot ? ` (${l.sku_snapshot})` : ''}
                    </div>
                    {l.product_name_snapshot && l.description && (
                      <div className="text-xs text-[#3B5998]">{l.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {l.quantity_thousandths / 1000} {l.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatCents(l.unit_price_cents, currency)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatCents(l.discount_cents, currency)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                    {formatCents(l.line_total_cents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#3B5998]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCents(quote.subtotal_cents, currency)}</span>
              </div>
              <div className="flex justify-between text-[#3B5998]">
                <span>Discounts</span>
                <span className="tabular-nums">-{formatCents(quote.discount_total_cents, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#0A1936] pt-2 border-t border-[#BFDBFE] text-base">
                <span>Total</span>
                <span className="tabular-nums text-[#1D4ED8]">{formatCents(quote.total_cents, currency)}</span>
              </div>
            </div>
          </div>

          {quote.notes_terms && (
            <div className="pt-4 border-t border-[#DBEAFE] text-xs text-[#3B5998]">
              <strong className="text-[#0F295C]">Terms &amp; Notes:</strong> {quote.notes_terms}
            </div>
          )}
        </Card>
      ) : (
        /* QUOTE BUILDER / SNAPSHOT VIEW */
        <div className="space-y-6">
          <Card className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Quote Contact">
              <select
                disabled={!editable}
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={selectCls}
              >
                {orgContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.work_email || c.personal_email || c.phone})
                  </option>
                ))}
                {orgContacts.length === 0 && (
                  <option value={quote.contact_id}>
                    {quote.contact_snapshot.first_name} {quote.contact_snapshot.last_name}
                  </option>
                )}
              </select>
            </Field>

            <Field label="Valid Until Date">
              <input
                type="date"
                disabled={!editable}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputCls}
              />
            </Field>

            <div>
              <div className="text-xs font-medium text-[#0F295C] mb-1">Quote Total</div>
              <div className="text-2xl font-semibold text-[#1D4ED8] tabular-nums">
                {formatCents(editable ? liveTotalCents : quote.total_cents, currency)}
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0A1936]">Quote Lines ({lines.length} / 100)</h2>
              {editable && lines.length < 100 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setLines([
                      ...lines,
                      {
                        product_id: activeProducts[0]?.id || null,
                        description: activeProducts[0]?.description || 'Custom item',
                        quantity: '1',
                        unit: activeProducts[0]?.unit || 'Unit',
                        unit_price_dollars: activeProducts[0] ? (activeProducts[0].unit_price_cents / 100).toFixed(2) : '0.00',
                        discount_dollars: '0.00',
                      },
                    ])
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line
                </Button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="text-xs text-[#3B5998]">No quote lines yet. Add at least one line before marking Sent.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const rowTotal = computedLines[idx]?.line_total_cents || 0;
                  return (
                    <div key={idx} className="p-3 rounded-lg border border-[#DBEAFE] bg-[#F4F8FF] grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                      <div className="md:col-span-3">
                        <Field label="Catalog Product (optional)">
                          <select
                            disabled={!editable}
                            value={line.product_id || ''}
                            onChange={(e) => {
                              const pid = e.target.value || null;
                              const prod = activeProducts.find((p) => p.id === pid);
                              const next = [...lines];
                              next[idx] = {
                                ...next[idx],
                                product_id: pid,
                                description: prod ? prod.description : next[idx].description,
                                unit: prod ? prod.unit : next[idx].unit,
                                unit_price_dollars: prod ? (prod.unit_price_cents / 100).toFixed(2) : next[idx].unit_price_dollars,
                              };
                              setLines(next);
                            }}
                            className={selectCls}
                          >
                            <option value="">Custom line</option>
                            {activeProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.sku} · {p.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="md:col-span-3">
                        <Field label="Description">
                          <input
                            type="text"
                            disabled={!editable}
                            value={line.description}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setLines(next);
                            }}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-1">
                        <Field label="Qty">
                          <input
                            type="number"
                            min="0.1"
                            step="0.5"
                            disabled={!editable}
                            value={line.quantity}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], quantity: e.target.value };
                              setLines(next);
                            }}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Unit Price">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!editable}
                            value={line.unit_price_dollars}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], unit_price_dollars: e.target.value };
                              setLines(next);
                            }}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-1">
                        <Field label="Disc.">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!editable}
                            value={line.discount_dollars}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], discount_dollars: e.target.value };
                              setLines(next);
                            }}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between gap-2 pb-1.5">
                        <span className="text-sm font-semibold text-[#0A1936] tabular-nums">
                          {formatCents(rowTotal, currency)}
                        </span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                            className="p-1.5 text-[#3B5998] hover:text-[#0F295C] cursor-pointer"
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Field label="Notes & Commercial Terms">
              <textarea
                rows={3}
                disabled={!editable}
                value={notesTerms}
                onChange={(e) => setNotesTerms(e.target.value)}
                className={inputCls}
              />
            </Field>
          </Card>
        </div>
      )}

      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Record Quote Decline">
        <form onSubmit={handleDecline} className="space-y-4">
          <Field label="Decline Reason (optional)">
            <textarea rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record Decline</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
