import { useEffect, useId, useState, type FormEvent } from 'react';
import { createTask, deleteTask, updateTask } from '../api';
import { PRIORITIES, type Column, type Priority, type Task } from '../types';

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
  const isEdit = state.mode === 'edit';
  const [title, setTitle] = useState(isEdit ? state.task.title : '');
  const [description, setDescription] = useState(isEdit ? state.task.description ?? '' : '');
  const [priority, setPriority] = useState<Priority>(isEdit ? state.task.priority : 'Medium');
  const [columnId, setColumnId] = useState(isEdit ? state.task.column_id : state.columnId);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
          columnId,
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
    if (!window.confirm(`Delete “${state.task.title}”? This cannot be undone.`)) return;

    setSaving(true);
    try {
      await deleteTask(state.task.id);
      await onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete the task';
      setLocalError(message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{isEdit ? 'Edit task' : 'New task'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="What needs doing?"
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
              <span>Column</span>
              <select value={columnId} onChange={(event) => setColumnId(Number(event.target.value))}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>
            </label>
          </div>
          {localError && <p className="form-error">{localError}</p>}
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={() => void handleDelete()} disabled={saving}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
