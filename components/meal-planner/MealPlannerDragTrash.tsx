import React from 'react';
import { Trash2 } from 'lucide-react';

interface MealPlannerDragTrashProps {
  isDragging: boolean;
  dragOverTrash: boolean;
  onDragOverTrash: (event: React.DragEvent) => void;
  onDragLeaveTrash: (event: React.DragEvent) => void;
  onDropTrash: (event: React.DragEvent) => void;
}

export const MealPlannerDragTrash: React.FC<MealPlannerDragTrashProps> = ({
  isDragging,
  dragOverTrash,
  onDragOverTrash,
  onDragLeaveTrash,
  onDropTrash,
}) => {
  if (!isDragging) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
        dragOverTrash
          ? 'border-red-500 bg-red-500/10 shadow-lg scale-110'
          : 'border-red-400 bg-red-400/5'
      }`}
      onDragOver={onDragOverTrash}
      onDragLeave={onDragLeaveTrash}
      onDrop={onDropTrash}
    >
      <Trash2 className={`w-8 h-8 transition-colors ${dragOverTrash ? 'text-red-500' : 'text-red-400'}`} />
    </div>
  );
};
