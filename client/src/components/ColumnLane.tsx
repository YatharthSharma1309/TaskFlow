import { useDroppable } from '@dnd-kit/core';
import type { Column, Task } from '../types';
import TaskCard from './TaskCard';

type Tone = 'todo' | 'doing' | 'done';

type Props = {
  column: Column;
  tone: Tone;
  onAdd: (columnId: number) => void;
  onEdit: (task: Task) => void;
};

export default function ColumnLane({ column, tone, onAdd, onEdit }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { columnId: column.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={`column column-tone-${tone} ${isOver ? 'column-over' : ''}`}
      aria-label={`${column.name}, ${column.task_count} tasks`}
    >
      <header className="column-header">
        <h2>
          <span className="col-dot" aria-hidden="true" />
          {column.name}
        </h2>
        <span className="count" title="Visible / total tasks in this column">
          {column.tasks.length === column.task_count
            ? column.task_count
            : `${column.tasks.length}/${column.task_count}`}
        </span>
      </header>
      <div className="column-body">
        {column.tasks.length === 0 ? (
          <p className="empty">Drop a task here, or add one below.</p>
        ) : (
          column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} />
          ))
        )}
      </div>
      <button type="button" className="add-task" onClick={() => onAdd(column.id)}>
        + Add task
      </button>
    </section>
  );
}
