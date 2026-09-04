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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background vector accents */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-emerald-700/5 -skew-y-3 transform origin-top-left -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-amber-500/5 skew-y-3 transform origin-bottom-right -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        {/* Header Logo & Subtitle */}
        {(() => {
          const isOldLogo = eventSettings?.ssfLogoUrl && (
            eventSettings.ssfLogoUrl.includes('base64') ||
            eventSettings.ssfLogoUrl.includes('zenith') ||
            eventSettings.ssfLogoUrl.includes('ssf_logo')
          );
          const adminLogoUrl = (!isOldLogo && eventSettings?.ssfLogoUrl) ? eventSettings.ssfLogoUrl : '/tabassum_logo.jpg';

          return eventSettings?.fillLogo ? (
            <div className="flex justify-center items-center py-1 text-center w-full">
              <img
                src={adminLogoUrl}
                alt="Festival Logo"
                style={{
                  height: '112px',
                  width: 'auto',
                  maxWidth: '260px',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.includes('tabassum_logo.jpg')) {
                    target.src = '/tabassum_logo.png';
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex justify-center items-center gap-3 py-1">
              <img
                src={adminLogoUrl}
                alt="Festival Logo"
                className="h-12 w-12 object-contain shrink-0 drop-shadow-xs"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.includes('tabassum_logo.jpg')) {
                    target.src = '/tabassum_logo.png';
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
              <div className="h-8 w-px bg-slate-300" />
              <div className="flex flex-col items-start text-left">
                <span className="font-display font-bold text-emerald-900 text-base tracking-tight leading-none uppercase">
                  {eventSettings?.festivalName || 'At-Tabassum MEELAD FEST'}
                </span>
                <span className="text-amber-600 font-mono text-[10px] font-semibold tracking-widest mt-1 uppercase">
                  {eventSettings?.campusName || eventSettings?.sectorName || 'Noorul Islam Madrasa, Jeppu'}
                </span>
              </div>
            </div>
          );
        })()}

        <p className="text-xs sm:text-sm text-slate-500 font-sans font-medium">
          Festival Management System • {eventSettings?.eventYear || '2026'}
        </p>
      </div>

      {/* Form Card Container (exact size from previous code: sm:max-w-md, shadow-xl sm:rounded-2xl) */}
      {/* Form Card Container */}
      <div
        className="mt-8 w-full mx-auto"
        style={{
          maxWidth: '520px',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <div className="w-full bg-white py-8 px-4 sm:px-10 shadow-xl rounded-2xl border border-slate-100">
          {!mustChange ? (
            <form className="space-y-6" onSubmit={handleLogin} id="login_form">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                  Username
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  id="btn_login_submit"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#009661] hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors cursor-pointer active:scale-[0.99]"
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

        {/* Secure Session Caption */}
        <div className="mt-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
            <BookOpen className="h-3.5 w-3.5 text-slate-400" /> SECURE SESSION VERIFICATION ACTIVE
          </span>
        </div>
      </div>

      <Footer eventSettings={eventSettings} />
    </div>
  );
}
