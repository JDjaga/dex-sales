import React, { useMemo, useState } from 'react';
import { CheckCircle2, Inbox, Plus, XCircle } from 'lucide-react';
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
import { COUNTRIES, formatDateTime, formatShortDate } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { canAccessEnquiries } from '../store/policy';

export const EnquiriesPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const {
    state,
    currentUser,
    visibleEnquiries,
    submitWebsiteEnquiry,
    approveEnquiry,
    dismissEnquiry,
  } = useCrm();

  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Dismissed'>('All');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  const [form, setForm] = useState({
    enquiry_type: 'booking' as 'booking' | 'contact',
    org_name: '',
    country: 'United States',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    purpose: '',
    preferred_date: '',
    message: '',
  });

  if (!canAccessEnquiries(currentUser, state.settings)) {
    return (
      <EmptyState
        title="Enquiry Queue restricted"
        description={
          state.settings.website_enquiries_enabled
            ? 'Only internal Manager, Admin, or Super Admin roles can review incoming website enquiries.'
            : 'Website enquiry intake is currently disabled in Admin & Settings.'
        }
        action={<Button onClick={() => onNavigate({ page: 'dashboard' })}>Back to Dashboard</Button>}
      />
    );
  }

  const filtered = useMemo(() => {
    return visibleEnquiries.filter((e) => statusFilter === 'All' || e.status === statusFilter);
  }, [visibleEnquiries, statusFilter]);

  const counts = useMemo(
    () => ({
      All: visibleEnquiries.length,
      Pending: visibleEnquiries.filter((e) => e.status === 'Pending').length,
      Approved: visibleEnquiries.filter((e) => e.status === 'Approved').length,
      Dismissed: visibleEnquiries.filter((e) => e.status === 'Dismissed').length,
    }),
    [visibleEnquiries]
  );

  const handleCreateEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = submitWebsiteEnquiry(form);
    if (!res.ok) {
      setError(res.error || 'Could not submit enquiry.');
      return;
    }
    setSubmitOpen(false);
    setForm({
      enquiry_type: 'booking',
      org_name: '',
      country: 'United States',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      purpose: '',
      preferred_date: '',
      message: '',
    });
    setToast('Test website enquiry added to Pending queue.');
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTargetId) return;
    setError('');
    const res = approveEnquiry(approveTargetId, reviewNote);
    if (!res.ok || !res.data) {
      setError(res.error || 'Failed to approve enquiry.');
      return;
    }
    setApproveTargetId(null);
    setReviewNote('');
    setCreatedLeadId(res.data.id);
    setToast(`Enquiry approved. Created organization, contact, and lead ${res.data.lead_number}.`);
  };

  const handleDismiss = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissTargetId) return;
    setError('');
    if (!reviewNote.trim()) {
      setError('Please enter a brief dismissal note for the audit trail.');
      return;
    }
    const res = dismissEnquiry(dismissTargetId, reviewNote);
    if (!res.ok) {
      setError(res.error || 'Failed to dismiss enquiry.');
      return;
    }
    setDismissTargetId(null);
    setReviewNote('');
    setCreatedLeadId(null);
    setToast('Enquiry dismissed and logged.');
  };

  const getUserName = (id: string | null) => state.users.find((u) => u.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Enquiry Queue"
        subtitle="New requests waiting for review before they become leads"
        actions={
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus className="w-4 h-4" />
            Submit Test Website Enquiry
          </Button>
        }
      />

      {toast && (
        <div className="space-y-2">
          <SuccessBanner
            message={toast}
            onClose={() => {
              setToast('');
              setCreatedLeadId(null);
            }}
          />
          {createdLeadId && (
            <div>
              <Button size="sm" variant="secondary" onClick={() => onNavigate({ page: 'lead', id: createdLeadId })}>
                Open newly created lead
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="flex flex-wrap gap-2">
        {(['All', 'Pending', 'Approved', 'Dismissed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              statusFilter === tab
                ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                : 'bg-white text-[#0F295C] border-[#BFDBFE] hover:bg-[#EFF6FF]'
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No enquiries in this view"
          description="Incoming website booking and contact requests appear here for Manager or Admin review."
          action={
            <Button variant="secondary" onClick={() => setSubmitOpen(true)}>
              Submit Test Website Enquiry
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((enq) => (
            <Card key={enq.id} className="p-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                    <h2 className="text-base font-semibold text-[#0A1936]">{enq.org_name}</h2>
                    <StatusIndicator status={enq.status} />
                    <span className="text-xs px-2 py-0.5 rounded bg-[#F4F8FF] border border-[#DBEAFE] text-[#1E40AF]">
                      {enq.enquiry_type === 'booking' ? 'Demo / Briefing Request' : 'General Contact'}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-[#0F295C]">{enq.purpose}</div>
                  {enq.message && <p className="text-sm text-[#3B5998] leading-relaxed">{enq.message}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
                    <div>
                      <span className="text-[#3B5998] block">Contact</span>
                      <span className="font-medium text-[#0A1936]">{enq.contact_name}</span>
                    </div>
                    <div>
                      <span className="text-[#3B5998] block">Email / Phone</span>
                      <span className="font-medium text-[#0A1936]">
                        {enq.contact_email || '—'} {enq.contact_phone ? `· ${enq.contact_phone}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#3B5998] block">Country</span>
                      <span className="font-medium text-[#0A1936]">{enq.country}</span>
                    </div>
                    <div>
                      <span className="text-[#3B5998] block">Received / Preferred Date</span>
                      <span className="font-medium text-[#0A1936] tabular-nums">
                        {formatShortDate(enq.created_at)}
                        {enq.preferred_date ? ` · Prefers ${formatShortDate(enq.preferred_date)}` : ''}
                      </span>
                    </div>
                  </div>

                  {enq.reviewed_at && (
                    <div className="pt-2 border-t border-[#EFF6FF] text-xs text-[#3B5998]">
                      Reviewed by <span className="font-medium text-[#0F295C]">{getUserName(enq.reviewed_by)}</span> on{' '}
                      {formatDateTime(enq.reviewed_at)}
                      {enq.review_note ? ` — Note: "${enq.review_note}"` : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {enq.status === 'Pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReviewNote('');
                          setApproveTargetId(enq.id);
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve &amp; Create Lead
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewNote('');
                          setDismissTargetId(enq.id);
                        }}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </Button>
                    </>
                  )}
                  {enq.status === 'Approved' && enq.lead_id && (
                    <Button size="sm" variant="secondary" onClick={() => onNavigate({ page: 'lead', id: enq.lead_id! })}>
                      View Created Lead
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Submit Test Website Enquiry Modal */}
      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit Test Website Enquiry"
        subtitle="Send a test enquiry — like a customer would from the website"
      >
        <form onSubmit={handleCreateEnquiry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Enquiry Type" required>
              <select
                className={selectCls}
                value={form.enquiry_type}
                onChange={(e) => setForm({ ...form, enquiry_type: e.target.value as 'booking' | 'contact' })}
              >
                <option value="booking">Demo / Briefing Request</option>
                <option value="contact">General Contact</option>
              </select>
            </Field>
            <Field label="Country" required>
              <select
                className={selectCls}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Organization Name" required>
            <input
              className={inputCls}
              required
              placeholder="e.g., Nordic Clearing Authority"
              value={form.org_name}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Contact Name" required>
              <input
                className={inputCls}
                required
                placeholder="Full name"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </Field>
            <Field label="Work Email">
              <input
                type="email"
                className={inputCls}
                placeholder="name@institution.org"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputCls}
                placeholder="+1 555 0100"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Engagement Purpose" required>
              <input
                className={inputCls}
                required
                placeholder="e.g., Regulatory Reporting Sandbox Briefing"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </Field>
            <Field label="Preferred Briefing Date">
              <input
                type="date"
                className={inputCls}
                value={form.preferred_date}
                onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Message / Context">
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Stakeholder context or requested agenda..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit to Queue</Button>
          </div>
        </form>
      </Modal>

      {/* Approve Modal */}
      <Modal
        open={Boolean(approveTargetId)}
        onClose={() => setApproveTargetId(null)}
        title="Approve Website Enquiry"
        subtitle="This creates the company, contact, lead and first follow-up task"
      >
        <form onSubmit={handleApprove} className="space-y-4">
          <Field label="Review Note (optional)">
            <textarea
              className={inputCls}
              rows={3}
              placeholder="e.g., Verified institutional domain; assign to initial discovery."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setApproveTargetId(null)}>
              Cancel
            </Button>
            <Button type="submit">Approve &amp; Create Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Dismiss Modal */}
      <Modal
        open={Boolean(dismissTargetId)}
        onClose={() => setDismissTargetId(null)}
        title="Dismiss Website Enquiry"
        subtitle="Tell us why this enquiry won't become a lead"
      >
        <form onSubmit={handleDismiss} className="space-y-4">
          <Field label="Dismissal Reason" required>
            <textarea
              className={inputCls}
              rows={3}
              required
              placeholder="e.g., Duplicate request, out-of-scope vendor solicitation, or spam."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDismissTargetId(null)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Dismissal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
