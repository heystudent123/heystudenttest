import React, { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const AdminPageHeader: React.FC<Props> = ({ title, description, actions }) => (
  <div className="border-b border-[#E8EDF4] bg-white px-6 py-6 lg:px-10">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.01em] text-[#101828]">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-[#64748B]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  </div>
);

export default AdminPageHeader;
