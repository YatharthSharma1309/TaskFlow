import type { Column, Task } from '../types';
import ColumnLane from './ColumnLane';

type Props = {
  columns: Column[];
  onAdd: (columnId: number) => void;
  onEdit: (task: Task) => void;
};

const TONES = ['todo', 'doing', 'done'] as const;

export default function BoardView({ columns, onAdd, onEdit }: Props) {
  return (
    <div className="columns">
      {columns.map((column, index) => (
        <ColumnLane
          key={column.id}
          column={column}
          tone={TONES[index] ?? 'todo'}
          onAdd={onAdd}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
