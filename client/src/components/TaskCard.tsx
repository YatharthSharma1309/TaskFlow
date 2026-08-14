import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { Task } from '../types';

type Props = {
  task: Task;
  onEdit: (task: Task) => void;
  overlay?: boolean;
};

export default function TaskCard({ task, onEdit, overlay = false }: Props) {
  if (overlay) {
    return <CardFace task={task} className="card is-overlay" />;
  }

  return <DraggableCard task={task} onEdit={onEdit} />;
}

function DraggableCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { columnId: task.column_id, task },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <CardFace
      task={task}
      className={`card ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      setNodeRef={setNodeRef}
      dragProps={{ ...attributes, ...listeners }}
      onEdit={onEdit}
    />
  );
}

type FaceProps = {
  task: Task;
  className: string;
  style?: CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  dragProps?: HTMLAttributes<HTMLElement>;
  onEdit?: (task: Task) => void;
};

function CardFace({ task, className, style, setNodeRef, dragProps, onEdit }: FaceProps) {
  const filled = task.priority === 'High' ? 3 : task.priority === 'Medium' ? 2 : 1;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${className} card-priority-${task.priority.toLowerCase()}`}
      onClick={() => onEdit?.(task)}
      {...dragProps}
    >
      <div className="card-top">
        <span className={`prio prio-${task.priority.toLowerCase()}`}>
          <span className="prio-bars" aria-hidden="true">
            <i data-on={filled >= 1 || undefined} />
            <i data-on={filled >= 2 || undefined} />
            <i data-on={filled >= 3 || undefined} />
          </span>
          {task.priority}
        </span>
        {onEdit && (
          <button
            type="button"
            className="card-edit"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            Edit
          </button>
        )}
      </div>
      <h3>{task.title}</h3>
      {task.description?.trim() ? <p className="card-desc">{task.description}</p> : null}
      <time dateTime={task.created_at}>{formatDate(task.created_at)}</time>
    </article>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}
