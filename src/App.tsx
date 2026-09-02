import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Playground from './pages/Playground';
import OrgPage from './pages/org/OrgPage';
import OrgStructure from './pages/org/OrgStructure';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute><Layout><Page><Home /></Page></Layout></ProtectedRoute>} />
        <Route path="/playground" element={<ProtectedRoute><Layout><Page><Playground /></Page></Layout></ProtectedRoute>} />
        <Route path="/organization" element={<Navigate to="/organization/dashboard/summary" replace />} />
        <Route path="/organization/dashboard/:tab?" element={<ProtectedRoute><Layout><Page><OrgPage /></Page></Layout></ProtectedRoute>} />
        <Route path="/organization/structure/:section?" element={<ProtectedRoute><Layout><Page><OrgStructure /></Page></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
