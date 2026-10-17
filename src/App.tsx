import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import Members from './pages/Members'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import Admin from './pages/Admin'
import Training from './pages/Training'
import Plans from './pages/Plans'

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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/app" element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="devices" element={<Navigate to="/app/team" replace />} />
              <Route path="team" element={<Members />} />
              <Route path="training" element={<Training />} />
              <Route path="plans" element={<Plans />} />
              <Route path="admin" element={<Admin />} />
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
