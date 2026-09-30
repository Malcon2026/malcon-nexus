import React from 'react';
import type { Hospital, ImplantCase } from '../../types';
import { PickerSheet } from './PickerSheet';
import { HospitalStep } from './HospitalStep';

interface HospitalPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  hospitals: Hospital[];
  cases: ImplantCase[];
  value: string;
  onSelect: (hospitalId: string) => void;
}

/** Same hospital list as Add Case (recent, frequent, search), shown as a bottom sheet. */
export const HospitalPickerSheet: React.FC<HospitalPickerSheetProps> = ({
  isOpen,
  onClose,
  hospitals,
  cases,
  value,
  onSelect,
}) => (
  <PickerSheet isOpen={isOpen} onClose={onClose} title="Select hospital">
    {isOpen ? (
      <div className="px-4 sm:px-5 pb-4">
        <HospitalStep
          hospitals={hospitals}
          cases={cases}
          value={value}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
        />
      </div>
    ) : null}
  </PickerSheet>
);
