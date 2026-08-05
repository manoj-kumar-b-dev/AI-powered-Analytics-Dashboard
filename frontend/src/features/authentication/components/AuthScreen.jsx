import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2, X, Sparkles, ArrowLeft, KeyRound, Mail } from 'lucide-react';

export const AuthScreen = () => {
  const { login, register, forgotPassword, resetPassword } = useAuth();
  
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'signup' | 'forgot-password' | 'reset-password'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');

  // Handle URL query parameters for OAuth redirects, reset tokens, or feedback messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errParam = urlParams.get('error');
    const registeredParam = urlParams.get('registered');
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');

    if (tokenParam) {
      setResetToken(tokenParam);
      setAuthTab('reset-password');
      if (emailParam) {
        setAuthEmail(emailParam);
      }
    } else if (window.location.pathname === '/reset-password') {
      setAuthTab('reset-password');
    }

    if (errParam === 'auth_failed') {
      setServerError('Google authentication was cancelled or failed. Please try again.');
    } else if (errParam === 'token_failed') {
      setServerError('Failed to generate session security token. Please try again.');
    } else if (errParam === 'session_expired') {
      setServerError('Your session has expired. Please sign in again.');
    } else if (registeredParam === 'true') {
      setServerSuccess('Registration successful! Please sign in with your account credentials.');
    }

    // Clean up query string without reloading page (except when displaying reset-password token)
    if (errParam || registeredParam) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Clear messages & field errors on tab switch
  const handleTabSwitch = (tab) => {
    setAuthTab(tab);
    setServerError('');
    setServerSuccess('');
    setFieldErrors({});
  };

  // Client-side validation helper
  const validateForm = () => {
    const errors = {};

    if (authTab === 'signup') {
      if (!authName.trim()) {
        errors.name = 'Workspace owner name is required.';
      } else if (authName.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters long.';
      }
    }

    if (authTab === 'forgot-password') {
      if (!authEmail.trim()) {
        errors.email = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    }

    if (authTab === 'reset-password') {
      if (!resetToken.trim()) {
        errors.token = 'Reset token is missing or invalid. Please request a new link.';
      }
      if (!authPassword) {
        errors.password = 'New password is required.';
      } else if (authPassword.length < 6) {
        errors.password = 'Password must be at least 6 characters long.';
      }
      if (authPassword !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    }

    if (!authEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) {
      errors.email = 'Please enter a valid email address (e.g. user@example.com).';
    }

    if (!authPassword) {
      errors.password = 'Password is required.';
    } else if (authPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setServerSuccess('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (authTab === 'login') {
        await login(authEmail.trim(), authPassword);
        setServerSuccess('Sign in successful! Loading workspace...');
      } else if (authTab === 'signup') {
        await register(authName.trim(), authEmail.trim(), authPassword);
        setServerSuccess('Workspace & account created successfully! Redirecting...');
      } else if (authTab === 'forgot-password') {
        const res = await forgotPassword(authEmail.trim());
        setServerSuccess(res.message || 'If an account exists with that email, a password reset link has been sent.');
      } else if (authTab === 'reset-password') {
        const res = await resetPassword(resetToken.trim(), authPassword);
        setServerSuccess(res.message || 'Password reset successfully! Redirecting to sign in...');
        setTimeout(() => {
          handleTabSwitch('login');
          window.history.replaceState({}, document.title, '/');
        }, 2000);
      }
    } catch (err) {
      console.error('Authentication Submit Error:', err);
      setServerError(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px 16px',
      background: 'radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%)',
      fontFamily: 'var(--font-sans)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '36px 32px', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles style={{ width: '24px', height: '24px', color: '#a78bfa' }} />
            <h1 style={{
              fontSize: '2.2rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(to right, #a78bfa, #06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Antigravity SaaS
            </h1>
          </div>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            {authTab === 'forgot-password' && 'Recover your account access'}
            {authTab === 'reset-password' && 'Set a new account password'}
            {(authTab === 'login' || authTab === 'signup') && 'Tenant Analytics Workspace'}
          </p>
        </div>

        {/* Auth Tabs for Sign In & Register */}
        {(authTab === 'login' || authTab === 'signup') ? (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid hsl(var(--card-border))',
            marginBottom: '24px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            padding: '4px'
          }}>
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: authTab === 'login' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: authTab === 'login' ? '#ffffff' : 'hsl(var(--text-muted))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('signup')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: authTab === 'signup' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: authTab === 'signup' ? '#ffffff' : 'hsl(var(--text-muted))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Register Org
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: '#a78bfa',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              Back to Sign In
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {serverError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '8px',
              color: '#f43f5e',
              fontSize: '0.85rem',
              lineHeight: '1.4'
            }}
          >
            <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>Authentication Error</div>
              <div>{serverError}</div>
            </div>
            <button
              type="button"
              onClick={() => setServerError('')}
              style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '2px' }}
              aria-label="Dismiss error"
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        )}

        {/* Global Success Banner */}
        {serverSuccess && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#10b981',
              fontSize: '0.85rem',
              lineHeight: '1.4'
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>Success</div>
              <div>{serverSuccess}</div>
            </div>
            <button
              type="button"
              onClick={() => setServerSuccess('')}
              style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
              aria-label="Dismiss message"
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
          
          {/* Owner Name field for Signup */}
          {authTab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Workspace Owner Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className="input-field"
                value={authName}
                onChange={(e) => {
                  setAuthName(e.target.value);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                }}
                style={{
                  borderColor: fieldErrors.name ? '#f43f5e' : undefined
                }}
              />
              {fieldErrors.name && (
                <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  {fieldErrors.name}
                </div>
              )}
            </div>
          )}

          {/* Email field (for login, signup, forgot-password) */}
          {authTab !== 'reset-password' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                className="input-field"
                value={authEmail}
                onChange={(e) => {
                  setAuthEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                }}
                style={{
                  borderColor: fieldErrors.email ? '#f43f5e' : undefined
                }}
              />
              {fieldErrors.email && (
                <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  {fieldErrors.email}
                </div>
              )}
            </div>
          )}

          {/* Password field (for login, signup, reset-password) */}
          {authTab !== 'forgot-password' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {authTab === 'reset-password' ? 'New Password' : 'Password'}
                </label>
                {authTab === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('forgot-password')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a78bfa',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field"
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                  }}
                  style={{
                    paddingRight: '40px',
                    borderColor: fieldErrors.password ? '#f43f5e' : undefined
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--text-muted))',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                </button>
              </div>
              {fieldErrors.password && (
                <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  {fieldErrors.password}
                </div>
              )}
            </div>
          )}

          {/* Confirm Password field for Reset Password */}
          {authTab === 'reset-password' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: null }));
                }}
                style={{
                  borderColor: fieldErrors.confirmPassword ? '#f43f5e' : undefined
                }}
              />
              {fieldErrors.confirmPassword && (
                <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  {fieldErrors.confirmPassword}
                </div>
              )}
            </div>
          )}

          {/* Reset Token Input if manually entering token or missing */}
          {authTab === 'reset-password' && !resetToken && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reset Security Token
              </label>
              <input
                type="text"
                placeholder="Paste reset token from email"
                className="input-field"
                value={resetToken}
                onChange={(e) => {
                  setResetToken(e.target.value);
                  if (fieldErrors.token) setFieldErrors(prev => ({ ...prev, token: null }));
                }}
                style={{
                  borderColor: fieldErrors.token ? '#f43f5e' : undefined
                }}
              />
              {fieldErrors.token && (
                <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  {fieldErrors.token}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '6px',
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
                {authTab === 'login' && 'Signing In...'}
                {authTab === 'signup' && 'Registering Workspace...'}
                {authTab === 'forgot-password' && 'Sending Reset Link...'}
                {authTab === 'reset-password' && 'Resetting Password...'}
              </>
            ) : (
              <>
                {authTab === 'login' && 'Sign In'}
                {authTab === 'signup' && 'Register & Auto-provision'}
                {authTab === 'forgot-password' && 'Send Password Reset Link'}
                {authTab === 'reset-password' && 'Reset Password'}
              </>
            )}
          </button>
        </form>

        {/* OAuth Button & Divider (Only for Login / Signup) */}
        {(authTab === 'login' || authTab === 'signup') && (
          <>
            <div style={{ position: 'relative', margin: '24px 0', textAlign: 'center' }}>
              <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'hsl(var(--card-border))', zIndex: 1 }}></span>
              <span style={{ position: 'relative', zIndex: 2, background: 'rgba(30, 41, 59, 0.9)', padding: '0 12px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Or continue with
              </span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
