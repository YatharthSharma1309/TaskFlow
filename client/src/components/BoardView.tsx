import type { Column, Task } from '../types';
import ColumnLane from './ColumnLane';

type Props = {
  columns: Column[];
  filtered: boolean;
  onAdd: (columnId: number) => void;
  onEdit: (task: Task) => void;
  onClearFilters: () => void;
};

const TONES = ['todo', 'doing', 'done'] as const;

export default function BoardView({ columns, filtered, onAdd, onEdit, onClearFilters }: Props) {
  return (
    <div className="columns">
      {columns.map((column, index) => (
        <ColumnLane
          key={column.id}
          column={column}
          tone={TONES[index] ?? 'todo'}
          filtered={filtered}
          onAdd={onAdd}
          onEdit={onEdit}
          onClearFilters={onClearFilters}
        />
      ))}
    </div>
  );
}
