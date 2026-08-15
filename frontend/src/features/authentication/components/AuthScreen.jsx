import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { AlertCircle, CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2, X, Sparkles, ArrowLeft, Sun, Moon } from 'lucide-react';
import logoImg from '../../../Images/Logo.png';

export const AuthScreen = () => {
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

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

    // Clean up query string without reloading page
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
      const hasErrors = Object.keys(errors).length > 0;
      if (hasErrors) {
        setServerError('Please fix the validation errors below before submitting.');
      } else {
        setServerError('');
      }
      return !hasErrors;
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
      const hasErrors = Object.keys(errors).length > 0;
      if (hasErrors) {
        setServerError('Please fix the validation errors below before submitting.');
      } else {
        setServerError('');
      }
      return !hasErrors;
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
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      setServerError('Please fix the validation errors below before submitting.');
    } else {
      setServerError('');
    }
    return !hasErrors;
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
        sessionStorage.setItem('authToast', JSON.stringify({
          title: 'Welcome Back!',
          message: 'Signed in successfully to your analytics workspace.',
          type: 'success'
        }));
        await login(authEmail.trim(), authPassword);
        setServerSuccess('Sign in successful! Loading workspace...');
      } else if (authTab === 'signup') {
        sessionStorage.setItem('authToast', JSON.stringify({
          title: 'Workspace Provisioned!',
          message: 'Account & organization registered successfully.',
          type: 'success'
        }));
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
      sessionStorage.removeItem('authToast');
      setServerError(err.message || 'Authentication failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-white transition-colors duration-300 relative select-none font-sans overflow-x-hidden">

      {/* Top right theme toggle button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#111827]/80 hover:bg-slate-100 dark:hover:bg-[#111827] text-slate-700 dark:text-gray-300 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          aria-label="Toggle Theme"
          title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold">Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-[#8B5CF6]" />
              <span className="text-xs font-semibold">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl border border-slate-200 dark:border-[#1F2937]/70 bg-white/90 dark:bg-[#0A0E1A]/80 backdrop-blur-xl shadow-xl dark:shadow-2xl relative transition-all duration-300">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <img src={logoImg} alt="Vizora Logo" className="h-12 w-12 object-contain rounded-4xl shadow-xl shadow-purple-500/20" />
            <h1 className="text-3xl font-extrabold font-display bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-[#a78bfa] dark:to-[#06b6d4] bg-clip-text text-transparent tracking-tight">
              Vizora
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
            {authTab === 'login' && 'Sign in to access your Vizora workspace'}
            {authTab === 'signup' && 'Create your enterprise Vizora workspace'}
            {authTab === 'forgot-password' && 'Recover your account access'}
            {authTab === 'reset-password' && 'Set a new account password'}
          </p>
        </div>

        {/* Auth Tabs for Sign In & Register */}
        {(authTab === 'login' || authTab === 'signup') ? (
          <div className="flex border border-slate-200 dark:border-[#1F2937]/60 mb-6 bg-slate-100/70 dark:bg-slate-900/40 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${authTab === 'login'
                ? 'bg-white dark:bg-[#8B5CF6]/25 text-[#8B5CF6] dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('signup')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${authTab === 'signup'
                ? 'bg-white dark:bg-[#8B5CF6]/25 text-[#8B5CF6] dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
                }`}
            >
              Register
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8B5CF6] dark:text-[#a78bfa] hover:underline cursor-pointer border-none bg-transparent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-3 p-3.5 mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs leading-relaxed"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <div className="font-bold mb-0.5">Authentication Error</div>
              <div>{serverError}</div>
            </div>
            <button
              type="button"
              onClick={() => setServerError('')}
              className="text-rose-600 dark:text-rose-400 hover:opacity-75 cursor-pointer border-none bg-transparent p-0.5"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Global Success Banner */}
        {serverSuccess && (
          <div
            role="status"
            className="flex items-start gap-3 p-3.5 mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs leading-relaxed"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <div className="font-bold mb-0.5">Success</div>
              <div>{serverSuccess}</div>
            </div>
            <button
              type="button"
              onClick={() => setServerSuccess('')}
              className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer border-none bg-transparent p-0.5"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4 text-left" noValidate>

          {/* Owner Name field for Signup */}
          {authTab === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider font-mono mb-1.5">
                Workspace Owner Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className={`w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050810]/80 border ${fieldErrors.name ? 'border-rose-500' : 'border-slate-200 dark:border-[#1F2937]'
                  } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] transition-colors`}
                value={authName}
                onChange={(e) => {
                  setAuthName(e.target.value);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                }}
              />
              {fieldErrors.name && (
                <div className="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {fieldErrors.name}
                </div>
              )}
            </div>
          )}

          {/* Email field (for login, signup, forgot-password) */}
          {authTab !== 'reset-password' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider font-mono mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                className={`w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050810]/80 border ${fieldErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-[#1F2937]'
                  } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] transition-colors`}
                value={authEmail}
                onChange={(e) => {
                  setAuthEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                }}
              />
              {fieldErrors.email && (
                <div className="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {fieldErrors.email}
                </div>
              )}
            </div>
          )}

          {/* Password field (for login, signup, reset-password) */}
          {authTab !== 'forgot-password' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider font-mono">
                  {authTab === 'reset-password' ? 'New Password' : 'Password'}
                </label>
                {authTab === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('forgot-password')}
                    className="text-[11px] font-bold text-[#8B5CF6] hover:underline cursor-pointer border-none bg-transparent p-0"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`w-full h-10 pl-3.5 pr-10 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050810]/80 border ${fieldErrors.password ? 'border-rose-500' : 'border-slate-200 dark:border-[#1F2937]'
                    } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] transition-colors`}
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-white cursor-pointer border-none bg-transparent"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {fieldErrors.password}
                </div>
              )}
            </div>
          )}

          {/* Confirm Password field for Reset Password */}
          {authTab === 'reset-password' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider font-mono mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050810]/80 border ${fieldErrors.confirmPassword ? 'border-rose-500' : 'border-slate-200 dark:border-[#1F2937]'
                  } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] transition-colors`}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: null }));
                }}
              />
              {fieldErrors.confirmPassword && (
                <div className="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {fieldErrors.confirmPassword}
                </div>
              )}
            </div>
          )}

          {/* Reset Token Input if manually entering token or missing */}
          {authTab === 'reset-password' && !resetToken && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider font-mono mb-1.5">
                Reset Security Token
              </label>
              <input
                type="text"
                placeholder="Paste reset token from email"
                className={`w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050810]/80 border ${fieldErrors.token ? 'border-rose-500' : 'border-slate-200 dark:border-[#1F2937]'
                  } text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] transition-colors`}
                value={resetToken}
                onChange={(e) => {
                  setResetToken(e.target.value);
                  if (fieldErrors.token) setFieldErrors(prev => ({ ...prev, token: null }));
                }}
              />
              {fieldErrors.token && (
                <div className="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {fieldErrors.token}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 h-10 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-bold text-xs transition-all cursor-pointer border-none shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {authTab === 'login' && 'Signing In...'}
                {authTab === 'signup' && 'Registering Workspace...'}
                {authTab === 'forgot-password' && 'Sending Reset Link...'}
                {authTab === 'reset-password' && 'Resetting Password...'}
              </>
            ) : (
              <>
                {authTab === 'login' && 'Sign In'}
                {authTab === 'signup' && 'Register'}
                {authTab === 'forgot-password' && 'Send Password Reset Link'}
                {authTab === 'reset-password' && 'Reset Password'}
              </>
            )}
          </button>
        </form>

        {/* OAuth Button & Divider (Only for Login / Signup) */}
        {(authTab === 'login' || authTab === 'signup') && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-[#1F2937]/60" />
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase font-mono tracking-wider">
                <span className="bg-white dark:bg-[#0A0E1A] px-3 text-slate-400 dark:text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <a
              href="http://localhost:5000/auth/google"
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 text-decoration-none shadow-sm cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.47 1.625l2.427-2.427C17.435 1.77 14.975 1 12.24 1c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.782 0 9.613-4.062 9.613-9.78 0-.66-.06-1.296-.188-1.935z" />
              </svg>
              Sign in with Google OAuth
            </a>
          </>
        )}
      </div>
    </div>)
}
