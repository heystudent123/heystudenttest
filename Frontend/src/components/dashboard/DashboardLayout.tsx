import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { Helmet } from 'react-helmet-async';
import {
  BookOpen, ClipboardList, LayoutGrid, LogOut, Menu, User as UserIcon, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/student/dashboard', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/student/dashboard/courses', label: 'My Courses', icon: BookOpen },
  { to: '/student/dashboard/mock-tests', label: 'Mock Tests', icon: ClipboardList },
  { to: '/student/dashboard/profile', label: 'Profile', icon: UserIcon },
];

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.name || 'S')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex h-[72px] shrink-0 items-center px-6">
        <img src="/logo-mark.png" alt="HeyStudent" className="h-9 w-auto" />
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#94A3B8]">Dashboard</p>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#111827] text-white'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#101828]'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2.1} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-[#E8EDF4] p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF1FF] text-[13px] font-bold text-[#3267f5]">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold text-[#101828]">{user?.name || 'Student'}</p>
            <p className="truncate text-[12px] text-[#94A3B8]">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={() => signOut(() => navigate('/'))}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-[#64748B] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          <LogOut size={17} strokeWidth={2.1} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="hs-page flex min-h-screen bg-[#F7F9FC]">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Desktop sidebar — fixed */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-[#E8EDF4] bg-white lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar — slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-[260px]">
        {/* Top bar — mobile: menu + logo + avatar; desktop: breadcrumb-style strip */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-4 lg:px-10">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#101828] lg:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <img src="/logo-mark.png" alt="HeyStudent" className="h-7 w-auto lg:hidden" />
          <p className="hidden text-[13.5px] font-semibold text-[#64748B] lg:block">
            Student Dashboard
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1FF] text-[12px] font-bold text-[#3267f5] lg:hidden">
            {initials}
          </span>
          <Link
            to="/"
            className="hidden items-center gap-1.5 text-[13px] font-semibold text-[#64748B] transition-colors hover:text-[#101828] lg:flex"
          >
            Back to site
          </Link>
        </header>
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="fixed right-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
