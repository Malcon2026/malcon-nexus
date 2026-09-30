import React from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QuickCreateCaseModal } from '../QuickCreateCaseModal';
import { FloatingCornerButton } from './FloatingCornerButton';

/** Fixed Add case — admin & store manager on all main app pages. */
export const GlobalAddCaseFab: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const open = useStore((s) => s.createCaseModalOpen);
  const openCreateCaseModal = useStore((s) => s.openCreateCaseModal);
  const closeCreateCaseModal = useStore((s) => s.closeCreateCaseModal);

  const canCreate = viewMode === 'admin' || viewMode === 'store_manager';
  if (!canCreate) return null;

  return (
    <>
      <QuickCreateCaseModal isOpen={open} onClose={closeCreateCaseModal} />
      <FloatingCornerButton
        label="Add case"
        icon={<Plus className="h-5 w-5" />}
        onClick={openCreateCaseModal}
        variant="primary"
        stack="base"
      />
    </>
  );
};
