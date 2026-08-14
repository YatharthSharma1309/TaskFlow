import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createTask, deleteTask, updateTask } from '../api';
import { PRIORITIES, type Column, type Priority, type Task } from '../types';
import { CloseIcon } from './Icons';
import { formatAbsolute, formatFull } from '../dates';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalState =
  | { mode: 'create'; columnId: number }
  | { mode: 'edit'; task: Task };

type Props = {
  state: ModalState;
  columns: Column[];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function TaskModal({ state, columns, onClose, onSaved }: Props) {
  const titleId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  );
  const isEdit = state.mode === 'edit';
  const [title, setTitle] = useState(isEdit ? state.task.title : '');
  const [description, setDescription] = useState(isEdit ? state.task.description ?? '' : '');
  const [priority, setPriority] = useState<Priority>(isEdit ? state.task.priority : 'Medium');
  const [columnId, setColumnId] = useState(isEdit ? state.task.column_id : state.columnId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const titleInvalid = Boolean(localError && !title.trim());

  useEffect(() => {
    const previous = previousFocusRef.current;
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (confirmDelete) {
          setConfirmDelete(false);
          return;
        }
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Title is required');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      if (isEdit) {
        await updateTask(state.task.id, {
          title: trimmed,
          description,
          priority,
          ...(columnId !== state.task.column_id ? { columnId } : {}),
        });
      } else {
        await createTask({
          columnId,
          title: trimmed,
          description,
          priority,
        });
      }
      await onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the task';
      setLocalError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      await deleteTask(state.task.id);
      await onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete the task';
      setLocalError(message);
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={localError ? errorId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{isEdit ? 'Edit task' : 'New task'}</h2>
            {isEdit ? (
              <p className="modal-created" title={formatFull(state.task.created_at)}>
                Created {formatAbsolute(state.task.created_at)}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (localError === 'Title is required') setLocalError(null);
              }}
              maxLength={200}
              placeholder="Issue title"
              aria-invalid={titleInvalid || undefined}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Optional details"
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select value={columnId} onChange={(event) => setColumnId(Number(event.target.value))}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>
            </label>
          </div>
          {localError && <p className="form-error" id={errorId}>{localError}</p>}
          <div className="modal-actions">
            {isEdit && (
              confirmDelete ? (
                <span className="delete-confirm">
                  Delete this task?
                  <button type="button" className="btn btn-danger" onClick={() => void handleDelete()} disabled={saving}>
                    Delete
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={saving}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="btn btn-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Delete
                </button>
              )
            )}
            <span className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
