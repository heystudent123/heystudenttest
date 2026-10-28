import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/courses', label: 'Courses' },
  { to: '/mock-tests', label: 'Mock Tests' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const SharedNavbar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const active = (path: string) => path === '/'
    ? location.pathname === '/'
    : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-40 w-full bg-white">
      <div className="relative flex h-[92px] w-full items-center justify-between gap-4 px-6 lg:px-12 xl:px-16">
        <Link to="/" className="shrink-0" aria-label="HeyStudent home">
          <img src="/logo-mark.png" alt="HeyStudent" className="h-12 w-auto" />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 lg:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[16px] font-bold ${active(link.to) ? 'text-[#101828]' : 'text-[#334155] hover:text-[#101828]'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoaded && isSignedIn ? (
            <>
              {user?.role === 'admin' && <Link to="/admin" className="text-[14px] font-medium text-[#64748B]">Admin</Link>}
              {user?.role === 'institute' && <Link to="/institute/dashboard" className="text-[14px] font-medium text-[#64748B]">Institute</Link>}
              <Link to="/student/dashboard" className="text-[14px] font-medium text-[#101828]">Dashboard</Link>
              <button type="button" onClick={() => signOut()} className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-2 text-[16px] font-bold text-[#101828]">Login</Link>
              <Link to="/signup" className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white">Get Started</Link>
            </>
          )}
        </div>

        <button type="button" className="shrink-0 rounded-lg border border-[#E8EDF4] p-2 text-[#101828] md:hidden" aria-label="Toggle menu" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <nav className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700">{link.label}</Link>
          ))}
          <Link to={isSignedIn ? '/student/dashboard' : '/login'} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700">{isSignedIn ? 'Dashboard' : 'Login'}</Link>
          {!isSignedIn && <Link to="/signup" className="mt-1 block rounded-full bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white">Get Started</Link>}
        </nav>
      )}
    </header>
  );
};

export default SharedNavbar;
