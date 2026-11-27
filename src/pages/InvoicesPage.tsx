import React, { useMemo, useState } from 'react';
import { Receipt, Search, ShoppingBag } from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import { Card, EmptyState, PageHeader, StatusIndicator, inputCls, selectCls } from '../components/ui';
import { formatCents, formatShortDate, todayIso } from '../lib/format';
import { useCrm } from '../store/crmStore';

export const InvoicesPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, visibleInvoices, visibleOrders } = useCrm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const currency = state.settings.currency || 'USD';
  const today = todayIso();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleInvoices.filter((inv) => {
      if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (inv.invoice_number || 'Draft').toLowerCase().includes(q) ||
        inv.org_snapshot.name.toLowerCase().includes(q)
      );
    });
  }, [visibleInvoices, search, statusFilter]);

  const uninvoicedOrders = visibleOrders.filter(
    (ord) => ord.status === 'Active' && !visibleInvoices.some((i) => i.order_id === ord.id && i.status !== 'Void')
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Payments"
        subtitle="Sequential invoice numbering on issue · Manual payment entry & reversals"
      />

      {uninvoicedOrders.length > 0 && (
        <Card className="p-4 bg-[#F4F8FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-[#0F295C]">
            <strong>{uninvoicedOrders.length} active order(s)</strong> are awaiting draft invoice creation.
          </div>
          <div className="flex flex-wrap gap-2">
            {uninvoicedOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => onNavigate({ page: 'order', id: ord.id })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#BFDBFE] text-xs font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {ord.order_number} · {ord.org_snapshot.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or organization..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Issued">Issued</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
          <option value="Void">Void</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Create an invoice from an Active Order to issue and record payments."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((inv) => {
                  const isOverdue =
                    (inv.status === 'Issued' || inv.status === 'Partially Paid') && inv.due_date < today;
                  return (
                    <tr key={inv.id} className="hover:bg-[#F4F8FF]">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'invoice', id: inv.id })}
                          className="font-mono font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          {inv.invoice_number || 'Draft (Unissued)'}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0A1936]">{inv.org_snapshot.name}</td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={isOverdue ? 'Overdue' : inv.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-[#3B5998] tabular-nums">
                        {formatShortDate(inv.due_date)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{formatCents(inv.total_cents, currency)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#3B5998]">
                        {formatCents(inv.amount_paid_cents, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#0A1936]">
                        {formatCents(inv.balance_due_cents, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
