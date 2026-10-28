import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { CONTACT_PHONE_DISPLAY } from '../config';

const Footer: React.FC = () => (
  <footer className="border-t border-[#E8EDF4] bg-white">
    <div className="mx-auto grid gap-8 px-8 py-10 sm:grid-cols-2 sm:px-14 lg:grid-cols-4 lg:px-24">
      <div>
        <img src="/logo-mark.png" alt="HeyStudent" className="h-8 w-auto" />
        <p className="mt-3 max-w-[240px] text-[13px] leading-relaxed text-[#64748B]">
          Your CUET preparation partner with mock tests, expert courses, and everything you need to succeed.
        </p>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#101828]">Quick Links</p>
        <ul className="mt-3 space-y-2 text-[13px] text-[#64748B]">
          <li><Link to="/" className="hover:text-[#101828]">Home</Link></li>
          <li><Link to="/courses" className="hover:text-[#101828]">Courses</Link></li>
          <li><Link to="/mock-tests" className="hover:text-[#101828]">Mock Tests</Link></li>
          <li><Link to="/about" className="hover:text-[#101828]">About</Link></li>
          <li><Link to="/contact" className="hover:text-[#101828]">Contact</Link></li>
        </ul>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#101828]">Resources</p>
        <ul className="mt-3 space-y-2 text-[13px] text-[#64748B]">
          <li><Link to="/mock-tests" className="hover:text-[#101828]">Exam Pattern</Link></li>
          <li><Link to="/about" className="hover:text-[#101828]">About CUET</Link></li>
        </ul>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#101828]">Follow Us</p>
        <a href="https://www.instagram.com/heystudent.ig" aria-label="Instagram" className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8EDF4] text-[#64748B] hover:text-[#101828]">
          <Instagram size={15} />
        </a>
        <p className="mt-3 text-[13px] text-[#64748B]">{CONTACT_PHONE_DISPLAY}</p>
        <a href="mailto:heystudentyt@gmail.com" className="mt-1 block text-[13px] text-[#64748B] hover:text-[#101828]">heystudentyt@gmail.com</a>
      </div>
    </div>
    <div className="border-t border-[#E8EDF4]">
      <div className="mx-auto flex flex-col gap-2 px-8 py-4 text-[12px] text-[#94A3B8] sm:flex-row sm:justify-between sm:px-14 lg:px-24">
        <p>© {new Date().getFullYear()} HeyStudent. All rights reserved.</p>
        <p className="flex gap-4">
          <Link to="/about" className="hover:text-[#64748B]">About</Link>
          <Link to="/contact" className="hover:text-[#64748B]">Contact</Link>
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
