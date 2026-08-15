import React, { useState, useRef } from 'react';
import { useAuth } from '../../authentication/contexts/AuthContext';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { uploadToCloudinary } from '../../../utils/cloudinaryUpload';
import {
  User,
  Sun,
  Moon,
  Check,
  Save,
  CheckCircle2,
  Loader2,
  Camera,
  AlertCircle,
} from 'lucide-react';

export function SettingsPage() {
  const { user, updateUser, apiRequest } = useAuth();
  const { isDark, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');

  // Avatar state — persist across refreshes via localStorage
  const [avatarUrl, setAvatarUrl] = useState(
    () => user?.avatarUrl || localStorage.getItem('userAvatarUrl') || ''
  );
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // When user picks a file, show local preview immediately
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image')) {
      setUploadError('Only image files are supported (JPG, PNG, GIF, WebP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be smaller than 5 MB.');
      return;
    }

    setUploadError('');
    setSelectedFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setUploadError('');
    setIsSubmitting(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload to Cloudinary if a new file was chosen
      if (selectedFile) {
        setIsUploading(true);
        finalAvatarUrl = await uploadToCloudinary(selectedFile);
        setIsUploading(false);
        setAvatarUrl(finalAvatarUrl);
        setAvatarPreview(finalAvatarUrl);
        localStorage.setItem('userAvatarUrl', finalAvatarUrl);
        setSelectedFile(null);
      }

      // Sync state with AuthContext
      if (updateUser) {
        updateUser({ name: displayName, avatarUrl: finalAvatarUrl });
      }

      // Persist to backend database
      if (apiRequest) {
        try {
          await apiRequest('/auth/me', {
            method: 'PUT',
            body: JSON.stringify({ name: displayName, avatarUrl: finalAvatarUrl }),
          });
        } catch (apiErr) {
          console.warn('Backend profile update silent warning:', apiErr);
        }
      }

      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err) {
      setIsUploading(false);
      setUploadError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = displayName
    ? displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 text-left font-sans select-text">

      {/* Header Banner */}
      <div className="flex items-center gap-3 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl shadow-sm dark:shadow-2xl transition-all duration-300">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
          <User className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Manage your profile details and interface theme preferences
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Upload Error Alert */}
      {uploadError && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-[#1E293B] p-6 md:p-8 rounded-2xl shadow-sm dark:shadow-2xl space-y-8">

        <form onSubmit={handleSave} className="space-y-8">

          {/* Account Details Section */}
          <div className="space-y-5">
            <div className="border-b border-slate-200 dark:border-[#1E293B] pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">
                Account Details
              </h2>
            </div>

            {/* ── Profile Photo ── */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar preview */}
              <div className="relative shrink-0 group">
                <div className="h-24 w-24 rounded-2xl overflow-hidden ring-2 ring-[#8B5CF6]/40 shadow-lg shadow-purple-500/10">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white text-2xl font-bold">
                      {initials}
                    </div>
                  )}
                </div>
                {/* Hover overlay */}
                <button
                  type="button"
                  id="avatar-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer border-none"
                >
                  <Camera className="h-5 w-5 text-white" />
                  <span className="text-[10px] text-white font-semibold">Change</span>
                </button>
              </div>

              {/* Upload info + button */}
              <div className="flex flex-col gap-2.5 sm:pt-1">
                <p className="text-xs font-bold text-slate-800 dark:text-white">Profile Photo</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload a photo (JPG, PNG, GIF, WebP) up to 5 MB.
                  <br />Your image is stored on Cloudinary.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] text-[11px] font-bold transition-all cursor-pointer w-fit disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? 'Uploading…' : selectedFile ? 'Change Photo' : 'Upload Photo'}
                </button>
                {selectedFile && !isUploading && (
                  <p className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                    {selectedFile.name} — click &quot;Save Settings&quot; to upload
                  </p>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                id="profile-photo-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Name + Email fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#1E293B] text-slate-900 dark:text-white focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full h-10 px-3.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#070D18]/50 border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-[#1E293B] pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">
                Appearance
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                  isDark
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-white shadow-md'
                    : 'border-slate-200 dark:border-[#1E293B] bg-slate-50 dark:bg-[#070D18] text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 shrink-0">
                  <Moon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold">Dark Mode</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">High contrast dark theme</div>
                </div>
                {isDark && <Check className="h-4.5 w-4.5 text-[#8B5CF6] shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                  !isDark
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-slate-900 dark:text-white shadow-md'
                    : 'border-slate-200 dark:border-[#1E293B] bg-slate-50 dark:bg-[#070D18] text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Sun className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold">Light Mode</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">Clean light layout</div>
                </div>
                {!isDark && <Check className="h-4.5 w-4.5 text-[#8B5CF6] shrink-0" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-6 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-bold text-xs transition-all cursor-pointer border-none shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isUploading ? 'Uploading Image…' : isSubmitting ? 'Saving…' : 'Save Settings'}</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}

