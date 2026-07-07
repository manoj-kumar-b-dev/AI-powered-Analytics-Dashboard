import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle } from 'lucide-react';

export const AuthScreen = () => {
  const { login, register } = useAuth();
  
  const [authTab, setAuthTab] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authTab === 'login') {
        await login(authEmail, authPassword);
      } else {
        await register(authName, authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: 'radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', background: 'linear-gradient(to right, #a78bfa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Antigravity SaaS
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '6px' }}>Tenant Analytics Workspace</p>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--card-border))', marginBottom: '24px' }}>
          <button
            onClick={() => setAuthTab('login')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authTab === 'login' ? '2px solid hsl(var(--primary))' : 'none', color: authTab === 'login' ? 'white' : 'hsl(var(--text-muted))', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthTab('signup')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authTab === 'signup' ? '2px solid hsl(var(--primary))' : 'none', color: authTab === 'signup' ? 'white' : 'hsl(var(--text-muted))', fontWeight: 600, cursor: 'pointer' }}
          >
            Register Org
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {authTab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase' }}>Workspace Owner Name</label>
              <input type="text" placeholder="John Doe" className="input-field" value={authName} onChange={(e) => setAuthName(e.target.value)} required />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase' }}>Email Address</label>
            <input type="email" placeholder="john@example.com" className="input-field" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase' }}>Password</label>
            <input type="password" placeholder="••••••••" className="input-field" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
          </div>

          {authError && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '6px', color: '#f43f5e', fontSize: '0.8rem' }}>
              <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            {authTab === 'login' ? 'Sign In' : 'Register & Auto-provision'}
          </button>
        </form>

        <div style={{ position: 'relative', margin: '24px 0', textAlign: 'center' }}>
          <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'hsl(var(--card-border))', zIndex: 1 }}></span>
          <span style={{ position: 'relative', zIndex: 2, background: 'hsl(var(--card))', padding: '0 12px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Or continue with</span>
        </div>

        <a
          href="http://localhost:5000/auth/google"
          className="btn btn-secondary"
          style={{ width: '100%', textDecoration: 'none', color: 'white', display: 'flex', justifyContent: 'center' }}
        >
          <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} viewBox="0 0 24 24">
            <path fill="currentColor" d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.47 1.625l2.427-2.427C17.435 1.77 14.975 1 12.24 1c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.782 0 9.613-4.062 9.613-9.78 0-.66-.06-1.296-.188-1.935z"/>
          </svg>
          Sign in with Google OAuth
        </a>
      </div>
    </div>
  );
};
