import React from 'react';
import { DashboardStickyNotes } from '../components/DashboardStickyNotes';

export const Notes: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 max-w-[1800px] mx-auto w-full min-w-0">
      <DashboardStickyNotes />
    </div>
  );
};
