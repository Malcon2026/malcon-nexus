import React from 'react';

/** Secondary Telugu line under English employee-facing text */
export const Te: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <p className={`text-xs leading-snug opacity-90 mt-1 ${className}`.trim()}>{children}</p>
);

/** English primary + Telugu secondary block */
export const Bilingual: React.FC<{
  en: React.ReactNode;
  te: React.ReactNode;
  enClassName?: string;
  teClassName?: string;
}> = ({ en, te, enClassName = '', teClassName = '' }) => (
  <>
    <p className={enClassName}>{en}</p>
    <Te className={teClassName}>{te}</Te>
  </>
);
