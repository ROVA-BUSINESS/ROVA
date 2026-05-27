import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import ReportsPage from './pages/ReportsPage';
import TaxPage from './pages/TaxPage';
import InvoicesPage from './pages/InvoicesPage';
import SettingsPage from './pages/SettingsPage';
import AccountingHubPage from './pages/accounting/AccountingHubPage';
import GeneralLedgerPage from './pages/accounting/GeneralLedgerPage';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import TrialBalancePage from './pages/accounting/TrialBalancePage';
import ProfitLossPage from './pages/statements/ProfitLossPage';
import BalanceSheetPage from './pages/statements/BalanceSheetPage';
import CashFlowPage from './pages/statements/CashFlowPage';
import PayrollPage from './pages/payroll/PayrollPage';
import AssistantPage from './pages/AssistantPage';
import InventoryPage from './pages/inventory/InventoryPage';
import TeamPage from './pages/team/TeamPage';
import OnboardingPage from './pages/team/OnboardingPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import AcceptInvitePage from './pages/auth/AcceptInvitePage';
import GmailCallbackPage from './pages/auth/GmailCallbackPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import SolutionsPage from './pages/SolutionsPage';
import CompanyPage from './pages/CompanyPage';
import PricingPage from './pages/PricingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(147,51,234,0.4)',
            animation: 'spin 1.5s linear infinite',
          }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading ROVA...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/auth/callback/gmail" element={<ProtectedRoute><GmailCallbackPage /></ProtectedRoute>} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="tax" element={<AdminRoute><TaxPage /></AdminRoute>} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="accounting" element={<AdminRoute><AccountingHubPage /></AdminRoute>} />
            <Route path="ledger" element={<AdminRoute><GeneralLedgerPage /></AdminRoute>} />
            <Route path="chart-of-accounts" element={<AdminRoute><ChartOfAccountsPage /></AdminRoute>} />
            <Route path="journal-entries" element={<AdminRoute><JournalEntriesPage /></AdminRoute>} />
            <Route path="trial-balance" element={<AdminRoute><TrialBalancePage /></AdminRoute>} />
            <Route path="profit-loss" element={<AdminRoute><ProfitLossPage /></AdminRoute>} />
            <Route path="balance-sheet" element={<AdminRoute><BalanceSheetPage /></AdminRoute>} />
            <Route path="cash-flow" element={<AdminRoute><CashFlowPage /></AdminRoute>} />
            <Route path="payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
            <Route path="team" element={<AdminRoute><TeamPage /></AdminRoute>} />
            <Route path="team/onboard" element={<AdminRoute><OnboardingPage /></AdminRoute>} />
            <Route path="notifications" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
