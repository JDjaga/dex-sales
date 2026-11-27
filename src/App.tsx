/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Layout, type NavRoute } from './components/Layout';
import { ActionsCalendarPage } from './pages/ActionsCalendarPage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadsPage } from './pages/LeadsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrganizationDetailPage } from './pages/OrganizationDetailPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { QuoteDetailPage } from './pages/QuoteDetailPage';
import { QuotesPage } from './pages/QuotesPage';
import { ReportsPage } from './pages/ReportsPage';
import { CrmProvider, useCrm } from './store/crmStore';

const AppRouter: React.FC = () => {
  const { currentUser } = useCrm();
  const [route, setRoute] = useState<NavRoute>({ page: 'dashboard' });

  if (!currentUser) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (route.page) {
      case 'dashboard':
        return <DashboardPage onNavigate={setRoute} />;
      case 'actions':
        return <ActionsCalendarPage onNavigate={setRoute} />;
      case 'organizations':
        return <OrganizationsPage onNavigate={setRoute} />;
      case 'organization':
        return (
          <OrganizationDetailPage
            key={`${route.id}-${route.tab || 'profile'}`}
            orgId={route.id}
            initialTab={route.tab}
            onNavigate={setRoute}
          />
        );
      case 'contacts':
        return <ContactsPage onNavigate={setRoute} />;
      case 'contact':
        return <ContactDetailPage key={route.id} contactId={route.id} onNavigate={setRoute} />;
      case 'leads':
        return <LeadsPage onNavigate={setRoute} />;
      case 'lead':
        return <LeadDetailPage key={route.id} leadId={route.id} onNavigate={setRoute} />;
      case 'opportunities':
        return <OpportunitiesPage onNavigate={setRoute} />;
      case 'opportunity':
        return <OpportunityDetailPage key={route.id} oppId={route.id} onNavigate={setRoute} />;
      case 'products':
        return <ProductsPage />;
      case 'quotes':
        return <QuotesPage onNavigate={setRoute} />;
      case 'quote':
        return <QuoteDetailPage key={route.id} quoteId={route.id} onNavigate={setRoute} />;
      case 'order':
        return <OrderDetailPage key={route.id} orderId={route.id} onNavigate={setRoute} />;
      case 'invoices':
        return <InvoicesPage onNavigate={setRoute} />;
      case 'invoice':
        return <InvoiceDetailPage key={route.id} invoiceId={route.id} onNavigate={setRoute} />;
      case 'reports':
        return <ReportsPage />;
      case 'enquiries':
        return <EnquiriesPage onNavigate={setRoute} />;
      case 'admin':
        return <AdminPage onNavigate={setRoute} />;
      default:
        return <DashboardPage onNavigate={setRoute} />;
    }
  };

  const routeKey = 'id' in route ? `${route.page}-${route.id}` : route.page;

  return (
    <Layout route={route} onNavigate={setRoute}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {renderPage()}
      </motion.div>
    </Layout>
  );
};

export default function App() {
  return (
    <CrmProvider>
      <AppRouter />
    </CrmProvider>
  );
}
