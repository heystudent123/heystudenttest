import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { enrollmentsApi } from '../services/api';

const SharedNavbar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { signOut } = useClerk();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isEnrolled, setIsEnrolled] = useState(false);

  // Check enrollment once user is signed in
  useEffect(() => {
    if (!isSignedIn) { setIsEnrolled(false); return; }
    enrollmentsApi.getMyEnrollments()
      .then(res => setIsEnrolled((res.data || []).length > 0))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkScreenSize();
    
    // Add event listener
    window.addEventListener('resize', checkScreenSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY) {
          // Scrolling down
          setShowNavbar(false);
        } else {
          // Scrolling up
          setShowNavbar(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    window.addEventListener('scroll', controlNavbar);
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY]);

  // Close mobile menu when clicking a link
  const handleLinkClick = () => {
    if (isMobile) {
      setIsMenuOpen(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff9ed' }}>
      <nav
        style={{
          position: 'fixed',
          top: showNavbar ? 0 : '-100px',
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: 9999,
          backgroundColor: '#fff9ed',
          color: 'black',
          overflow: 'visible', // allow logo to overflow visually without changing nav height
          transition: 'top 0.3s',
          height: '64px',
          minHeight: '64px',
          boxSizing: 'border-box',
        }}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center relative">
            {/* Logo (image only) */}
            <Link to="/" className="flex items-center flex-shrink-0" onClick={handleLinkClick} aria-label="Home" style={{ alignItems: 'center' }}>
              <img
                src="/logo.png"
                alt="Heystudent"
                style={{
                  height: '200px',
                  maxWidth: '180px',
                  width: 'auto',
                  objectFit: 'contain',
                  transform: 'translateY(0px)',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            </Link>

            {/* Desktop Navigation — centered absolutely so it's always in the middle */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-6">
              <Link
                to="/"
                className={`font-medium ${location.pathname === '/' ? 'text-black font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Home
              </Link>
              <Link
                to="/about"
                className={`font-medium ${location.pathname === '/about' ? 'text-black font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                About Us
              </Link>
              <Link
                to="/courses"
                className={`font-medium ${location.pathname === '/courses' ? 'text-black font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Courses
              </Link>
              <Link
                to="/cuet-predictor"
                className={`font-medium ${location.pathname === '/cuet-predictor' ? 'text-black font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                CUET Predictor
              </Link>
              {isEnrolled && (
                <Link
                  to="/student/dashboard"
                  className={`font-medium ${location.pathname === '/student/dashboard' ? 'text-black font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  My Dashboard
                </Link>
              )}
            </div>

            {/* Right side — auth controls */}
            <div className="hidden md:flex items-center space-x-4">
              {isLoaded && isSignedIn ? (
                <>
                  {user?.role === 'admin' && (
                    <Link to="/admin" className="font-medium text-blue-600 hover:text-blue-800">
                      Admin Panel
                    </Link>
                  )}
                  {user?.role === 'institute' && (
                    <Link to="/institute/dashboard" className="font-medium text-blue-600 hover:text-blue-800">
                      Institute Dashboard
                    </Link>
                  )}
                  <button
                    onClick={() => signOut({ redirectUrl: '/' })}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : isLoaded ? (
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-[#fff0d0]"
                >
                  Sign In
                </Link>
              ) : null}
            </div>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden flex items-center justify-center p-2 rounded-md focus:outline-none hamburger-menu-btn ml-auto"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              {!isMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#000000">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#000000">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile menu, show/hide based on menu state */}
        {isMobile && isMenuOpen && (
          <div className="md:hidden bg-[#fff9ed] shadow-lg border-t">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {/* Main navigation links */}
              <Link 
                to="/" 
                className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/' ? 'text-black font-bold underline bg-[#ffe8b5]' : 'text-gray-800 hover:bg-[#ffe8b5]'}`}
                onClick={handleLinkClick}
              >
                Home
              </Link>
              <Link 
                to="/about" 
                className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/about' ? 'text-black font-bold underline bg-[#ffe8b5]' : 'text-gray-800 hover:bg-[#ffe8b5]'}`}
                onClick={handleLinkClick}
              >
                About Us
              </Link>
              {isEnrolled && (
                <Link
                  to="/student/dashboard"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/student/dashboard' ? 'text-black font-bold underline bg-[#ffe8b5]' : 'text-gray-800 hover:bg-[#ffe8b5]'}`}
                  onClick={handleLinkClick}
                >
                  My Dashboard
                </Link>
              )}
              <Link
                to="/courses"
                className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/courses' ? 'text-black font-bold underline bg-[#ffe8b5]' : 'text-gray-800 hover:bg-[#ffe8b5]'}`}
                onClick={handleLinkClick}
              >
                Courses
              </Link>
              <Link
                to="/cuet-predictor"
                className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/cuet-predictor' ? 'text-black font-bold underline bg-[#ffe8b5]' : 'text-gray-800 hover:bg-[#ffe8b5]'}`}
                onClick={handleLinkClick}
              >
                CUET Predictor
              </Link>

              {/* Divider */}
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* User-specific links */}
              {isLoaded && isSignedIn ? (
                <>
                  {/* Role-specific links */}
                  {user?.role === 'admin' && (
                    <Link 
                      to="/admin" 
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-[#ffe8b5]"
                      onClick={handleLinkClick}
                    >
                      Admin Panel
                    </Link>
                  )}
                  {user?.role === 'institute' && (
                    <Link 
                      to="/institute/dashboard" 
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-[#ffe8b5]"
                      onClick={handleLinkClick}
                    >
                      Institute Dashboard
                    </Link>
                  )}
                  
                  {/* User account links */}
                  <div className="mt-3 space-y-1">
                    <button
                      onClick={() => { signOut({ redirectUrl: '/' }); setIsMenuOpen(false); }}
                      className="block w-full text-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-[#ffe8b5]"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : isLoaded ? (
                <Link 
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-[#ffe8b5]"
                  onClick={handleLinkClick}
                >
                  Sign In
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
};

export default SharedNavbar;
