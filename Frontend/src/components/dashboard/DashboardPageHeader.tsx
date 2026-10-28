import React, { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

const DashboardPageHeader: React.FC<Props> = ({ eyebrow, title, description, actions }) => (
  <div className="border-b border-[#E8EDF4] bg-white px-6 py-8 text-center lg:px-10 lg:py-9">
    <p className="text-[12px] font-bold uppercase tracking-[1.5px] text-[#3267f5]">{eyebrow}</p>
    <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-[#101828] lg:text-[30px]">{title}</h1>
    {description && <p className="mx-auto mt-1.5 max-w-xl text-[14px] leading-relaxed text-[#64748B]">{description}</p>}
    {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
  </div>
);

export default DashboardPageHeader;
