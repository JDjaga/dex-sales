import React, { useMemo, useState } from 'react';
import { Building2, FileText, GitMerge, Plus, Search } from 'lucide-react';
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
import { COUNTRIES, areOrgNamesSimilar, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isManagerPlus, isReadOnlyRole } from '../store/policy';
import type { OrgType } from '../types/crm';

const ORG_TYPES: OrgType[] = [
  'Bank',
  'Financial Institution',
  'Regulator',
  'Government Agency',
  'University',
  'Investor',
  'Development Organization',
  'Corporate Partner',
  'Other',
];

export const OrganizationsPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, currentUser, visibleOrganizations, visibleLeads, createOrganization, mergeOrganizations } = useCrm();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('Bank');
  const [country, setCountry] = useState('United Kingdom');
  const [cityRegion, setCityRegion] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [mainEmail, setMainEmail] = useState('');
  const [mainPhone, setMainPhone] = useState('');
  const [taxReg, setTaxReg] = useState('');

  const [dupMatches, setDupMatches] = useState<Array<{ id: string; label: string; detail: string }>>([]);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  // Merge state
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeError, setMergeError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleOrganizations.filter((o) => {
      if (typeFilter !== 'All' && o.org_type !== typeFilter) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        o.city_region.toLowerCase().includes(q)
      );
    });
  }, [visibleOrganizations, search, typeFilter]);

  const possibleDupes = useMemo(() => {
    const groups: Array<{ a: string; b: string; nameA: string; nameB: string; country: string }> = [];
    for (let i = 0; i < visibleOrganizations.length; i++) {
      for (let j = i + 1; j < visibleOrganizations.length; j++) {
        const oa = visibleOrganizations[i];
        const ob = visibleOrganizations[j];
        if (oa.country.toLowerCase() === ob.country.toLowerCase() && areOrgNamesSimilar(oa.name, ob.name)) {
          groups.push({ a: oa.id, b: ob.id, nameA: oa.name, nameB: ob.name, country: oa.country });
        }
      }
    }
    return groups;
  }, [visibleOrganizations]);

  const submitCreate = (confirmDuplicate: boolean) => {
    setFormError('');
    const res = createOrganization({
      name,
      org_type: orgType,
      country,
      city_region: cityRegion,
      website,
      notes,
      legal_name: legalName,
      billing_address: billingAddress,
      main_email: mainEmail,
      main_phone: mainPhone,
      tax_registration_number: taxReg,
      confirmDuplicate,
    });
    if (!res.ok) {
      if (res.code === 'DUPLICATE_CONFIRM_REQUIRED' && res.duplicates) {
        setDupMatches(res.duplicates);
        return;
      }
      setFormError(res.error || 'Could not create organization.');
      return;
    }
    setCreateOpen(false);
    setName('');
    setCityRegion('');
    setWebsite('');
    setNotes('');
    setLegalName('');
    setBillingAddress('');
    setMainEmail('');
    setMainPhone('');
    setTaxReg('');
    setDupMatches([]);
    setToast(`Created organization "${res.data?.name}".`);
  };

  const handleMerge = (e: React.FormEvent) => {
    e.preventDefault();
    setMergeError('');
    const res = mergeOrganizations(mergeSourceId, mergeTargetId);
    if (!res.ok) {
      setMergeError(res.error || 'Could not merge organizations.');
      return;
    }
    setMergeOpen(false);
    setMergeSourceId('');
    setMergeTargetId('');
    setToast('Organizations merged and all dependent records reassigned.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        subtitle="All the companies and institutions you sell to"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {currentUser && isManagerPlus(currentUser.role) && visibleOrganizations.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMergeError('');
                  setMergeSourceId(possibleDupes[0]?.a || visibleOrganizations[0]?.id || '');
                  setMergeTargetId(possibleDupes[0]?.b || visibleOrganizations[1]?.id || '');
                  setMergeOpen(true);
                }}
              >
                <GitMerge className="w-3.5 h-3.5" />
                Duplicate Review {possibleDupes.length > 0 ? `(${possibleDupes.length})` : ''}
              </Button>
            )}
            {currentUser && !isReadOnlyRole(currentUser.role) && (
              <Button
                size="sm"
                onClick={() => {
                  setFormError('');
                  setDupMatches([]);
                  setCreateOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Organization
              </Button>
            )}
          </div>
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by organization name, country, or city..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={`${selectCls} sm:w-56`}
        >
          <option value="All">All Organization Types</option>
          {ORG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No organizations found"
          description="No organizations match your search — or you don't have access to them."
          action={
            currentUser && !isReadOnlyRole(currentUser.role) ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Organization
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Country / Region</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Leads</th>
                  <th className="py-3 px-4 text-right">Engagement Brief</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((org) => {
                  const owner = state.users.find((u) => u.id === org.owner_id);
                  const leadCount = visibleLeads.filter((l) => l.organization_id === org.id).length;
                  return (
                    <tr key={org.id} className="hover:bg-[#F4F8FF] transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'organization', id: org.id })}
                          className="font-semibold text-[#1D4ED8] hover:underline text-left flex items-center gap-2 cursor-pointer"
                        >
                          <Building2 className="w-4 h-4 shrink-0" />
                          <span>{org.name}</span>
                        </button>
                        <div className="text-xs text-[#3B5998] mt-0.5">Updated {formatShortDate(org.updated_at)}</div>
                      </td>
                      <td className="py-3 px-4 text-[#0F295C]">{org.org_type}</td>
                      <td className="py-3 px-4 text-[#3B5998]">
                        {org.city_region ? `${org.city_region}, ` : ''}
                        {org.country}
                      </td>
                      <td className="py-3 px-4 text-[#0F295C]">{owner?.name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={org.account_status} />
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-[#0A1936]">{leadCount}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onNavigate({ page: 'organization', id: org.id, tab: 'brief' })}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Open Brief
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Organization Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Organization"
        subtitle="Similar names are flagged automatically so duplicates don't slip in."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate(false);
          }}
          className="space-y-4"
        >
          {formError && <ErrorAlert message={formError} />}

          {dupMatches.length > 0 && (
            <div className="p-4 rounded-lg bg-[#EFF6FF] border border-[#1D4ED8] space-y-2.5">
              <div className="text-sm font-semibold text-[#0F295C]">
                Possible Duplicate Organization(s) in {country}
              </div>
              <p className="text-xs text-[#3B5998]">
                Review the existing matches below. Confirm only if this is a distinct legal or operational entity.
              </p>
              <ul className="space-y-1 text-xs text-[#0A1936]">
                {dupMatches.map((d) => (
                  <li key={d.id} className="p-2 rounded bg-white border border-[#BFDBFE]">
                    <strong>{d.label}</strong> — {d.detail}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setDupMatches([])}>
                  Edit Details
                </Button>
                <Button type="button" size="sm" onClick={() => submitCreate(true)}>
                  Confirm &amp; Create Anyway
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Organization Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDupMatches([]);
                }}
                className={inputCls}
                placeholder="e.g., Central Reserve Clearing"
                required
              />
            </Field>
            <Field label="Organization Type" required>
              <select value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)} className={selectCls}>
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country" required>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setDupMatches([]);
                }}
                className={selectCls}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="City / Region">
              <input
                type="text"
                value={cityRegion}
                onChange={(e) => setCityRegion(e.target.value)}
                className={inputCls}
                placeholder="e.g., Zurich"
              />
            </Field>
          </div>

          <Field label="Website">
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputCls}
              placeholder="https://..."
            />
          </Field>

          <Field label="Institutional Context / Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
              placeholder="Mandate, regulatory focus, or relationship background..."
            />
          </Field>

          <div>
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
            >
              {showMore ? 'Hide billing & legal details' : '+ Add legal name, billing address, email/phone'}
            </button>
          </div>

          {showMore && (
            <div className="p-4 rounded-lg bg-[#F4F8FF] border border-[#DBEAFE] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Legal Name">
                <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Tax Registration Number">
                <input type="text" value={taxReg} onChange={(e) => setTaxReg(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Main Email">
                <input type="email" value={mainEmail} onChange={(e) => setMainEmail(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Main Phone">
                <input type="text" value={mainPhone} onChange={(e) => setMainPhone(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Billing Address">
                  <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Organization</Button>
          </div>
        </form>
      </Modal>

      {/* Controlled Merge Modal */}
      <Modal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Controlled Organization Merge"
        subtitle="Move contacts, leads and deals from one company record into another."
      >
        <form onSubmit={handleMerge} className="space-y-4">
          {mergeError && <ErrorAlert message={mergeError} />}
          <Field label="Duplicate Source (will be retired)">
            <select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className={selectCls}>
              {visibleOrganizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.country})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Surviving Target Organization">
            <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className={selectCls}>
              {visibleOrganizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.country})
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Merge Organizations</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
