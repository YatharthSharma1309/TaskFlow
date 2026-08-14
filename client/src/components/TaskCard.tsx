import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import type { Task } from '../types';
import { formatFull, formatRelative } from '../dates';

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
  const { role: _role, ...dragA11y } = attributes;
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      skipClickRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      skipClickRef.current = false;
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isDragging]);

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  function handleCardClick() {
    if (skipClickRef.current) return;
    onEdit(task);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.repeat) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (skipClickRef.current) return;
    onEdit(task);
  }

  return (
    <CardFace
      task={task}
      className={`card ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      setNodeRef={setNodeRef}
      dragProps={{ ...dragA11y, ...listeners, role: 'group', tabIndex: 0 }}
      onCardClick={handleCardClick}
      onCardKeyDown={handleCardKeyDown}
    />
  );
}

type FaceProps = {
  task: Task;
  className: string;
  style?: CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  dragProps?: HTMLAttributes<HTMLElement>;
  onCardClick?: () => void;
  onCardKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

function CardFace({ task, className, style, setNodeRef, dragProps, onCardClick, onCardKeyDown }: FaceProps) {
  const filled = task.priority === 'High' ? 3 : task.priority === 'Medium' ? 2 : 1;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={className}
      aria-label={`${task.title}, ${task.priority} priority. Activate to edit.`}
      {...dragProps}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
    >
      <h3>{task.title}</h3>
      {task.description?.trim() ? <p className="card-desc">{task.description}</p> : null}
      <div className="card-meta">
        <span className={`prio prio-${task.priority.toLowerCase()}`}>
          <span className="prio-bars" aria-hidden="true">
            <i data-on={filled >= 1 || undefined} />
            <i data-on={filled >= 2 || undefined} />
            <i data-on={filled >= 3 || undefined} />
          </span>
          {task.priority}
        </span>
        <time dateTime={task.created_at} title={formatFull(task.created_at)}>
          {formatRelative(task.created_at)}
        </time>
      </div>
    </article>
  );
}
