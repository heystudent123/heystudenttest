import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Building2, ClipboardList, CreditCard, FileText, Layers, ShieldCheck, Ticket, Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const SECTIONS = [
  { to: '/admin/users', label: 'Users', icon: Users, tint: 'bg-[#EEF0FF] text-[#6B7CFF]', desc: 'Promote, demote, and manage every account.' },
  { to: '/admin/institutes', label: 'Institutes', icon: Building2, tint: 'bg-[#E7F8EF] text-[#1F9D55]', desc: 'Partner institutes.' },
  { to: '/admin/referrals', label: 'Referrals', icon: Ticket, tint: 'bg-[#EEF0FF] text-[#3267f5]', desc: 'Student and institute referral codes, percentages, and coupons.' },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen, tint: 'bg-[#FFF1E8] text-[#E07A1F]', desc: 'Create and edit sellable course listings.' },
  { to: '/admin/posts', label: 'Posts', icon: FileText, tint: 'bg-[#F3EEFF] text-[#9B8AF5]', desc: 'Add resources and updates for enrolled students.' },
  { to: '/admin/questions', label: 'Question Bank', icon: Layers, tint: 'bg-[#EEF0FF] text-[#6B7CFF]', desc: 'Import and manage MCQs for mock tests.' },
  { to: '/admin/mock-tests', label: 'Mock Tests', icon: ClipboardList, tint: 'bg-[#E7F8EF] text-[#1F9D55]', desc: 'Build and publish tests from the question bank.' },
  { to: '/admin/plans', label: 'Plans', icon: ShieldCheck, tint: 'bg-[#FFF1E8] text-[#E07A1F]', desc: 'Bundle courses and mock tests into one offer.' },
  { to: '/admin/payments', label: 'Paid Users & Leads', icon: CreditCard, tint: 'bg-[#F3EEFF] text-[#9B8AF5]', desc: "Everyone who's paid, and everyone who hasn't yet." },
];

const AdminOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <div>
      <AdminPageHeader title={`Welcome, ${firstName}`} description="Pick a section to manage." />

      <div className="px-6 py-7 lg:px-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex flex-col rounded-2xl border border-[#E8EDF4] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,24,40,0.08)]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tint}`}>
                <s.icon size={20} strokeWidth={2.1} />
              </span>
              <p className="mt-4 text-[15.5px] font-bold text-[#101828]">{s.label}</p>
              <p className="mt-1 flex-1 text-[13px] text-[#64748B]">{s.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3267f5]">
                Open <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOverviewPage;
