import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import AdminLayout from './components/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminOrders from './pages/admin/AdminOrders'
import AdminPricing from './pages/admin/AdminPricing'
import AdminEnv from './pages/admin/AdminEnv'
import AdminPlugins from './pages/admin/AdminPlugins'
import Training from './pages/Training'
import Plans from './pages/Plans'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/app" element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="devices" element={<Navigate to="/app/team" replace />} />
              <Route path="team" element={<Members />} />
              <Route path="training" element={<Training />} />
              <Route path="plans" element={<Plans />} />
            </Route>
            {/* Console Administrativo Dedicado com Sidebar */}
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="pricing" element={<AdminPricing />} />
              <Route path="env" element={<AdminEnv />} />
              <Route path="plugins" element={<AdminPlugins />} />
            </Route>
          </Route>
          <Route path="/training" element={<Navigate to="/app/training" replace />} />
          <Route path="/team" element={<Navigate to="/app/team" replace />} />
          <Route path="/plans" element={<Navigate to="/app/plans" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
