import React, { useMemo, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
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
import { COUNTRIES, normalizePhone } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { isReadOnlyRole } from '../store/policy';

export const ContactsPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const { state, currentUser, visibleContacts, visibleOrganizations, createContact } = useCrm();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [language, setLanguage] = useState('English');
  const [relationship, setRelationship] = useState('');
  const [howKnown, setHowKnown] = useState('');
  const [consentBasis, setConsentBasis] = useState('Legitimate B2B Interest');
  const [doNotContact, setDoNotContact] = useState(false);
  const [initialOrgId, setInitialOrgId] = useState('');
  const [initialDesignation, setInitialDesignation] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const liveNormPhone = normalizePhone(phone, country);

  // Live duplicate warning while entering contact
  const liveDuplicateWarning = useMemo(() => {
    const p = personalEmail.trim().toLowerCase();
    const w = workEmail.trim().toLowerCase();
    if (!liveNormPhone && !p && !w) return '';
    const match = state.contacts.find((c) => {
      if (liveNormPhone && c.normalized_phone === liveNormPhone) return true;
      const cp = c.personal_email.trim().toLowerCase();
      const cw = c.work_email.trim().toLowerCase();
      if (p && (cp === p || cw === p)) return true;
      if (w && (cp === w || cw === w)) return true;
      return false;
    });
    if (!match) return '';
    return 'A contact with this email address or normalized phone number already exists.';
  }, [liveNormPhone, personalEmail, workEmail, state.contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleContacts.filter((c) => {
      if (!q) return true;
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.work_email.toLowerCase().includes(q) ||
        c.personal_email.toLowerCase().includes(q) ||
        c.normalized_phone.includes(q)
      );
    });
  }, [visibleContacts, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = createContact({
      first_name: firstName,
      last_name: lastName,
      country,
      phone,
      personal_email: personalEmail,
      work_email: workEmail,
      preferred_language: language,
      relationship,
      how_known: howKnown,
      do_not_contact: doNotContact,
      consent_basis: consentBasis,
      initial_org_id: initialOrgId || undefined,
      initial_designation: initialDesignation,
    });
    if (!res.ok) {
      setError(res.error || 'Could not create contact.');
      return;
    }
    setCreateOpen(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setPersonalEmail('');
    setWorkEmail('');
    setRelationship('');
    setHowKnown('');
    setInitialOrgId('');
    setInitialDesignation('');
    setToast(`Created contact ${res.data?.first_name} ${res.data?.last_name}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="The people you work with — their details, emails and contact preferences"
        actions={
          currentUser && !isReadOnlyRole(currentUser.role) ? (
            <Button
              size="sm"
              onClick={() => {
                setError('');
                setCreateOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Contact
            </Button>
          ) : undefined
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts by name, email, or phone..."
          className={`${inputCls} pl-9`}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No contacts found"
          description="No contacts match your filter within your permitted scope."
          action={
            currentUser && !isReadOnlyRole(currentUser.role) ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Contact
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
                  <th className="py-3 px-4">Person</th>
                  <th className="py-3 px-4">Organizations &amp; Designations</th>
                  <th className="py-3 px-4">Phone / Email</th>
                  <th className="py-3 px-4">Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF] text-sm">
                {filtered.map((c) => {
                  const memberships = state.contactMemberships.filter((m) => m.contact_id === c.id && m.is_active);
                  return (
                    <tr key={c.id} className="hover:bg-[#F4F8FF] transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate({ page: 'contact', id: c.id })}
                          className="font-semibold text-[#1D4ED8] hover:underline flex items-center gap-2 cursor-pointer"
                        >
                          <Users className="w-4 h-4 shrink-0" />
                          <span>
                            {c.first_name} {c.last_name}
                          </span>
                        </button>
                        <div className="text-xs text-[#3B5998] mt-0.5">{c.country}</div>
                      </td>
                      <td className="py-3 px-4">
                        {memberships.length === 0 ? (
                          <span className="text-xs text-[#3B5998]">No active organization</span>
                        ) : (
                          <div className="space-y-1">
                            {memberships.map((m) => {
                              const org = visibleOrganizations.find((o) => o.id === m.organization_id);
                              return (
                                <div key={m.id} className="text-xs">
                                  <span className="font-medium text-[#0A1936]">{org?.name || 'Organization'}</span>
                                  {m.designation && <span className="text-[#3B5998]"> — {m.designation}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#0F295C]">
                        <div className="tabular-nums">{c.normalized_phone || c.phone || '—'}</div>
                        <div className="text-[#3B5998]">{c.work_email || c.personal_email || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {c.do_not_contact ? (
                          <StatusIndicator status="Do Not Contact" />
                        ) : (
                          <StatusIndicator status="Active" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Contact Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Contact"
        subtitle="Add at least a phone number or an email. Duplicates aren't allowed."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          {liveDuplicateWarning && <ErrorAlert message={liveDuplicateWarning} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Last Name" required>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Country" required>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectCls}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone Number" hint={liveNormPhone ? `Normalized: ${liveNormPhone}` : 'At least phone or personal email required'}>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="020 7946 0192" />
            </Field>
            <Field label="Personal Email">
              <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Work Email">
              <input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Preferred Language">
              <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Permission to Contact">
              <input type="text" value={consentBasis} onChange={(e) => setConsentBasis(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Relationship">
              <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls} placeholder="e.g., Executive Sponsor" />
            </Field>
            <Field label="How Team Knows Person">
              <input type="text" value={howKnown} onChange={(e) => setHowKnown(e.target.value)} className={inputCls} placeholder="e.g., Forum referral" />
            </Field>
          </div>

          <div className="p-4 rounded-lg bg-[#F4F8FF] border border-[#DBEAFE] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Initial Organization (optional)">
              <select value={initialOrgId} onChange={(e) => setInitialOrgId(e.target.value)} className={selectCls}>
                <option value="">None yet</option>
                {visibleOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Designation at Organization">
              <input
                type="text"
                value={initialDesignation}
                onChange={(e) => setInitialDesignation(e.target.value)}
                className={inputCls}
                placeholder="e.g., Head of Treasury"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#0F295C]">
            <input
              type="checkbox"
              checked={doNotContact}
              onChange={(e) => setDoNotContact(e.target.checked)}
              className="rounded border-[#BFDBFE]"
            />
            Mark as Do Not Contact (blocks outreach recommendations)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Contact</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
