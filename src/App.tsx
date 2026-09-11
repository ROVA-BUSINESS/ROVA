import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import ReportsPage from './pages/ReportsPage';
import TaxPage from './pages/TaxPage';
import NrsCitWizardPage from './pages/tax/NrsCitWizardPage';
import InvoicesPage from './pages/InvoicesPage';
import ReceiptsPage from './pages/ReceiptsPage';
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
import ExpensesPage from './pages/ExpensesPage';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import AcceptInvitePage from './pages/auth/AcceptInvitePage';
import GmailCallbackPage from './pages/auth/GmailCallbackPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import SolutionsPage from './pages/SolutionsPage';
import CompanyPage from './pages/CompanyPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/billing/BillingPage';
import NoSubscriptionPage from './pages/billing/NoSubscriptionPage';

// ── Auth guards ──────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px var(--accent-border)', animation: 'spin 1.5s linear infinite',
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

// ── Subscription guards ──────────────────────────────────────

/** Gates all app pages behind an active subscription.
 *  The billing page itself is always accessible so users can subscribe. */
function SubscriptionRoute({ children }: { children: React.ReactNode }) {
  const { isActive, loading } = useSubscription();
  const location = useLocation();
  if (loading) return null;
  // Always allow billing page through
  if (location.pathname === '/app/billing') return <>{children}</>;
  if (!isActive) return <NoSubscriptionPage />;
  return <>{children}</>;
}

/** Further restricts a route to Business plan holders only. */
function BusinessRoute({ children }: { children: React.ReactNode }) {
  const { isBusiness, isActive, loading } = useSubscription();
  if (loading) return null;
  if (!isActive) return <NoSubscriptionPage />;
  if (!isBusiness) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Business Plan Required</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
            This feature is available on the ROVA Business plan (₦500/day or ₦15,000/month). Upgrade to unlock WhatsApp AI, payroll, staff accounts, and more.
          </p>
          <a href="/app/billing" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
            background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
            color: 'white', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Upgrade to Business
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
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

          {/* Protected app — wrapped in SubscriptionProvider */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <SubscriptionProvider>
                  <AppLayout />
                </SubscriptionProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />

            {/* These pages check subscription status */}
            <Route path="dashboard" element={<SubscriptionRoute><DashboardPage /></SubscriptionRoute>} />
            <Route path="transactions" element={<SubscriptionRoute><TransactionsPage /></SubscriptionRoute>} />
            <Route path="invoices" element={<SubscriptionRoute><InvoicesPage /></SubscriptionRoute>} />
            <Route path="receipts" element={<SubscriptionRoute><ReceiptsPage /></SubscriptionRoute>} />
            <Route path="expenses" element={<SubscriptionRoute><AdminRoute><ExpensesPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="bills" element={<Navigate to="/app/expenses?tab=bills" replace />} />
            <Route path="assistant" element={<SubscriptionRoute><AssistantPage /></SubscriptionRoute>} />
            <Route path="settings" element={<SubscriptionRoute><SettingsPage /></SubscriptionRoute>} />
            <Route path="notifications" element={<SubscriptionRoute><AdminRoute><NotificationsPage /></AdminRoute></SubscriptionRoute>} />

            {/* Billing — always accessible (no subscription gate) */}
            <Route path="billing" element={<AdminRoute><BillingPage /></AdminRoute>} />

            {/* Admin + Subscription required */}
            <Route path="reports" element={<SubscriptionRoute><AdminRoute><ReportsPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="accounting" element={<SubscriptionRoute><AdminRoute><AccountingHubPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="ledger" element={<SubscriptionRoute><AdminRoute><GeneralLedgerPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="chart-of-accounts" element={<SubscriptionRoute><AdminRoute><ChartOfAccountsPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="journal-entries" element={<SubscriptionRoute><AdminRoute><JournalEntriesPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="trial-balance" element={<SubscriptionRoute><AdminRoute><TrialBalancePage /></AdminRoute></SubscriptionRoute>} />
            <Route path="profit-loss" element={<SubscriptionRoute><AdminRoute><ProfitLossPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="balance-sheet" element={<SubscriptionRoute><AdminRoute><BalanceSheetPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="cash-flow" element={<SubscriptionRoute><AdminRoute><CashFlowPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="tax" element={<SubscriptionRoute><AdminRoute><TaxPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="tax/cit/new" element={<SubscriptionRoute><AdminRoute><NrsCitWizardPage /></AdminRoute></SubscriptionRoute>} />
            <Route path="tax/cit/:filingId" element={<SubscriptionRoute><AdminRoute><NrsCitWizardPage /></AdminRoute></SubscriptionRoute>} />

            {/* Business plan only */}
            <Route path="payroll" element={<SubscriptionRoute><AdminRoute><BusinessRoute><PayrollPage /></BusinessRoute></AdminRoute></SubscriptionRoute>} />
            <Route path="team" element={<SubscriptionRoute><AdminRoute><BusinessRoute><TeamPage /></BusinessRoute></AdminRoute></SubscriptionRoute>} />
            <Route path="team/onboard" element={<SubscriptionRoute><AdminRoute><BusinessRoute><OnboardingPage /></BusinessRoute></AdminRoute></SubscriptionRoute>} />
            <Route path="inventory" element={<SubscriptionRoute><AdminRoute><BusinessRoute><InventoryPage /></BusinessRoute></AdminRoute></SubscriptionRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
