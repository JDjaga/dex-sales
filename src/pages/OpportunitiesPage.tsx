import React, { useMemo, useState } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import { Card, EmptyState, PageHeader, StatusIndicator, inputCls, selectCls } from '../components/ui';
import { formatCents, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';
import type { OpportunityStage } from '../types/crm';

const OPP_STAGES: OpportunityStage[] = ['Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export const OpportunitiesPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, visibleOpportunities, visibleOrganizations, visibleContacts } = useCrm();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const currency = state.settings.currency || 'USD';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleOpportunities.filter((op) => {
      if (stageFilter !== 'All' && op.stage !== stageFilter) return false;
      if (!q) return true;
      const org = visibleOrganizations.find((o) => o.id === op.organization_id);
      return (
        op.opp_number.toLowerCase().includes(q) ||
        op.title.toLowerCase().includes(q) ||
        (org?.name || '').toLowerCase().includes(q)
      );
    });
  }, [visibleOpportunities, visibleOrganizations, search, stageFilter]);

  const totalOpenWeighted = filtered
    .filter((o) => o.stage !== 'Won' && o.stage !== 'Lost')
    .reduce((s, o) => s + o.weighted_value_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities & Pipeline"
        subtitle={`Open deal value in view: ${formatCents(totalOpenWeighted, currency)} · Deals are created from qualified leads`}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunity #, title, or organization..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={`${selectCls} sm:w-48`}>
          <option value="All">All Stages</option>
          {OPP_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No opportunities found"
          description="Opportunities are created from Manager-qualified leads. Qualify a lead first to open a commercial opportunity."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-4">Organization &amp; Contact</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4 text-right">Weighted</th>
                  <th className="py-3 px-4">Next Step &amp; Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((op) => {
                  const org = visibleOrganizations.find((o) => o.id === op.organization_id);
                  const contact = visibleContacts.find((c) => c.id === op.primary_contact_id);
                  return (
                    <tr key={op.id} className="hover:bg-[#F4F8FF] transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'opportunity', id: op.id })}
                          className="font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1.5 text-left cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                          <span>{op.opp_number} · {op.title}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0A1936]">{org?.name || 'Organization'}</div>
                        <div className="text-xs text-[#3B5998]">
                          {contact ? `${contact.first_name} ${contact.last_name}` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={op.stage} />
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-[#0A1936]">
                        {formatCents(op.estimated_value_cents, currency)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#1D4ED8] font-semibold">
                        {formatCents(op.weighted_value_cents, currency)} ({op.probability}%)
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-[#0A1936]">{op.next_step || '—'}</div>
                        <div className="text-[#3B5998] tabular-nums">{formatShortDate(op.next_step_due_date)}</div>
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
