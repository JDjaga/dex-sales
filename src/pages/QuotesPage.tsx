import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import { Card, EmptyState, PageHeader, StatusIndicator, inputCls, selectCls } from '../components/ui';
import { formatCents, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';

export const QuotesPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, visibleQuotes, visibleOpportunities } = useCrm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const currency = state.settings.currency || 'USD';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleQuotes.filter((qt) => {
      if (statusFilter !== 'All' && qt.status !== statusFilter) return false;
      if (!q) return true;
      return (
        qt.quote_number.toLowerCase().includes(q) ||
        qt.org_snapshot.name.toLowerCase().includes(q)
      );
    });
  }, [visibleQuotes, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        subtitle="Snapshot-locked commercial proposals created on open opportunities"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote # or organization..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Declined">Declined</option>
          <option value="Revised">Revised</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No quotes found"
          description="Open an active Opportunity and click New Quote to build a commercial quote."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((qt) => {
                  const opp = visibleOpportunities.find((o) => o.id === qt.opportunity_id);
                  return (
                    <tr key={qt.id} className="hover:bg-[#F4F8FF]">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'quote', id: qt.id })}
                          className="font-mono font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          {qt.quote_number}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0A1936]">{qt.org_snapshot.name}</td>
                      <td className="py-3 px-4 text-xs text-[#3B5998]">{opp?.opp_number || '—'}</td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={qt.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-[#3B5998] tabular-nums">
                        {formatShortDate(qt.valid_until)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[#0A1936] tabular-nums">
                        {formatCents(qt.total_cents, currency)}
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
