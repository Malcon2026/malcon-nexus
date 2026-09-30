import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { isModKey, isTypingTarget } from '../lib/keyboardShortcuts';

interface UseAppShortcutsOptions {
  enabled?: boolean;
  onShowHelp: () => void;
  shortcutsHelpOpen: boolean;
}

export function useAppShortcuts({ enabled = true, onShowHelp, shortcutsHelpOpen }: UseAppShortcutsOptions): void {
  const viewMode = useStore((s) => s.viewMode);
  const currentUser = useStore((s) => s.currentUser);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openCreateCaseModal = useStore((s) => s.openCreateCaseModal);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (shortcutsHelpOpen && e.key === 'Escape') {
        return;
      }

      if (e.key === '?' && !isModKey(e) && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        onShowHelp();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (!isModKey(e)) return;

      const key = e.key.toLowerCase();

      if (key === 'c' && (viewMode === 'admin' || viewMode === 'store_manager')) {
        e.preventDefault();
        openCreateCaseModal();
        return;
      }

      if (key === 'k' && currentUser.role !== 'petrol') {
        e.preventDefault();
        setActiveTab('workflow');
        return;
      }

      if (key === 'l' && currentUser.role !== 'petrol') {
        e.preventDefault();
        setActiveTab('live-cases');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    shortcutsHelpOpen,
    onShowHelp,
    viewMode,
    currentUser.role,
    setActiveTab,
    openCreateCaseModal,
  ]);
}
