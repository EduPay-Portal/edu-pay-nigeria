import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ADMIN_PAGE_ROLES as P } from "@/lib/permissions";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import StudentWalletPage from "./pages/dashboard/StudentWalletPage";
import StudentTransactionsPage from "./pages/dashboard/StudentTransactionsPage";
import ProfileEditPage from "./pages/dashboard/ProfileEditPage";
import ParentDashboard from "./pages/dashboard/ParentDashboard";
import ParentChildrenPage from "./pages/dashboard/ParentChildrenPage";
import ParentTransactionsPage from "./pages/dashboard/ParentTransactionsPage";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import StudentsPage from "./pages/dashboard/admin/StudentsPage";
import ParentsPage from "./pages/dashboard/admin/ParentsPage";
import TransactionsPage from "./pages/dashboard/admin/TransactionsPage";
import SettingsPage from "./pages/dashboard/admin/SettingsPage";
import SystemStatusPage from "./pages/dashboard/admin/SystemStatusPage";
import BulkImportPage from "./pages/dashboard/admin/BulkImportPage";
import WebhooksPage from "./pages/dashboard/admin/WebhooksPage";
import ReconciliationPage from "./pages/dashboard/admin/ReconciliationPage";
import PaymentSimulatorPage from "./pages/dashboard/admin/PaymentSimulatorPage";
import DVAManagementPage from "./pages/dashboard/admin/DVAManagementPage";
import SettlementsPage from "./pages/dashboard/admin/SettlementsPage";
import AuditLogPage from "./pages/dashboard/admin/AuditLogPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
              
              {/* Protected Dashboard Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route path="student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
                <Route path="student/wallet" element={<ProtectedRoute allowedRoles={['student']}><StudentWalletPage /></ProtectedRoute>} />
                <Route path="student/transactions" element={<ProtectedRoute allowedRoles={['student']}><StudentTransactionsPage /></ProtectedRoute>} />
                <Route path="parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
                <Route path="parent/children" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildrenPage /></ProtectedRoute>} />
                <Route path="parent/transactions" element={<ProtectedRoute allowedRoles={['parent']}><ParentTransactionsPage /></ProtectedRoute>} />
                <Route path="admin" element={<ProtectedRoute allowedRoles={P.dashboard}><AdminDashboard /></ProtectedRoute>} />
                <Route path="admin/students" element={<ProtectedRoute allowedRoles={P.students}><StudentsPage /></ProtectedRoute>} />
                <Route path="admin/parents" element={<ProtectedRoute allowedRoles={P.parents}><ParentsPage /></ProtectedRoute>} />
                <Route path="admin/transactions" element={<ProtectedRoute allowedRoles={P.transactions}><TransactionsPage /></ProtectedRoute>} />
                <Route path="admin/bulk-import" element={<ProtectedRoute allowedRoles={P.bulkImport}><BulkImportPage /></ProtectedRoute>} />
                <Route path="admin/payment-simulator" element={<ProtectedRoute allowedRoles={P.paymentSimulator}><PaymentSimulatorPage /></ProtectedRoute>} />
                <Route path="admin/webhooks" element={<ProtectedRoute allowedRoles={P.webhooks}><WebhooksPage /></ProtectedRoute>} />
                <Route path="admin/reconciliation" element={<ProtectedRoute allowedRoles={P.reconciliation}><ReconciliationPage /></ProtectedRoute>} />
                <Route path="admin/dva" element={<ProtectedRoute allowedRoles={P.dva}><DVAManagementPage /></ProtectedRoute>} />
                <Route path="admin/settlements" element={<ProtectedRoute allowedRoles={P.settlements}><SettlementsPage /></ProtectedRoute>} />
                <Route path="admin/audit" element={<ProtectedRoute allowedRoles={P.audit}><AuditLogPage /></ProtectedRoute>} />
                <Route path="admin/settings" element={<ProtectedRoute allowedRoles={P.settings}><SettingsPage /></ProtectedRoute>} />
                <Route path="admin/status" element={<ProtectedRoute allowedRoles={P.status}><SystemStatusPage /></ProtectedRoute>} />
              </Route>

              <Route path="/profile/edit" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<ProfileEditPage />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
