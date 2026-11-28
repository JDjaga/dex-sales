import React, { useMemo, useState } from 'react';
import { ArrowLeft, Building2, Edit3, Plus, Trash2, UserX } from 'lucide-react';
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
import { formatDateTime, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';

export const ContactDetailPage: React.FC<{ contactId: string; onNavigate: (r: NavRoute) => void }> = ({
  contactId,
  onNavigate,
}) => {
  const {
    state,
    visibleContacts,
    visibleOrganizations,
    visibleLeads,
    canEdit,
    updateContact,
    addContactMembership,
    removeContactMembership,
    deleteContact,
  } = useCrm();

  const contact = visibleContacts.find((c) => c.id === contactId);
  const [linkOrgId, setLinkOrgId] = useState('');
  const [linkDesignation, setLinkDesignation] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editPhone, setEditPhone] = useState(contact?.phone || '');
  const [editWorkEmail, setEditWorkEmail] = useState(contact?.work_email || '');
  const [editPersonalEmail, setEditPersonalEmail] = useState(contact?.personal_email || '');
  const [editDnc, setEditDnc] = useState(contact?.do_not_contact || false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const allMemberships = useMemo(
    () => state.contactMemberships.filter((m) => m.contact_id === contactId),
    [state.contactMemberships, contactId]
  );

  const activeMemberships = allMemberships.filter((m) => m.is_active);
  const pastMemberships = allMemberships.filter((m) => !m.is_active);

  const relatedLeads = useMemo(
    () =>
      visibleLeads.filter(
        (l) => l.primary_contact_id === contactId || l.additional_contact_ids.includes(contactId)
      ),
    [visibleLeads, contactId]
  );

  if (!contact) {
    return (
      <EmptyState
        title="Contact not accessible"
        description="This contact doesn't exist, or you don't have access to it."
        action={<Button onClick={() => onNavigate({ page: 'contacts' })}>Back to Contacts</Button>}
      />
    );
  }

  const editable = canEdit(contact);

  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!linkOrgId) return;
    const res = addContactMembership(contact.id, linkOrgId, linkDesignation);
    if (!res.ok) {
      setError(res.error || 'Could not add organization membership.');
      return;
    }
    setLinkOrgId('');
    setLinkDesignation('');
    setToast('Organization membership added.');
  };

  const handleRemoveMembership = (memId: string) => {
    setError('');
    const res = removeContactMembership(memId);
    if (!res.ok) {
      setError(res.error || 'Could not remove membership.');
      return;
    }
    setToast('Organization membership ended and preserved in history.');
  };

  const handleDelete = () => {
    setError('');
    const res = deleteContact(contact.id);
    if (!res.ok) {
      setError(res.error || 'Could not delete contact.');
      return;
    }
    onNavigate({ page: 'contacts' });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = updateContact(contact.id, {
      phone: editPhone,
      work_email: editWorkEmail,
      personal_email: editPersonalEmail,
      do_not_contact: editDnc,
    });
    if (!res.ok) {
      setError(res.error || 'Could not update contact.');
      return;
    }
    setEditOpen(false);
    setToast('Contact updated.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DBEAFE]">
        <div>
          <button
            onClick={() => onNavigate({ page: 'contacts' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Contacts
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#0A1936]">
              {contact.first_name} {contact.last_name}
            </h1>
            {contact.do_not_contact && <StatusIndicator status="Do Not Contact" />}
          </div>
          <p className="text-sm text-[#3B5998] mt-1">
            {contact.country} · Language: {contact.preferred_language} · {contact.relationship || 'Stakeholder'}
          </p>
        </div>

        {editable && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditPhone(contact.phone);
                setEditWorkEmail(contact.work_email);
                setEditPersonalEmail(contact.personal_email);
                setEditDnc(contact.do_not_contact);
                setEditOpen(true);
              }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#0A1936]">Contact &amp; Consent Profile</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-[#3B5998]">Normalized Phone</dt>
              <dd className="font-medium text-[#0A1936] tabular-nums">{contact.normalized_phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#3B5998]">Work Email</dt>
              <dd className="font-medium text-[#0A1936]">{contact.work_email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#3B5998]">Personal Email</dt>
              <dd className="font-medium text-[#0A1936]">{contact.personal_email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#3B5998]">How Team Knows Person</dt>
              <dd className="text-[#0F295C]">{contact.how_known || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#3B5998]">Permission to Contact</dt>
              <dd className="text-[#0F295C]">
                {contact.consent_basis || 'Not recorded'}
                {contact.consent_timestamp ? ` (${formatDateTime(contact.consent_timestamp)})` : ''}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0A1936]">
                Linked Companies ({activeMemberships.length})
              </h2>
            </div>

            {activeMemberships.length === 0 ? (
              <p className="text-xs text-[#3B5998]">Not linked to any company yet.</p>
            ) : (
              <div className="divide-y divide-[#EFF6FF]">
                {activeMemberships.map((m) => {
                  const org = visibleOrganizations.find((o) => o.id === m.organization_id);
                  return (
                    <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <button
                          onClick={() => org && onNavigate({ page: 'organization', id: org.id })}
                          className="text-sm font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {org?.name || 'Restricted Organization'}
                        </button>
                        <div className="text-xs text-[#3B5998]">
                          Designation: {m.designation || 'Not specified'} · Since {formatShortDate(m.started_at)}
                        </div>
                      </div>
                      {editable && (
                        <Button size="sm" variant="outline" onClick={() => handleRemoveMembership(m.id)}>
                          <UserX className="w-3.5 h-3.5" />
                          End Role
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {editable && activeMemberships.length < 20 && (
              <form onSubmit={handleAddMembership} className="pt-3 border-t border-[#DBEAFE] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-5">
                  <Field label="Add Organization">
                    <select value={linkOrgId} onChange={(e) => setLinkOrgId(e.target.value)} className={selectCls} required>
                      <option value="">Select organization...</option>
                      {visibleOrganizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="sm:col-span-5">
                  <Field label="Designation">
                    <input
                      type="text"
                      value={linkDesignation}
                      onChange={(e) => setLinkDesignation(e.target.value)}
                      className={inputCls}
                      placeholder="e.g., Board Advisor"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" className="w-full">
                    <Plus className="w-3.5 h-3.5" />
                    Link
                  </Button>
                </div>
              </form>
            )}

            {pastMemberships.length > 0 && (
              <div className="pt-3 border-t border-[#EFF6FF]">
                <div className="text-xs font-semibold text-[#3B5998] mb-2">Organization History</div>
                <div className="space-y-1 text-xs text-[#3B5998]">
                  {pastMemberships.map((m) => {
                    const org = state.organizations.find((o) => o.id === m.organization_id);
                    return (
                      <div key={m.id}>
                        {org?.name || 'Organization'} — {m.designation || 'Member'} ({formatShortDate(m.started_at)} to{' '}
                        {formatShortDate(m.ended_at)})
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#0A1936]">Related Leads</h2>
            {relatedLeads.length === 0 ? (
              <p className="text-xs text-[#3B5998]">No leads associated with this contact.</p>
            ) : (
              <div className="space-y-2">
                {relatedLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onNavigate({ page: 'lead', id: l.id })}
                    className="w-full text-left p-3 rounded-lg border border-[#DBEAFE] hover:bg-[#EFF6FF] flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#0A1936]">
                        {l.lead_number} · {l.purpose}
                      </div>
                      <div className="text-xs text-[#3B5998]">
                        {l.primary_contact_id === contact.id ? 'Primary Contact' : 'Additional Contact'}
                      </div>
                    </div>
                    <StatusIndicator status={l.stage} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Contact">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Field label="Phone">
            <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Work Email">
            <input type="email" value={editWorkEmail} onChange={(e) => setEditWorkEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Personal Email">
            <input type="email" value={editPersonalEmail} onChange={(e) => setEditPersonalEmail(e.target.value)} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium text-[#0F295C]">
            <input type="checkbox" checked={editDnc} onChange={(e) => setEditDnc(e.target.checked)} />
            Do Not Contact
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
