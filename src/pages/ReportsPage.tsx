import React, { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  Button,
  Card,
  ErrorAlert,
  Field,
  PageHeader,
  StatusIndicator,
  SuccessBanner,
  inputCls,
} from '../components/ui';
import { addDaysIso, downloadCsv, formatCents, formatShortDate, parseCsv, todayIso, toCsv } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus } from '../store/policy';
import { AreaChart, CHART_COLORS, DonutChart } from '../components/charts';
import { FadeIn } from '../components/motion';

export const ReportsPage: React.FC = () => {
  const {
    state,
    currentUser,
    visiblePayments,
    visibleOrganizations,
    visibleActivities,
    visibleLeads,
    visibleInvoices,
    importOrganizationsCsv,
    recordAuditExport,
  } = useCrm();

  const [fromDate, setFromDate] = useState(addDaysIso(todayIso(), -90));
  const [toDate, setToDate] = useState(todayIso());

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: Array<{ row: number; reason: string }> } | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const currency = state.settings.currency || 'USD';

  const earnedPayments = useMemo(
    () =>
      visiblePayments.filter(
        (p) => p.status === 'Valid' && p.payment_date >= fromDate && p.payment_date <= toDate
      ),
    [visiblePayments, fromDate, toDate]
  );

  const earnedTotalCents = earnedPayments.reduce((s, p) => s + p.amount_cents, 0);

  const activityByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of visibleActivities) {
      const d = a.occurred_at.slice(0, 10);
      if (d < fromDate || d > toDate) continue;
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return Object.entries(counts);
  }, [visibleActivities, fromDate, toDate]);

  // Revenue trend across the selected date range (6 equal buckets)
  const revenueTrend = useMemo(() => {
    const bucketCount = 6;
    const startMs = Date.parse(`${fromDate}T00:00:00`);
    const endMs = Date.parse(`${toDate}T00:00:00`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return [];
    const span = endMs - startMs;
    const bucketMs = span / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      label: formatShortDate(new Date(startMs + i * bucketMs).toISOString().slice(0, 10)),
      value: 0,
    }));
    for (const p of earnedPayments) {
      const t = Date.parse(`${p.payment_date}T00:00:00`);
      if (Number.isNaN(t)) continue;
      const idx = Math.min(bucketCount - 1, Math.floor((t - startMs) / bucketMs));
      buckets[idx].value += p.amount_cents;
    }
    return buckets;
  }, [earnedPayments, fromDate, toDate]);

  const exportEarnedRevenue = () => {
    const rows = earnedPayments.map((p) => {
      const org = visibleOrganizations.find((o) => o.id === p.organization_id);
      const inv = visibleInvoices.find((i) => i.id === p.invoice_id);
      return [
        p.payment_date,
        inv?.invoice_number || '',
        org?.name || '',
        p.method,
        p.reference,
        (p.amount_cents / 100).toFixed(2),
        currency,
      ];
    });
    const csv = toCsv(['Payment Date', 'Invoice #', 'Organization', 'Method', 'Reference', 'Amount', 'Currency'], rows);
    downloadCsv(`dex-sales-earned-revenue-${todayIso()}.csv`, csv);
    recordAuditExport('Earned Revenue', rows.length);
    setToast(`Exported ${rows.length} permitted revenue record(s).`);
  };

  const exportLeadsCsv = () => {
    const rows = visibleLeads.map((l) => {
      const org = visibleOrganizations.find((o) => o.id === l.organization_id);
      return [l.lead_number, org?.name || '', l.purpose, l.stage, l.priority, l.source, l.created_at.slice(0, 10)];
    });
    const csv = toCsv(['Lead #', 'Organization', 'Purpose', 'Stage', 'Priority', 'Source', 'Created'], rows);
    downloadCsv(`dex-sales-leads-${todayIso()}.csv`, csv);
    recordAuditExport('Permitted Leads', rows.length);
    setToast(`Exported ${rows.length} permitted lead record(s).`);
  };

  const handlePreviewCsv = (raw: string) => {
    setCsvText(raw);
    setImportResult(null);
    setError('');
    const parsed = parseCsv(raw);
    if (parsed.length < 2) {
      setPreviewRows([]);
      return;
    }
    const headers = parsed[0].map((h) => h.trim());
    const mapped = parsed.slice(1).map((cols) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? '';
      });
      return obj;
    });
    setPreviewRows(mapped);
  };

  const handleRunImport = () => {
    setError('');
    const res = importOrganizationsCsv(previewRows);
    if (!res.ok) {
      setError(res.error || 'Import failed.');
      return;
    }
    if (res.data) {
      setImportResult(res.data);
      setToast(`Imported ${res.data.imported} organization(s).`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Exports"
        subtitle="Money received, team activity, and data export — filtered to what you can see"
      />

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {/* Date Range Filters */}
      <Card className="p-4 flex flex-wrap items-end gap-4">
        <Field label="From Date">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="To Date">
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button size="sm" variant="secondary" onClick={exportEarnedRevenue}>
            <Download className="w-3.5 h-3.5" />
            Export Revenue CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportLeadsCsv}>
            <Download className="w-3.5 h-3.5" />
            Export Permitted Leads CSV
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Earned Revenue */}
        <Card className="lg:col-span-7 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0A1936]">Money Received</h2>
              <p className="text-xs text-[#3B5998]">Only confirmed payments are counted — unpaid or reversed ones are left out.</p>
            </div>
            <div className="text-xl font-semibold text-[#1D4ED8] tabular-nums">
              {formatCents(earnedTotalCents, currency)}
            </div>
          </div>

          {revenueTrend.length > 0 && revenueTrend.some((b) => b.value > 0) && (
            <FadeIn>
              <AreaChart
                data={revenueTrend}
                height={160}
                color="#1D4ED8"
                formatValue={(n) => formatCents(Math.round(n), currency)}
              />
            </FadeIn>
          )}

          {earnedPayments.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No valid payments recorded in this date window.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#DBEAFE] text-xs font-semibold text-[#3B5998]">
                  <th className="py-2">Payment Date</th>
                  <th className="py-2">Organization</th>
                  <th className="py-2">Method</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF]">
                {earnedPayments.map((p) => {
                  const org = visibleOrganizations.find((o) => o.id === p.organization_id);
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 tabular-nums text-xs">{formatShortDate(p.payment_date)}</td>
                      <td className="py-2.5 font-medium text-[#0A1936]">{org?.name || 'Organization'}</td>
                      <td className="py-2.5 text-xs text-[#3B5998]">{p.method.replace('_', ' ')}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-[#1D4ED8]">
                        {formatCents(p.amount_cents, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Activity Breakdown */}
        <Card className="lg:col-span-5 p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#0A1936]">Team Activity</h2>
          {activityByType.length === 0 ? (
            <p className="text-xs text-[#3B5998]">No activities in selected date range.</p>
          ) : (
            <>
              <FadeIn>
                <DonutChart
                  data={activityByType.map(([label, value], i) => ({
                    label,
                    value,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                  size={140}
                  thickness={18}
                  centerLabel="Activities"
                  centerValue={String(activityByType.reduce((s, [, c]) => s + c, 0))}
                />
              </FadeIn>
              <div className="space-y-2.5 pt-2">
                {activityByType.map(([type, cnt]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-[#EFF6FF] last:border-0">
                  <StatusIndicator status={type} />
                  <span className="font-semibold text-[#0A1936] tabular-nums">{cnt}</span>
                </div>
              ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Authorized CSV Import */}
      {currentUser && isManagerPlus(currentUser.role) && (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#0A1936] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#1D4ED8]" />
              Import Organizations from a File
            </h2>
            <p className="text-xs text-[#3B5998] mt-0.5">
              Upload a spreadsheet (CSV) with up to 500 rows. Columns:{' '}
              <code>name, org_type, country, city_region, website</code>
            </p>
          </div>

          <textarea
            rows={4}
            value={csvText}
            onChange={(e) => handlePreviewCsv(e.target.value)}
            className={`${inputCls} font-mono text-xs`}
            placeholder={`name,org_type,country,city_region,website\nNordic Development Bank (Sample),Bank,Switzerland,Zurich,https://example.org`}
          />

          {previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[#0F295C]">
                Previewing {previewRows.length} row(s) — showing up to first 5:
              </div>
              <div className="overflow-x-auto border border-[#DBEAFE] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F8FF] border-b border-[#DBEAFE]">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Country</th>
                      <th className="py-2 px-3">City</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFF6FF]">
                    {previewRows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3">{r.name || '—'}</td>
                        <td className="py-2 px-3">{r.org_type || 'Other'}</td>
                        <td className="py-2 px-3">{r.country || '—'}</td>
                        <td className="py-2 px-3">{r.city_region || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="sm" onClick={handleRunImport}>
                Import Valid Rows
              </Button>
            </div>
          )}

          {importResult && (
            <div className="p-3.5 rounded-lg bg-[#F4F8FF] border border-[#BFDBFE] text-xs space-y-1.5">
              <div className="font-semibold text-[#0F295C]">
                Imported: {importResult.imported} · Rejected/Skipped: {importResult.skipped.length}
              </div>
              {importResult.skipped.map((s) => (
                <div key={s.row} className="text-[#3B5998]">
                  Row {s.row}: {s.reason}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
