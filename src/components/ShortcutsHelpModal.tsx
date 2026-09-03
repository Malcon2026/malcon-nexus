import React from 'react';
import { Modal } from './ui/Modal';
import { modKeyLabel } from '../lib/keyboardShortcuts';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  const mod = modKeyLabel();

  const rows = [
    { keys: `${mod} + N`, action: 'Create new case (admin)' },
    { keys: `${mod} + L`, action: 'Go to Live Cases' },
    { keys: `${mod} + C`, action: 'Go to Cases' },
    { keys: 'Esc', action: 'Close popup / modal' },
    { keys: '?', action: 'Show this help' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <div className="p-5 space-y-3">
        {rows.map((row) => (
          <div key={row.keys} className="flex items-center justify-between gap-4">
            <kbd className="px-2 py-1 text-xs font-mono font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md shrink-0">
              {row.keys}
            </kbd>
            <span className="text-sm text-gray-600 text-right">{row.action}</span>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          Shortcuts work when you are not typing in a text field.
        </p>
      </div>
    </Modal>
  );
};
