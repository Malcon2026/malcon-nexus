import React from 'react';
import { cn } from '../../utils/cn';

interface NexusPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** TMS-style page title row for admin / employee in-app pages. */
export const NexusPageHeader: React.FC<NexusPageHeaderProps> = ({
  title,
  description,
  actions,
  className,
}) => (
  <header className={cn('nexus-page-header', className)}>
    <div className="nexus-page-header__row">
      <div className="min-w-0 flex-1">
        <h1 className="nexus-page-header__title">{title}</h1>
        {description != null && description !== '' && (
          <p className="nexus-page-header__desc">{description}</p>
        )}
      </div>
      {actions ? <div className="nexus-page-header__actions">{actions}</div> : null}
    </div>
  </header>
);

interface NexusPageProps {
  children: React.ReactNode;
  className?: string;
  maxWidthClass?: string;
}

export const NexusPage: React.FC<NexusPageProps> = ({
  children,
  className,
  maxWidthClass = 'max-w-[1180px]',
}) => (
  <div className={cn('nexus-page-inner w-full min-w-0 overflow-x-hidden', maxWidthClass, className)}>
    {children}
  </div>
);
