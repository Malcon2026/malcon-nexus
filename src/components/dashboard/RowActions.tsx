import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { OpsCaseRow } from '../../lib/dashboardOps';
import { dialableNumber, whatsappNumber } from '../../lib/dashboardOps';

interface RowActionsProps {
  row: OpsCaseRow;
  onOpenCase: (caseId: string) => void;
  onOpenWorkflow: () => void;
}

/** Call / Message target the stage owner first, then the hospital contact. */
function resolveContact(row: OpsCaseRow): { phone: string; who: string } | null {
  if (row.ownerPhone) return { phone: row.ownerPhone, who: row.ownerFirstName ?? 'owner' };
  if (row.hospitalPhone) return { phone: row.hospitalPhone, who: row.hospitalName };
  return null;
}

export const RowActions: React.FC<RowActionsProps> = ({ row, onOpenCase, onOpenWorkflow }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contact = resolveContact(row);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const message = `${row.caseNumber} · ${row.hospitalName} · ${row.stage}`;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(row.caseNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
    setMenuOpen(false);
  };

  return (
    <div className={menuOpen ? 'ops-actions is-open' : 'ops-actions'} ref={rootRef}>
      {contact ? (
        <>
          <a
            className="ops-act"
            href={`tel:${dialableNumber(contact.phone)}`}
            aria-label={`Call ${contact.who} about ${row.caseNumber}`}
          >
            Call
          </a>
          <a
            className="ops-act"
            href={`https://wa.me/${whatsappNumber(contact.phone)}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Message ${contact.who} about ${row.caseNumber}`}
          >
            Message
          </a>
        </>
      ) : (
        <>
          <span className="ops-act is-disabled" aria-disabled="true" title="No phone number on file">
            Call
          </span>
          <span className="ops-act is-disabled" aria-disabled="true" title="No phone number on file">
            Message
          </span>
        </>
      )}

      <div className="ops-more">
        <button
          ref={triggerRef}
          type="button"
          className="ops-act ops-act--icon"
          aria-label={`More actions for ${row.caseNumber}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
        {menuOpen && (
          <div className="ops-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onOpenCase(row.id)}>
              Open case
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpenWorkflow();
              }}
            >
              Open workflow board
            </button>
            <button type="button" role="menuitem" onClick={copyNumber}>
              {copied ? 'Copied' : 'Copy case number'}
            </button>
          </div>
        )}
      </div>

      <ChevronRight className="ops-actions__go" aria-hidden />
    </div>
  );
};
