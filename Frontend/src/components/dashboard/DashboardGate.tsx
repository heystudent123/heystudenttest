import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';

const DashboardGate: React.FC = () => {
  const { loading, profileIncomplete } = useDashboard();
  const { updateUserProfile } = useAuth();

  const [profileName, setProfileName] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileWhatsapp, setProfileWhatsapp] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
          <p className="text-[14px] font-medium text-[#64748B]">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (profileIncomplete) {
    const handleSaveProfile = async () => {
      if (!profileName.trim()) { setProfileError('Please enter your full name.'); return; }
      if (!profileCity.trim()) { setProfileError('Please enter your city.'); return; }
      if (!/^\d{10}$/.test(profileWhatsapp)) { setProfileError('Please enter a valid 10-digit WhatsApp number.'); return; }
      setProfileSaving(true);
      setProfileError('');
      try {
        await updateUserProfile({ name: profileName.trim(), city: profileCity.trim(), whatsapp: profileWhatsapp.trim() });
      } catch {
        setProfileError('Failed to save. Please try again.');
      } finally {
        setProfileSaving(false);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4">
        <div className="w-full max-w-md rounded-[22px] border border-[#E8EDF4] bg-white p-8 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <h2 className="text-[22px] font-extrabold text-[#101828]">Complete your profile</h2>
          <p className="mt-1.5 text-[13.5px] text-[#64748B]">
            You need to fill in a few details to access your dashboard. This takes less than a minute.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Full Name *</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">City *</label>
              <input
                type="text"
                value={profileCity}
                onChange={(e) => setProfileCity(e.target.value)}
                placeholder="e.g. Delhi, Mumbai"
                className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">WhatsApp Number *</label>
              <input
                type="tel"
                inputMode="numeric"
                value={profileWhatsapp}
                onChange={(e) => setProfileWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onPaste={(e) => {
                  e.preventDefault();
                  const paste = (e.clipboardData || (window as any).clipboardData).getData('text') || '';
                  setProfileWhatsapp(paste.replace(/\D/g, '').slice(0, 10));
                }}
                maxLength={10}
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            {profileError && <p className="text-[13px] text-red-500">{profileError}</p>}
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="mt-6 w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
          >
            {profileSaving ? 'Saving…' : 'Continue to Dashboard →'}
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default DashboardGate;
