import React from 'react';
import type { Priority } from '../types';
import { cn } from '../utils/cn';
import { priorityColors } from '../utils/helpers';

const PRIORITY_OPTIONS: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

interface PriorityQuickPickProps {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export const PriorityQuickPick: React.FC<PriorityQuickPickProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {PRIORITY_OPTIONS.map((priority) => {
      const active = value === priority;
      return (
        <button
          key={priority}
          type="button"
          onClick={() => onChange(priority)}
          className={cn(
            'px-2 py-2 text-xs font-semibold rounded-lg border transition-colors',
            active
              ? cn(priorityColors[priority], 'ring-2 ring-offset-1')
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
          )}
        >
          {priority}
        </button>
      );
    })}
  </div>
);
