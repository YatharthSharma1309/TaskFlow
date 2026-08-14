import { useDroppable } from '@dnd-kit/core';
import type { Column, Task } from '../types';
import { PlusIcon } from './Icons';
import TaskCard from './TaskCard';

type Tone = 'todo' | 'doing' | 'done';

const EMPTY: Record<Tone, string> = {
  todo: 'Nothing queued yet. Add one below.',
  doing: 'Drag a task here when you start.',
  done: 'Completed tasks land here.',
};

type Props = {
  column: Column;
  tone: Tone;
  filtered: boolean;
  onAdd: (columnId: number) => void;
  onEdit: (task: Task) => void;
  onClearFilters: () => void;
};

export default function ColumnLane({ column, tone, filtered, onAdd, onEdit, onClearFilters }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { columnId: column.id },
  });

  return (
    <section
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
      <div ref={setNodeRef} className="column-body">
        {column.tasks.length === 0 ? (
          <p className="empty">
            {filtered ? (
              <>
                No matching tasks.{' '}
                <button type="button" className="empty-clear" onClick={onClearFilters}>
                  Clear filters
                </button>
              </>
            ) : (
              EMPTY[tone]
            )}
          </p>
        ) : (
          column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} />
          ))
        )}
      </div>
      <button type="button" className="add-task" onClick={() => onAdd(column.id)}>
        <PlusIcon size={12} />
        Add task
      </button>
    </section>
  );
}
