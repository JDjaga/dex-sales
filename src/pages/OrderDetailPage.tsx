import React, { useState } from 'react';
import { ArrowLeft, Ban, Receipt, TrendingUp } from 'lucide-react';
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
} from '../components/ui';
import { formatCents, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';

export const OrderDetailPage: React.FC<{ orderId: string; onNavigate: (r: NavRoute) => void }> = ({
  orderId,
  onNavigate,
}) => {
  const {
    state,
    visibleOrders,
    visibleInvoices,
    visibleOpportunities,
    canEdit,
    createDraftInvoiceFromOrder,
    cancelOrder,
  } = useCrm();

  const order = visibleOrders.find((o) => o.id === orderId);
  const currency = state.settings.currency || 'USD';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  if (!order) {
    return (
      <EmptyState
        title="Order not accessible"
        description="This order doesn't exist, or you don't have access to it."
        action={<Button onClick={() => onNavigate({ page: 'invoices' })}>Go to Invoices &amp; Orders</Button>}
      />
    );
  }

  const opp = visibleOpportunities.find((o) => o.id === order.opportunity_id);
  const relatedInvoices = visibleInvoices.filter((i) => i.order_id === order.id);
  const activeInvoice = relatedInvoices.find((i) => i.status !== 'Void');
  const editable = canEdit(order);

  const handleCreateInvoice = () => {
    setError('');
    const res = createDraftInvoiceFromOrder(order.id);
    if (!res.ok) {
      setError(res.error || 'Could not create invoice.');
      return;
    }
    if (res.data) onNavigate({ page: 'invoice', id: res.data.id });
  };

  const handleCancelOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = cancelOrder(order.id, cancelReason);
    if (!res.ok) {
      setError(res.error || 'Could not cancel order.');
      setCancelOpen(false);
      return;
    }
    setCancelOpen(false);
    setToast('Order cancelled and opportunity returned to Negotiation.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE]">
        <div>
          <button
            onClick={() => (opp ? onNavigate({ page: 'opportunity', id: opp.id }) : onNavigate({ page: 'opportunities' }))}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {opp ? `Back to ${opp.opp_number}` : 'Opportunities'}
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936] font-mono">{order.order_number}</h1>
            <StatusIndicator status={order.status} />
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {order.org_snapshot.name} · Created {formatShortDate(order.created_at)} · Total {formatCents(order.total_cents, currency)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeInvoice ? (
            <Button size="sm" onClick={() => onNavigate({ page: 'invoice', id: activeInvoice.id })}>
              <Receipt className="w-3.5 h-3.5" />
              Open Invoice {activeInvoice.invoice_number || '(Draft)'}
            </Button>
          ) : (
            editable &&
            order.status === 'Active' && (
              <Button size="sm" onClick={handleCreateInvoice}>
                <Receipt className="w-3.5 h-3.5" />
                Create Draft Invoice
              </Button>
            )
          )}

          {editable && order.status === 'Active' && (
            <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
              <Ban className="w-3.5 h-3.5" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {order.status === 'Cancelled' && (
        <div className="p-4 rounded-lg bg-[#F4F8FF] border border-[#BFDBFE] text-sm text-[#0F295C]">
          <strong>Cancelled on {formatShortDate(order.cancelled_at)}:</strong> {order.cancel_reason}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#0A1936]">Order Snapshot Lines</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#DBEAFE] text-xs font-semibold text-[#3B5998]">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF6FF]">
              {order.lines_snapshot.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5">
                    <div className="font-medium text-[#0A1936]">{l.product_name_snapshot || l.description}</div>
                    <div className="text-xs text-[#3B5998]">{l.sku_snapshot}</div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {l.quantity_thousandths / 1000} {l.unit}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatCents(l.unit_price_cents, currency)}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">
                    {formatCents(l.line_total_cents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pt-3 border-t border-[#DBEAFE] flex justify-between font-semibold text-[#0A1936]">
            <span>Order Total</span>
            <span className="tabular-nums text-[#1D4ED8]">{formatCents(order.total_cents, currency)}</span>
          </div>
        </Card>

        <Card className="lg:col-span-4 p-5 space-y-4 h-fit">
          <h2 className="text-base font-semibold text-[#0A1936]">Linked Records</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-[#3B5998] block">Source Quote</span>
              <button
                onClick={() => onNavigate({ page: 'quote', id: order.quote_id })}
                className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                Open Source Quote
              </button>
            </div>
            {opp && (
              <div>
                <span className="text-xs text-[#3B5998] block">Opportunity</span>
                <button
                  onClick={() => onNavigate({ page: 'opportunity', id: opp.id })}
                  className="font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  {opp.opp_number} ({opp.stage})
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Order"
        subtitle="Requires no active (non-void) invoices. Returns opportunity to Negotiation."
      >
        <form onSubmit={handleCancelOrder} className="space-y-4">
          <Field label="Cancellation Reason" required>
            <textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className={inputCls} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Order
            </Button>
            <Button type="submit">Confirm Cancellation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
