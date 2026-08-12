import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, Sparkles, BookOpen } from 'lucide-react';
import { User, UserRole } from '../types';
import SSFLogo from './SSFLogo';
import Footer from './Footer';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  eventSettings: any;
  sessionExpired?: boolean;
}

export default function LoginView({ onLoginSuccess, eventSettings, sessionExpired }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  React.useEffect(() => {
    if (sessionExpired) {
      setError('Your session expired. Please log in again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [sessionExpired]);

  // Forced password change fields
  const [mustChange, setMustChange] = useState(false);
  const [tempUser, setTempUser] = useState<User | null>(null);
  const [tempToken, setTempToken] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const loggedUser = data.user as User;

      if (loggedUser.mustChangePassword) {
        // Intercept and force password change
        setTempUser(loggedUser);
        setTempToken(data.token);
        setCurrentPassword(password);
        setMustChange(true);
      } else {
        onLoginSuccess(loggedUser, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setChangeError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setChangeError('Password must be at least 8 characters long');
      return;
    }

    setChangeLoading(true);
    setChangeError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      // Success - log them in now
      if (tempUser) {
        const finalizedUser = { ...tempUser, mustChangePassword: false };
        onLoginSuccess(finalizedUser, tempToken);
      }
    } catch (err: any) {
      setChangeError(err.message);
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-10 px-4 relative overflow-hidden">
      {/* Decorative vector background */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-emerald-700/10 -skew-y-3 transform origin-top-left -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-amber-500/5 skew-y-3 transform origin-bottom-right -z-10" />

      <div className="w-full max-w-sm text-center flex flex-col items-center mx-auto">
        {/* Top Header Branding: Logo + Vertical Line + Festival Name & Campus Name */}
        <div className="flex justify-center items-center gap-3.5 mb-2">
          {eventSettings?.ssfLogoUrl ? (
            <img 
              src={eventSettings.ssfLogoUrl} 
              alt="Festival Logo" 
              className="h-11 w-11 object-contain shrink-0" 
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <SSFLogo className="h-11 w-11 text-emerald-600 shrink-0" showText={false} />
          )}
          <div className="h-9 w-px bg-slate-300" />
          <div className="flex flex-col items-start text-left">
            <span className="font-display font-bold text-emerald-800 text-base tracking-tight leading-tight uppercase">
              {eventSettings?.festivalName || 'ZENITH'}
            </span>
            <span className="text-amber-600 font-mono text-[11px] font-bold tracking-wider uppercase mt-0.5">
              {eventSettings?.campusName || eventSettings?.sectorName || 'MEELAD SOFTWARE'}
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-500 font-sans font-medium mb-5">
          Festival Management System • {eventSettings?.eventYear || '2026'}
        </p>
      </div>

      {/* Login Card Form - Strict 360px max width container */}
      <div className="w-full max-w-sm mx-auto shrink-0" style={{ maxWidth: '360px' }}>
        <div className="bg-white py-6 px-5 sm:px-6 shadow-xl shadow-slate-200/60 rounded-2xl border border-slate-100">
          {!mustChange ? (
            <form className="space-y-4" onSubmit={handleLogin} id="login_form">
              {error && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200">
                  <p className="text-xs font-medium text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Username
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm transition-all bg-white"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm transition-all bg-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  id="btn_login_submit"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs sm:text-sm font-semibold text-white bg-[#009661] hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all cursor-pointer active:scale-[0.99]"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handlePasswordChange} id="change_password_form">
              <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 text-amber-800">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  First-Time Sign In Detected
                </p>
                <p className="text-xs mt-1">
                  You are logging in with a temporary password. You are required to create a new, strong password to secure your account.
                </p>
              </div>

              {changeError && (
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-800">{changeError}</p>
                </div>
              )}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                  New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="Min 8 characters, letters & numbers"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                  Confirm New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={changeLoading}
                  id="btn_update_pw"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {changeLoading ? 'Updating...' : 'Set Password & Enter'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 mb-8">
        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
          <BookOpen className="h-3.5 w-3.5 text-slate-400" /> SECURE SESSION VERIFICATION ACTIVE
        </span>
      </div>

      <Footer eventSettings={eventSettings} />
    </div>
  );
}
