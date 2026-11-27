import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import type { NavRoute } from '../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  InfoBanner,
  Modal,
  PageHeader,
  StatusIndicator,
  SuccessBanner,
  inputCls,
  selectCls,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { ALL_ROLES, isAdminPlus, isOrgWideAdmin } from '../store/policy';
import type { User, UserRole } from '../types/crm';

export const AdminPage: React.FC<{ onNavigate: (r: NavRoute) => void }> = ({ onNavigate }) => {
  const {
    state,
    currentUser,
    createUser,
    updateUser,
    createTeam,
    updateSettings,
    resetDemoWorkspace,
  } = useCrm();

  const [tab, setTab] = useState<'users' | 'audit' | 'settings'>('users');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Create/Edit User
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: 'demo',
    role: 'BD User' as UserRole,
    team_id: state.teams[0]?.id || '',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    role: 'BD User' as UserRole,
    team_id: '',
    is_active: true,
  });

  // Create Team
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    is_partner_team: false,
  });

  // Audit filter
  const [auditSearch, setAuditSearch] = useState('');

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    company_name: state.settings.company_name,
    currency: state.settings.currency,
    payment_terms_days: String(state.settings.payment_terms_days),
    tax_enabled: state.settings.tax_enabled,
    tax_rate_percent: String((state.settings.tax_rate_bps / 100).toFixed(2).replace(/\.00$/, '')),
    tax_label: state.settings.tax_label,
    legal_entity_name: state.settings.legal_entity_name,
    tax_registration_number: state.settings.tax_registration_number,
    invoice_address: state.settings.invoice_address,
    partner_roles_enabled: state.settings.partner_roles_enabled,
    website_enquiries_enabled: state.settings.website_enquiries_enabled,
  });

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  if (!currentUser || !isAdminPlus(currentUser.role)) {
    return (
      <EmptyState
        title="Administration restricted"
        description="Only Admin, Super Admin, or Partner Admin roles can access user management, audit history, and launch settings."
        action={<Button onClick={() => onNavigate({ page: 'dashboard' })}>Back to Dashboard</Button>}
      />
    );
  }

  const orgWide = isOrgWideAdmin(currentUser.role);
  const isPartnerAdmin = currentUser.role === 'Partner Admin';

  const visibleUsers = useMemo(() => {
    if (orgWide) return state.users;
    // Partner Admin sees only users on their partner team
    return state.users.filter((u) => u.team_id === currentUser.team_id);
  }, [state.users, orgWide, currentUser.team_id]);

  const allowedCreateRoles: UserRole[] = useMemo(() => {
    if (currentUser.role === 'Super Admin') return ALL_ROLES;
    if (currentUser.role === 'Admin') return ALL_ROLES.filter((r) => r !== 'Super Admin');
    return ['Partner Viewer', 'Partner Admin'];
  }, [currentUser.role]);

  const visibleAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    const scoped = orgWide
      ? state.auditLogs
      : state.auditLogs.filter((log) => {
          const actor = state.users.find((u) => u.id === log.actor_id);
          return log.actor_id === currentUser.id || (actor && actor.team_id === currentUser.team_id);
        });
    if (!q) return scoped.slice(0, 120);
    return scoped
      .filter(
        (l) =>
          l.summary.toLowerCase().includes(q) ||
          l.actor_email.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q)
      )
      .slice(0, 120);
  }, [state.auditLogs, state.users, auditSearch, orgWide, currentUser.id, currentUser.team_id]);

  const getTeamName = (teamId: string | null) =>
    state.teams.find((t) => t.id === teamId)?.name || 'Unassigned';

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const teamId = isPartnerAdmin ? currentUser.team_id : newUser.team_id || null;
    const role = isPartnerAdmin && newUser.role !== 'Partner Viewer' && newUser.role !== 'Partner Admin'
      ? 'Partner Viewer'
      : newUser.role;
    const res = createUser({
      name: newUser.name,
      email: newUser.email,
      password: newUser.password || 'demo',
      role,
      team_id: teamId,
    });
    if (!res.ok) {
      setError(res.error || 'Could not create user.');
      return;
    }
    setCreateUserOpen(false);
    setNewUser({ name: '', email: '', password: 'demo', role: allowedCreateRoles[0], team_id: state.teams[0]?.id || '' });
    setToast(`User ${res.data?.email} created.`);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditUserForm({
      name: u.name,
      role: u.role,
      team_id: u.team_id || '',
      is_active: u.is_active,
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    const res = updateUser(editingUser.id, {
      name: editUserForm.name.trim(),
      role: editUserForm.role,
      team_id: editUserForm.team_id || null,
      is_active: editUserForm.is_active,
    });
    if (!res.ok) {
      setError(res.error || 'Could not update user.');
      return;
    }
    setEditingUser(null);
    setToast('User permissions updated.');
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = createTeam(teamForm);
    if (!res.ok) {
      setError(res.error || 'Could not create team.');
      return;
    }
    setTeamOpen(false);
    setTeamForm({ name: '', description: '', is_partner_team: false });
    setToast(`Team "${res.data?.name}" created.`);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const terms = Math.max(1, parseInt(settingsForm.payment_terms_days || '30', 10) || 30);
    const rateBps = Math.max(0, Math.round((parseFloat(settingsForm.tax_rate_percent || '0') || 0) * 100));
    const res = updateSettings({
      company_name: settingsForm.company_name.trim() || 'DeX Sales',
      currency: settingsForm.currency.trim() || 'USD',
      payment_terms_days: terms,
      tax_enabled: settingsForm.tax_enabled,
      tax_rate_bps: rateBps,
      tax_label: settingsForm.tax_label.trim() || 'VAT',
      legal_entity_name: settingsForm.legal_entity_name.trim(),
      tax_registration_number: settingsForm.tax_registration_number.trim(),
      invoice_address: settingsForm.invoice_address.trim(),
      partner_roles_enabled: settingsForm.partner_roles_enabled,
      website_enquiries_enabled: settingsForm.website_enquiries_enabled,
    });
    if (!res.ok) {
      setError(res.error || 'Could not save settings.');
      return;
    }
    setToast('Workspace launch settings saved.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Launch Readiness"
        subtitle={
          orgWide
            ? 'Manage users, teams, audit logs, workspace defaults, and external integration readiness'
            : 'Partner Admin console scoped to your partner team'
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {isPartnerAdmin && (
        <InfoBanner
          title="Partner Admin Authority Scope"
          body="You can view and manage users and activity within your assigned partner team. Organization-wide system settings remain restricted to internal Admin and Super Admin roles."
        />
      )}

      <div className="flex flex-wrap gap-2 border-b border-[#DBEAFE] pb-3">
        {[
          { id: 'users', label: 'Users & Teams', icon: Users },
          { id: 'audit', label: 'Audit History', icon: Shield },
          { id: 'settings', label: 'Launch Settings & Readiness', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                  : 'bg-white text-[#0F295C] border-[#BFDBFE] hover:bg-[#EFF6FF]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: USERS & TEAMS */}
      {tab === 'users' && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DBEAFE] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#0A1936]">Authorized Users ({visibleUsers.length})</h2>
                <p className="text-xs text-[#3B5998]">
                  Role and team membership jointly govern record access and commercial actions
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setNewUser({
                    name: '',
                    email: '',
                    password: 'demo',
                    role: allowedCreateRoles[0],
                    team_id: isPartnerAdmin ? currentUser.team_id || '' : state.teams[0]?.id || '',
                  });
                  setCreateUserOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add User
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F4F8FF] border-b border-[#DBEAFE] text-xs font-semibold text-[#0F295C]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF6FF]">
                  {visibleUsers.map((u) => {
                    const canModifyTarget =
                      !(u.role === 'Super Admin' && currentUser.role !== 'Super Admin') &&
                      (!isPartnerAdmin || u.team_id === currentUser.team_id);
                    return (
                      <tr key={u.id} className="hover:bg-[#F4F8FF]/60">
                        <td className="px-4 py-3 font-medium text-[#0A1936]">{u.name}</td>
                        <td className="px-4 py-3 text-[#3B5998]">{u.email}</td>
                        <td className="px-4 py-3 font-medium text-[#1E40AF]">{u.role}</td>
                        <td className="px-4 py-3 text-[#3B5998]">{getTeamName(u.team_id)}</td>
                        <td className="px-4 py-3">
                          <StatusIndicator status={u.is_active ? 'Active' : 'Inactive'} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canModifyTarget ? (
                            <Button size="sm" variant="outline" onClick={() => openEditUser(u)}>
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-[#3B5998]">Protected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DBEAFE] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#0A1936]">Teams ({state.teams.length})</h2>
                <p className="text-xs text-[#3B5998]">
                  Partner teams isolate partner viewer and partner admin visibility from internal accounts
                </p>
              </div>
              {orgWide && (
                <Button size="sm" variant="secondary" onClick={() => setTeamOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Create Team
                </Button>
              )}
            </div>
            <div className="divide-y divide-[#EFF6FF]">
              {state.teams.map((t) => (
                <div key={t.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-[#0A1936]">{t.name}</div>
                    <div className="text-xs text-[#3B5998]">{t.description || 'No description'}</div>
                  </div>
                  <StatusIndicator status={t.is_partner_team ? 'Pending' : 'Active'} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT HISTORY */}
      {tab === 'audit' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DBEAFE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#0A1936]">Administrative &amp; Commercial Audit Log</h2>
              <p className="text-xs text-[#3B5998]">
                Tracks lead changes, quote decisions, invoices, payments, exports, and permission changes
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                className={`${inputCls} pl-9`}
                placeholder="Filter by action, user, summary..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F4F8FF] border-b border-[#DBEAFE] text-xs font-semibold text-[#0F295C]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF6FF]">
                {visibleAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#3B5998]">
                      No audit records match your current filter.
                    </td>
                  </tr>
                ) : (
                  visibleAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F4F8FF]/60">
                      <td className="px-4 py-2.5 text-xs text-[#3B5998] whitespace-nowrap tabular-nums">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs font-medium text-[#0A1936]">{log.actor_email}</div>
                        <div className="text-[11px] text-[#1D4ED8]">{log.actor_role}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[#0F295C] whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#3B5998] whitespace-nowrap">
                        {log.entity_type}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#0A1936]">{log.summary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: LAUNCH SETTINGS & READINESS */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 p-6">
            <h2 className="text-base font-semibold text-[#0A1936]">Workspace &amp; Commercial Defaults</h2>
            <p className="text-xs text-[#3B5998] mt-1 mb-4">
              {orgWide
                ? 'Configure company branding on printable briefs/invoices, payment terms, and optional role/enquiry modules.'
                : 'Read-only for Partner Admin. Contact an internal Admin to change organization-wide defaults.'}
            </p>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Workspace Display Name" required>
                  <input
                    className={inputCls}
                    disabled={!orgWide}
                    value={settingsForm.company_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                  />
                </Field>
                <Field label="Default Currency (ISO)" required>
                  <input
                    className={inputCls}
                    disabled={!orgWide}
                    value={settingsForm.currency}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value.toUpperCase() })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Legal Entity Name (for Invoices)">
                  <input
                    className={inputCls}
                    disabled={!orgWide}
                    value={settingsForm.legal_entity_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, legal_entity_name: e.target.value })}
                  />
                </Field>
                <Field label="Tax Registration Number">
                  <input
                    className={inputCls}
                    disabled={!orgWide}
                    value={settingsForm.tax_registration_number}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tax_registration_number: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Invoice Issuer Address">
                <input
                  className={inputCls}
                  disabled={!orgWide}
                  value={settingsForm.invoice_address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, invoice_address: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Default Payment Terms (Days)">
                  <input
                    type="number"
                    min={1}
                    className={`${inputCls} tabular-nums`}
                    disabled={!orgWide}
                    value={settingsForm.payment_terms_days}
                    onChange={(e) => setSettingsForm({ ...settingsForm, payment_terms_days: e.target.value })}
                  />
                </Field>
                <Field label="Tax Label">
                  <input
                    className={inputCls}
                    disabled={!orgWide || !settingsForm.tax_enabled}
                    value={settingsForm.tax_label}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tax_label: e.target.value })}
                  />
                </Field>
                <Field label="Tax Rate (%)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={`${inputCls} tabular-nums`}
                    disabled={!orgWide || !settingsForm.tax_enabled}
                    value={settingsForm.tax_rate_percent}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tax_rate_percent: e.target.value })}
                  />
                </Field>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#EFF6FF]">
                <label className="flex items-center gap-2.5 text-sm text-[#0A1936] cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!orgWide}
                    checked={settingsForm.tax_enabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tax_enabled: e.target.checked })}
                    className="rounded border-[#93C5FD] text-[#1D4ED8]"
                  />
                  <span>Enable tax calculation notice on commercial settings</span>
                </label>

                <label className="flex items-center gap-2.5 text-sm text-[#0A1936] cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!orgWide}
                    checked={settingsForm.partner_roles_enabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, partner_roles_enabled: e.target.checked })}
                    className="rounded border-[#93C5FD] text-[#1D4ED8]"
                  />
                  <span>Enable optional Partner Viewer &amp; Partner Admin roles</span>
                </label>

                <label className="flex items-center gap-2.5 text-sm text-[#0A1936] cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!orgWide}
                    checked={settingsForm.website_enquiries_enabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, website_enquiries_enabled: e.target.checked })}
                    className="rounded border-[#93C5FD] text-[#1D4ED8]"
                  />
                  <span>Enable Website Enquiry Queue intake module</span>
                </label>
              </div>

              {orgWide && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetConfirmOpen(true)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Demo Data
                  </Button>
                  <Button type="submit">
                    <CheckCircle2 className="w-4 h-4" />
                    Save Workspace Settings
                  </Button>
                </div>
              )}
            </form>
          </Card>

          <Card className="lg:col-span-5 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#0A1936]">Static Demo &amp; Integration Boundaries</h2>
              <p className="text-xs text-[#3B5998] mt-1">
                Honest inventory of what runs locally in this Vercel static demo versus external services required for a real deployment.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  name: 'Browser-Local Persistence (Demo)',
                  status: 'Active',
                  detail: 'Saved in browser localStorage (dex_sales_static_demo_v1); survives page refresh in this browser only.',
                },
                {
                  name: 'Printable Engagement Briefs, Quotes & Invoices',
                  status: 'Active',
                  detail: 'Renders clean print-ready PDF views via browser Print / Save as PDF.',
                },
                {
                  name: 'CSV Export & Duplicate-Safe Import',
                  status: 'Active',
                  detail: 'Exports only authorized visible records with spreadsheet formula escaping.',
                },
                {
                  name: 'Server Database & Real Authentication',
                  status: 'Inactive',
                  detail: 'Unconfigured. Static demo uses local role switching; production requires server-enforced auth & persistent database.',
                },
                {
                  name: 'Outbound Email / SMTP Delivery',
                  status: 'Inactive',
                  detail: 'Unconfigured. Quote emails, invoice emails, and password reset emails remain disabled.',
                },
                {
                  name: 'External Calendar & Payment Gateway',
                  status: 'Inactive',
                  detail: 'Unconfigured. Actions calendar stays inside the app; payments are recorded manually by Manager+.',
                },
              ].map((item) => (
                <div key={item.name} className="p-3 rounded-lg bg-[#F4F8FF] border border-[#DBEAFE]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-[#0A1936]">{item.name}</span>
                    <StatusIndicator status={item.status === 'Active' ? 'Active' : 'Inactive'} />
                  </div>
                  <p className="text-[#3B5998] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title="Add Demo User"
        subtitle="Create a new user account in local demo storage"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Field label="Full Name" required>
            <input
              className={inputCls}
              required
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
          </Field>
          <Field label="Email Address" required>
            <input
              type="email"
              className={inputCls}
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role" required>
              <select
                className={selectCls}
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              >
                {allowedCreateRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team">
              <select
                className={selectCls}
                disabled={isPartnerAdmin}
                value={newUser.team_id}
                onChange={(e) => setNewUser({ ...newUser, team_id: e.target.value })}
              >
                <option value="">No Team</option>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Demo Password">
            <input
              className={inputCls}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create User</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit User Role & Team"
        subtitle={editingUser?.email}
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <Field label="Full Name" required>
            <input
              className={inputCls}
              required
              value={editUserForm.name}
              onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role" required>
              <select
                className={selectCls}
                value={editUserForm.role}
                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as UserRole })}
              >
                {allowedCreateRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team">
              <select
                className={selectCls}
                disabled={isPartnerAdmin}
                value={editUserForm.team_id}
                onChange={(e) => setEditUserForm({ ...editUserForm, team_id: e.target.value })}
              >
                <option value="">No Team</option>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#0A1936] cursor-pointer">
            <input
              type="checkbox"
              checked={editUserForm.is_active}
              onChange={(e) => setEditUserForm({ ...editUserForm, is_active: e.target.checked })}
              className="rounded border-[#93C5FD] text-[#1D4ED8]"
            />
            <span>User account is active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="Create Team"
        subtitle="Teams control shared visibility for BD Users, Managers, and Partner roles"
      >
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <Field label="Team Name" required>
            <input
              className={inputCls}
              required
              placeholder="e.g., EMEA Regulatory Desk"
              value={teamForm.name}
              onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <input
              className={inputCls}
              placeholder="Focus region or institutional mandate"
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-[#0A1936] cursor-pointer">
            <input
              type="checkbox"
              checked={teamForm.is_partner_team}
              onChange={(e) => setTeamForm({ ...teamForm, is_partner_team: e.target.checked })}
              className="rounded border-[#93C5FD] text-[#1D4ED8]"
            />
            <span>Mark as external Partner Team</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTeamOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Team</Button>
          </div>
        </form>
      </Modal>

      {/* Reset Demo Confirmation Modal */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset Demo Workspace?"
        subtitle="Restores all sample organizations, leads, deals, quotes, invoices, and settings to the initial seed state."
      >
        <div className="space-y-4">
          <p className="text-sm text-[#3B5998]">
            Any changes stored in your browser&apos;s localStorage will be replaced with the original sample dataset.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                resetDemoWorkspace();
                setResetConfirmOpen(false);
                onNavigate({ page: 'dashboard' });
              }}
            >
              Confirm Reset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
