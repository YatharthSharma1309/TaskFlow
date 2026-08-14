import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { fetchBoard, moveTask } from './api';
import { DEFAULT_BOARD_ID, type Board, type Priority, type Task } from './types';
import BoardView from './components/BoardView';
import ErrorBanner from './components/ErrorBanner';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import Toolbar from './components/Toolbar';

const SEARCH_DELAY_MS = 250;

type ModalState =
  | { mode: 'create'; columnId: number }
  | { mode: 'edit'; task: Task };

export default function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadBoard = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchBoard(
        DEFAULT_BOARD_ID,
        { priority, q: debouncedSearch },
        signal
      );
      setBoard(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not load the board');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [priority, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadBoard(controller.signal);
    return () => controller.abort();
  }, [loadBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const tasksById = useMemo(() => {
    const map = new Map<number, Task>();
    board?.columns.forEach((column) => {
      column.tasks.forEach((task) => map.set(task.id, task));
    });
    return map;
  }, [board]);

  function handleDragStart(event: DragStartEvent) {
    const fromData = event.active.data.current?.task as Task | undefined;
    setActiveTask(fromData ?? tasksById.get(Number(event.active.id)) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !board) return;

    const taskId = Number(active.id);
    const task = tasksById.get(taskId);
    const targetColumnId = Number(over.data.current?.columnId);
    if (!task || !targetColumnId || task.column_id === targetColumnId) return;

    const previous = board;
    setBoard(optimisticMove(board, taskId, targetColumnId));

    try {
      await moveTask(taskId, targetColumnId);
      await loadBoard();
    } catch (err) {
      setBoard(previous);
      setError(err instanceof Error ? err.message : 'Could not move the task');
    }
  }

  const visibleCount = board?.columns.reduce((sum, col) => sum + col.tasks.length, 0) ?? 0;
  const filtered = priority !== 'all' || Boolean(debouncedSearch);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand-kicker">TaskFlow</p>
            <h1>{board?.name ?? 'Board'}</h1>
          </div>
        </div>
      </header>

      <div className="viewbar">
        <Toolbar
          priority={priority}
          search={search}
          onPriorityChange={setPriority}
          onSearchChange={setSearch}
        />
        <p className="result-meta">
          {board
            ? filtered
              ? `${visibleCount} matching task${visibleCount === 1 ? '' : 's'}`
              : `${visibleCount} tasks`
            : ' '}
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={() => void loadBoard()} />}

      <main className="board-wrap">
        {loading && !board ? (
          <BoardSkeleton />
        ) : board ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
          >
            <BoardView
              columns={board.columns}
              onAdd={(columnId) => setModal({ mode: 'create', columnId })}
              onEdit={(task) => setModal({ mode: 'edit', task })}
            />
            <DragOverlay dropAnimation={null}>
              {activeTask ? <TaskCard task={activeTask} onEdit={() => undefined} overlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p className="status">The board could not be loaded.</p>
        )}
      </main>

      {modal && board && (
        <TaskModal
          state={modal}
          columns={board.columns}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await loadBoard();
          }}
        />
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="columns" aria-busy="true" aria-label="Loading board">
      {[0, 1, 2].map((index) => (
        <section key={index} className="column">
          <header className="column-header">
            <span className="skel skel-title" />
            <span className="skel skel-count" />
          </header>
          <div className="column-body">
            <div className="skel skel-card" />
            <div className="skel skel-card" />
          </div>
        </section>
      ))}
    </div>
  );
}

function optimisticMove(board: Board, taskId: number, targetColumnId: number): Board {
  let moving: Task | undefined;
  const without = board.columns.map((column) => {
    const task = column.tasks.find((item) => item.id === taskId);
    if (task) moving = task;
    return {
      ...column,
      task_count: task ? Math.max(0, column.task_count - 1) : column.task_count,
      tasks: column.tasks.filter((item) => item.id !== taskId),
    };
  });

  if (!moving) return board;
  const moved: Task = { ...moving, column_id: targetColumnId };

  return {
    ...board,
    columns: without.map((column) =>
      column.id === targetColumnId
        ? { ...column, task_count: column.task_count + 1, tasks: [...column.tasks, moved] }
        : column
    ),
  };
}
