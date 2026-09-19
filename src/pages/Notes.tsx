import React from 'react';
import { DashboardStickyNotes } from '../components/DashboardStickyNotes';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';

export const Notes: React.FC = () => {
  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader title="Sticky Notes" description="Team notes visible on the dashboard." />
      <DashboardStickyNotes />
    </NexusPage>
  );
};
