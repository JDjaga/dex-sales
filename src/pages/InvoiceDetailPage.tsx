import React, { useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Printer,
  RotateCcw,
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
import { formatCents, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus } from '../store/policy';
import type { PaymentMethod } from '../types/crm';

export const InvoiceDetailPage: React.FC<{ invoiceId: string; onNavigate: (r: NavRoute) => void }> = ({
  invoiceId,
  onNavigate,
}) => {
  const {
    state,
    currentUser,
    visibleInvoices,
    visiblePayments,
    canEdit,
    updateDraftInvoice,
    issueInvoice,
    voidInvoice,
    recordPayment,
    reversePayment,
  } = useCrm();

  const invoice = visibleInvoices.find((i) => i.id === invoiceId);
  const invPayments = visiblePayments.filter((p) => p.invoice_id === invoiceId);
  const currency = invoice?.currency || state.settings.currency || 'USD';

  const [printPreview, setPrintPreview] = useState(false);
  const [dueDate, setDueDate] = useState(invoice?.due_date || todayIso());
  const [notes, setNotes] = useState(invoice?.notes || '');

  const [payOpen, setPayOpen] = useState(false);
  const [payAmountDollars, setPayAmountDollars] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payError, setPayError] = useState('');

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const [revId, setRevId] = useState<string | null>(null);
  const [revReason, setRevReason] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not accessible"
        description="This invoice doesn't exist, or you don't have access to it."
        action={<Button onClick={() => onNavigate({ page: 'invoices' })}>Back to Invoices</Button>}
      />
    );
  }

  const managerPlus = isManagerPlus(currentUser?.role || 'Viewer');
  const editableDraft = canEdit(invoice) && invoice.status === 'Draft';

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = updateDraftInvoice(invoice.id, { due_date: dueDate, notes });
    if (!res.ok) setError(res.error || 'Could not update draft.');
    else setToast('Draft invoice saved.');
  };

  const handleIssue = () => {
    setError('');
    const res = issueInvoice(invoice.id);
    if (!res.ok) setError(res.error || 'Could not issue invoice.');
    else setToast(`Invoice issued as ${res.data?.invoice_number}.`);
  };

  const handleVoid = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = voidInvoice(invoice.id, voidReason);
    if (!res.ok) {
      setError(res.error || 'Could not void invoice.');
      setVoidOpen(false);
      return;
    }
    setVoidOpen(false);
    setToast('Invoice voided.');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    const cents = Math.round(Number(payAmountDollars || 0) * 100);
    const res = recordPayment(invoice.id, {
      amount_cents: cents,
      payment_date: payDate,
      method: payMethod,
      reference: payRef,
    });
    if (!res.ok) {
      setPayError(res.error || 'Could not record payment.');
      return;
    }
    setPayOpen(false);
    setPayRef('');
    setToast(`Recorded manual payment of ${formatCents(cents, currency)}.`);
  };

  const handleReverse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revId) return;
    setError('');
    const res = reversePayment(revId, revReason);
    if (!res.ok) {
      setError(res.error || 'Could not reverse payment.');
      setRevId(null);
      return;
    }
    setRevId(null);
    setRevReason('');
    setToast('Payment reversed; original payment and reversal preserved in history.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE] no-print">
        <div>
          <button
            onClick={() => onNavigate({ page: 'invoices' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Invoices
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936] font-mono">
              {invoice.invoice_number || 'Draft Invoice (Number assigned on issue)'}
            </h1>
            <StatusIndicator status={invoice.status} />
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {invoice.org_snapshot.name} · Due {formatShortDate(invoice.due_date)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPrintPreview(!printPreview)}>
            <Printer className="w-3.5 h-3.5" />
            {printPreview ? 'Back to Details' : 'PDF Preview & Print'}
          </Button>

          {managerPlus && invoice.status === 'Draft' && (
            <Button size="sm" onClick={handleIssue}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Issue Invoice
            </Button>
          )}

          {managerPlus && (invoice.status === 'Issued' || invoice.status === 'Partially Paid') && (
            <Button
              size="sm"
              onClick={() => {
                setPayError('');
                setPayAmountDollars((invoice.balance_due_cents / 100).toFixed(2));
                setPayDate(todayIso());
                setPayOpen(true);
              }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Record Manual Payment
            </Button>
          )}

          {managerPlus && invoice.status === 'Issued' && invoice.amount_paid_cents === 0 && (
            <Button size="sm" variant="outline" onClick={() => setVoidOpen(true)}>
              <Ban className="w-3.5 h-3.5" />
              Void Invoice
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {printPreview ? (
        /* BRANDED INVOICE PDF / PRINT VIEW */
        <Card className="p-8 space-y-6">
          <div className="flex justify-between items-start pb-5 border-b border-[#DBEAFE]">
            <div>
              <BrandLogo size="sm" />
              <div className="text-xs text-[#3B5998] mt-2">{state.settings.legal_entity_name}</div>
              <div className="text-xs text-[#3B5998]">{state.settings.invoice_address}</div>
              {state.settings.tax_registration_number && (
                <div className="text-xs text-[#3B5998]">Tax ID: {state.settings.tax_registration_number}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-[#0A1936]">INVOICE</div>
              <div className="text-sm font-mono font-semibold text-[#1D4ED8]">
                {invoice.invoice_number || 'DRAFT (UNISSUED)'}
              </div>
              <div className="text-xs text-[#3B5998] mt-1">
                Status: {invoice.status} · Issue: {formatShortDate(invoice.issue_date)} · Due:{' '}
                {formatShortDate(invoice.due_date)}
              </div>
              <Button size="sm" className="mt-3 no-print" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                Print / Save as PDF
              </Button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#3B5998]">BILL TO</div>
            <div className="font-semibold text-[#0A1936] mt-1">
              {invoice.org_snapshot.legal_name || invoice.org_snapshot.name}
            </div>
            <div className="text-xs text-[#3B5998]">
              Attn: {invoice.contact_snapshot.first_name} {invoice.contact_snapshot.last_name}
            </div>
            <div className="text-xs text-[#3B5998]">
              {invoice.org_snapshot.billing_address || invoice.org_snapshot.country}
            </div>
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#EFF6FF] border-y border-[#BFDBFE] text-xs font-semibold text-[#0F295C]">
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF6FF]">
              {invoice.lines_snapshot.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[#0A1936]">{l.product_name_snapshot || l.description}</div>
                    {l.product_name_snapshot && l.description && (
                      <div className="text-xs text-[#3B5998]">{l.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {l.quantity_thousandths / 1000} {l.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatCents(l.unit_price_cents, currency)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                    {formatCents(l.line_total_cents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#3B5998]">Invoice Total</span>
                <span className="font-semibold tabular-nums">{formatCents(invoice.total_cents, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#3B5998]">Amount Paid</span>
                <span className="font-semibold tabular-nums">{formatCents(invoice.amount_paid_cents, currency)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#BFDBFE] text-base font-bold text-[#0A1936]">
                <span>Balance Due</span>
                <span className="tabular-nums text-[#1D4ED8]">{formatCents(invoice.balance_due_cents, currency)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="pt-4 border-t border-[#DBEAFE] text-xs text-[#3B5998]">
              <strong className="text-[#0F295C]">Notes:</strong> {invoice.notes}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-[#0A1936]">Financial Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#3B5998]">Invoice Total</span>
                  <span className="font-semibold tabular-nums">{formatCents(invoice.total_cents, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#3B5998]">Valid Payments Received</span>
                  <span className="font-semibold tabular-nums">{formatCents(invoice.amount_paid_cents, currency)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#DBEAFE] text-base font-semibold">
                  <span>Balance Due</span>
                  <span className="tabular-nums text-[#1D4ED8]">{formatCents(invoice.balance_due_cents, currency)}</span>
                </div>
              </div>

              {editableDraft && (
                <form onSubmit={handleSaveDraft} className="pt-4 border-t border-[#DBEAFE] space-y-3">
                  <Field label="Due Date">
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Invoice Notes">
                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                  </Field>
                  <Button type="submit" size="sm" variant="outline">
                    Save Draft Changes
                  </Button>
                </form>
              )}

              {invoice.status === 'Void' && (
                <div className="p-3 rounded-lg bg-[#F4F8FF] border border-[#BFDBFE] text-xs text-[#0F295C]">
                  <strong>Voided:</strong> {invoice.void_reason}
                </div>
              )}

              <div className="pt-2 border-t border-[#EFF6FF] text-xs">
                <button
                  onClick={() => onNavigate({ page: 'order', id: invoice.order_id })}
                  className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  Open Source Order
                </button>
              </div>
            </Card>
          </div>

          <Card className="lg:col-span-7 p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#0A1936]">Recorded Payments &amp; Reversal History</h2>
              <p className="text-xs text-[#3B5998]">
                Manual entry only (no payment gateway connected). Earned revenue counts valid, non-reversed payments by payment date.
              </p>
            </div>

            {invPayments.length === 0 ? (
              <p className="text-xs text-[#3B5998]">No payments recorded on this invoice yet.</p>
            ) : (
              <div className="divide-y divide-[#EFF6FF]">
                {invPayments.map((p) => (
                  <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0A1936] tabular-nums">
                          {formatCents(p.amount_cents, currency)}
                        </span>
                        <StatusIndicator status={p.status} />
                      </div>
                      <div className="text-xs text-[#3B5998] mt-0.5 tabular-nums">
                        Date: {formatShortDate(p.payment_date)} · Method: {p.method.replace('_', ' ')}
                        {p.reference ? ` · Ref: ${p.reference}` : ''}
                      </div>
                      {p.status === 'Reversed' && (
                        <div className="text-xs text-[#0F295C] mt-1">
                          Reversed on {formatShortDate(p.reversed_at)}: {p.reversal_reason}
                        </div>
                      )}
                    </div>

                    {managerPlus && p.status === 'Valid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRevReason('');
                          setRevId(p.id);
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reverse
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Manual Payment Modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Manual Payment"
        subtitle={`Current balance due: ${formatCents(invoice.balance_due_cents, currency)}`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {payError && <ErrorAlert message={payError} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Amount (${currency})`} required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payAmountDollars}
                onChange={(e) => setPayAmountDollars(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Payment Date (not in future)" required>
              <input
                type="date"
                max={todayIso()}
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Method" required>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={selectCls}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className={inputCls}
                placeholder="Wire / SWIFT reference"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Post Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Void Invoice Modal */}
      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Void Issued Invoice">
        <form onSubmit={handleVoid} className="space-y-4">
          <Field label="Void Reason" required>
            <textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className={inputCls} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Void Invoice</Button>
          </div>
        </form>
      </Modal>

      {/* Reverse Payment Modal */}
      <Modal open={Boolean(revId)} onClose={() => setRevId(null)} title="Reverse Payment">
        <form onSubmit={handleReverse} className="space-y-4">
          <Field label="Reversal Reason" required>
            <textarea rows={3} value={revReason} onChange={(e) => setRevReason(e.target.value)} className={inputCls} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRevId(null)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Reversal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
