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
  const initial = useRef({
    title: isEdit ? state.task.title : '',
    description: isEdit ? state.task.description ?? '' : '',
    priority: (isEdit ? state.task.priority : 'Medium') as Priority,
    columnId: isEdit ? state.task.column_id : state.columnId,
  });
  const [title, setTitle] = useState(initial.current.title);
  const [description, setDescription] = useState(initial.current.description);
  const [priority, setPriority] = useState<Priority>(initial.current.priority);
  const [columnId, setColumnId] = useState(initial.current.columnId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const titleInvalid = Boolean(localError && !title.trim());
  const dirty =
    title !== initial.current.title ||
    description !== initial.current.description ||
    priority !== initial.current.priority ||
    columnId !== initial.current.columnId;

  useEffect(() => {
    const previous = previousFocusRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = priorOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  function requestClose() {
    if (saving) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestClose();
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
  }, [saving, dirty, confirmDelete, confirmDiscard, onClose]);

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
      setConfirmDiscard(false);
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
    <div className="modal-backdrop" onClick={requestClose} role="presentation">
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
          <button type="button" className="icon-btn" aria-label="Close" onClick={requestClose} disabled={saving}>
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
              aria-describedby={localError ? errorId : undefined}
            />
          </label>
          {localError ? (
            <p className="form-error" id={errorId} role="alert">{localError}</p>
          ) : null}
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
            {confirmDiscard ? (
              <span className="delete-confirm">
                Discard changes?
                <button type="button" className="btn btn-danger" onClick={onClose} disabled={saving}>
                  Discard
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDiscard(false)} disabled={saving}>
                  Keep editing
                </button>
              </span>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
