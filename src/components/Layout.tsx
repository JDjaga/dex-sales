import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CheckCheck,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useCrm } from '../store/crmStore';
import { canAccessEnquiries, isAdminPlus, isReadOnlyRole } from '../store/policy';
import { BrandIcon, BrandLogo } from './BrandLogo';
import { StatusIndicator } from './ui';

export type NavRoute =
  | { page: 'dashboard' }
  | { page: 'actions' }
  | { page: 'organizations' }
  | { page: 'organization'; id: string; tab?: 'profile' | 'brief' }
  | { page: 'contacts' }
  | { page: 'contact'; id: string }
  | { page: 'leads' }
  | { page: 'lead'; id: string }
  | { page: 'opportunities' }
  | { page: 'opportunity'; id: string }
  | { page: 'products' }
  | { page: 'quotes' }
  | { page: 'quote'; id: string }
  | { page: 'order'; id: string }
  | { page: 'invoices' }
  | { page: 'invoice'; id: string }
  | { page: 'reports' }
  | { page: 'enquiries' }
  | { page: 'admin' };

interface LayoutProps {
  route: NavRoute;
  onNavigate: (r: NavRoute) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ route, onNavigate, children }) => {
  const {
    state,
    currentUser,
    visibleOrganizations,
    visibleContacts,
    visibleLeads,
    visibleOpportunities,
    visibleInvoices,
    visibleNotifications,
    signInAsUser,
    signOut,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoWorkspace,
  } = useCrm();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ label: string; kind: string; sub: string; nav: NavRoute }> = [];

    for (const o of visibleOrganizations) {
      if (o.name.toLowerCase().includes(q) || o.country.toLowerCase().includes(q)) {
        results.push({ label: o.name, kind: 'Organization', sub: `${o.org_type} · ${o.country}`, nav: { page: 'organization', id: o.id } });
      }
    }
    for (const c of visibleContacts) {
      const full = `${c.first_name} ${c.last_name}`.toLowerCase();
      if (full.includes(q) || c.work_email.toLowerCase().includes(q) || c.personal_email.toLowerCase().includes(q)) {
        results.push({ label: `${c.first_name} ${c.last_name}`, kind: 'Contact', sub: c.work_email || c.phone, nav: { page: 'contact', id: c.id } });
      }
    }
    for (const l of visibleLeads) {
      if (l.lead_number.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q)) {
        results.push({ label: `${l.lead_number} · ${l.purpose}`, kind: 'Lead', sub: l.stage, nav: { page: 'lead', id: l.id } });
      }
    }
    for (const op of visibleOpportunities) {
      if (op.opp_number.toLowerCase().includes(q) || op.title.toLowerCase().includes(q)) {
        results.push({ label: `${op.opp_number} · ${op.title}`, kind: 'Opportunity', sub: op.stage, nav: { page: 'opportunity', id: op.id } });
      }
    }
    for (const inv of visibleInvoices) {
      if ((inv.invoice_number || 'Draft').toLowerCase().includes(q)) {
        results.push({ label: inv.invoice_number || 'Draft Invoice', kind: 'Invoice', sub: inv.status, nav: { page: 'invoice', id: inv.id } });
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, visibleOrganizations, visibleContacts, visibleLeads, visibleOpportunities, visibleInvoices]);

  const navGroups = [
    {
      heading: 'Workspace',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, active: route.page === 'dashboard', nav: { page: 'dashboard' } as NavRoute },
        { label: 'Follow-ups & Calendar', icon: CalendarClock, active: route.page === 'actions', nav: { page: 'actions' } as NavRoute },
      ],
    },
    {
      heading: 'Relationships & Pipeline',
      items: [
        { label: 'Organizations', icon: Building2, active: route.page === 'organizations' || route.page === 'organization', nav: { page: 'organizations' } as NavRoute },
        { label: 'Contacts', icon: Users, active: route.page === 'contacts' || route.page === 'contact', nav: { page: 'contacts' } as NavRoute },
        { label: 'Leads', icon: Target, active: route.page === 'leads' || route.page === 'lead', nav: { page: 'leads' } as NavRoute },
        { label: 'Opportunities', icon: TrendingUp, active: route.page === 'opportunities' || route.page === 'opportunity', nav: { page: 'opportunities' } as NavRoute },
      ],
    },
    {
      heading: 'Commercial Desk',
      items: [
        { label: 'Quotes', icon: FileSpreadsheet, active: route.page === 'quotes' || route.page === 'quote', nav: { page: 'quotes' } as NavRoute },
        { label: 'Invoices & Payments', icon: Receipt, active: route.page === 'invoices' || route.page === 'invoice' || route.page === 'order', nav: { page: 'invoices' } as NavRoute },
        { label: 'Product Catalog', icon: Package, active: route.page === 'products', nav: { page: 'products' } as NavRoute },
      ],
    },
    {
      heading: 'Reporting & Admin',
      items: [
        { label: 'Reports & Exports', icon: BarChart3, active: route.page === 'reports', nav: { page: 'reports' } as NavRoute },
        ...(canAccessEnquiries(currentUser, state.settings)
          ? [{ label: 'Enquiry Queue', icon: Inbox, active: route.page === 'enquiries', nav: { page: 'enquiries' } as NavRoute }]
          : []),
        ...(currentUser && isAdminPlus(currentUser.role)
          ? [{ label: 'Admin & Settings', icon: Settings, active: route.page === 'admin', nav: { page: 'admin' } as NavRoute }]
          : []),
      ],
    },
  ];

  const handleNav = (n: NavRoute) => {
    onNavigate(n);
    setMobileMenuOpen(false);
    setSearchQuery('');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#DBEAFE]">
      {/* Brand Lockup: logo1 above, logo2 cleanly below */}
      <div className="px-5 py-4 border-b border-[#DBEAFE]">
        <button
          onClick={() => handleNav({ page: 'dashboard' })}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded-lg"
        >
          <BrandLogo size="sm" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
        {navGroups.map((grp) => (
          <div key={grp.heading}>
            <div className="px-3 mb-1.5 text-[11px] font-semibold text-[#3B5998] tracking-wide">
              {grp.heading}
            </div>
            <div className="space-y-0.5">
              {grp.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNav(item.nav)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      item.active
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-[#0F295C] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Static Demo Mode Footer */}
      <div className="p-3.5 border-t border-[#DBEAFE] bg-[#F4F8FF]">
        <div className="text-xs font-semibold text-[#0F295C]">Static Demo Workspace</div>
        <div className="text-[11px] text-[#3B5998] mt-0.5 leading-snug">
          Browser-local persistence. Changes survive page refresh.
        </div>
        <button
          onClick={() => {
            resetDemoWorkspace();
            handleNav({ page: 'dashboard' });
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Reset demo data
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-white text-[#0A1936]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 no-print">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="w-64 h-full bg-white shadow-xl">{sidebarContent}</div>
          <div className="flex-1 bg-[#0A1936]/30" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 px-4 sm:px-6 border-b border-[#DBEAFE] bg-white flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-[#0F295C] hover:bg-[#EFF6FF]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="lg:hidden flex items-center gap-2 shrink-0">
              <BrandIcon className="h-6 w-auto" />
            </div>

            {/* Scoped Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#3B5998] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations, contacts, leads, deals..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#F4F8FF] border border-[#DBEAFE] rounded-lg text-[#0A1936] placeholder-[#6B88B5] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1D4ED8]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3B5998]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-[#BFDBFE] rounded-xl shadow-lg z-40 overflow-hidden animate-pop-in">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[#3B5998]">
                      No permitted records matching &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EFF6FF]">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleNav(res.nav)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#EFF6FF] flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#0A1936] truncate">{res.label}</div>
                            <div className="text-xs text-[#3B5998] truncate">{res.sub}</div>
                          </div>
                          <span className="text-[11px] font-medium text-[#1D4ED8] shrink-0">{res.kind}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser && isReadOnlyRole(currentUser.role) && (
              <span className="hidden sm:inline-block">
                <StatusIndicator status="Read-only" />
              </span>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setRoleMenuOpen(false);
                }}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-[#DBEAFE] text-[#0F295C] hover:bg-[#EFF6FF] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1D4ED8] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#BFDBFE] rounded-xl shadow-lg z-40 overflow-hidden animate-pop-in">
                  <div className="px-4 py-3 border-b border-[#DBEAFE] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0F295C]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-xs text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#EFF6FF]">
                    {visibleNotifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#3B5998]">No notifications in your scope.</div>
                    ) : (
                      visibleNotifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            markNotificationRead(n.id);
                            setNotifOpen(false);
                            if (n.entity_type === 'lead') handleNav({ page: 'lead', id: n.entity_id });
                            else if (n.entity_type === 'quote') handleNav({ page: 'quote', id: n.entity_id });
                            else if (n.entity_type === 'enquiry') handleNav({ page: 'enquiries' });
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-[#EFF6FF] cursor-pointer ${
                            n.is_read ? 'bg-white' : 'bg-[#F4F8FF]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#0A1936]">{n.title}</div>
                          <div className="text-xs text-[#3B5998] mt-0.5">{n.body}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Active Demo User / Quick Role Switcher */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => {
                    setRoleMenuOpen(!roleMenuOpen);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[#BFDBFE] bg-white hover:bg-[#EFF6FF] text-left cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-md bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {currentUser.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <div className="text-xs font-semibold text-[#0A1936] whitespace-nowrap">{currentUser.name}</div>
                    <div className="text-[11px] text-[#1D4ED8] whitespace-nowrap">{currentUser.role}</div>
                  </div>
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-[#BFDBFE] rounded-xl shadow-lg z-40 overflow-hidden animate-pop-in">
                    <div className="px-4 py-2.5 bg-[#F4F8FF] border-b border-[#DBEAFE]">
                      <div className="text-xs font-semibold text-[#0F295C]">Switch Demo Role / User</div>
                      <div className="text-[11px] text-[#3B5998]">
                        Test visibility and permissions instantly
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#EFF6FF]">
                      {state.users
                        .filter((u) => u.is_active)
                        .map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              signInAsUser(u.id);
                              setRoleMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[#EFF6FF] cursor-pointer ${
                              u.id === currentUser.id ? 'bg-[#EFF6FF]' : ''
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold text-[#0A1936]">{u.name}</div>
                              <div className="text-[11px] text-[#3B5998]">{u.email}</div>
                            </div>
                            <span className="text-[11px] font-medium text-[#1D4ED8] shrink-0">{u.role}</span>
                          </button>
                        ))}
                    </div>
                    <div className="p-2 border-t border-[#DBEAFE]">
                      <button
                        onClick={() => {
                          setRoleMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#0F295C] hover:bg-[#EFF6FF] rounded-lg cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out to login screen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
