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

  // Lock page scroll while the drawer is open; close on Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

        <button type="button" className="shrink-0 rounded-lg border border-[#E8EDF4] p-2 text-[#101828] lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={18} />
        </button>
      </div>

      {/* Side drawer: overlays the page instead of pushing content down */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 right-0 flex w-[300px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#E8EDF4] px-5">
            <Link to="/" aria-label="HeyStudent home">
              <img src="/logo-mark.png" alt="HeyStudent" className="h-9 w-auto" />
            </Link>
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg border border-[#E8EDF4] p-2 text-[#101828]">
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`block rounded-xl px-4 py-3 text-[15px] font-semibold ${active(link.to) ? 'bg-[#EEF1FF] text-[#3267f5]' : 'text-[#334155] hover:bg-[#F1F5F9]'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="shrink-0 space-y-2 border-t border-[#E8EDF4] p-4">
            {isLoaded && isSignedIn ? (
              <>
                {user?.role === 'admin' && <Link to="/admin" className="block rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#64748B] hover:bg-[#F1F5F9]">Admin</Link>}
                {user?.role === 'institute' && <Link to="/institute/dashboard" className="block rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#64748B] hover:bg-[#F1F5F9]">Institute</Link>}
                <Link to="/student/dashboard" className="block rounded-xl border border-[#D0D5DD] px-4 py-3 text-center text-[14px] font-semibold text-[#101828]">Dashboard</Link>
                <button type="button" onClick={() => signOut()} className="w-full rounded-xl bg-[#111827] px-4 py-3 text-[14px] font-semibold text-white">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block rounded-xl border border-[#D0D5DD] px-4 py-3 text-center text-[14px] font-semibold text-[#101828]">Login</Link>
                <Link to="/signup" className="block rounded-xl bg-[#111827] px-4 py-3 text-center text-[14px] font-semibold text-white">Get Started</Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </header>
  );
};

export default SharedNavbar;
