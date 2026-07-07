import React, { useEffect } from 'react';
import { useAuth } from './features/authentication/contexts/AuthContext';
import { AuthScreen } from './features/authentication/components/AuthScreen';
import { RefreshCw } from 'lucide-react';
import Dashboard from './features/dashboard/pages/Dashboard';

export default function App() {
  const {
    user,
    loading: authLoading
  } = useAuth();

  useEffect(() => {
    if (window.location.pathname !== '/auth-success') {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      localStorage.setItem('token', tokenParam);
    }
    window.location.href = '/';
  }, []);

  // Auth Loading View
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw className="animate-spin" style={{ color: 'hsl(var(--primary))', width: '32px', height: '32px' }} />
        <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>Establishing tenant boundary...</span>
      </div>
    );
  }

  // Unauthenticated screen
  if (!user) {
    return <AuthScreen />;
  }

  // Render the premium SaaS Dashboard UI
  return <Dashboard />;
}
