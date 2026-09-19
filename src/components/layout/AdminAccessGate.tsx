import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../ui/Card';
import { NexusPage } from './NexusPageHeader';

interface AdminAccessGateProps {
  title?: string;
  description?: string;
}

/** Centered TMS-style message when a route requires admin role. */
export const AdminAccessGate: React.FC<AdminAccessGateProps> = ({
  title = 'Admin Access Required',
  description = 'This page is only available to administrators.',
}) => (
  <NexusPage maxWidthClass="max-w-lg" className="mt-16 sm:mt-20">
    <Card className="p-8 text-center">
      <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-2">{description}</p>
    </Card>
  </NexusPage>
);
