import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { fetchBoard, fetchMe, logout, moveTask, setUnauthorizedHandler } from './api';
import { type AuthUser, type Board, type Priority, type Task } from './types';
import AuthScreen from './components/AuthScreen';
import BoardView from './components/BoardView';
import ErrorBanner from './components/ErrorBanner';
import { LogoMark } from './components/Icons';
import SiteFooter from './components/SiteFooter';
import SiteHeader from './components/SiteHeader';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import Toolbar from './components/Toolbar';

const SEARCH_DELAY_MS = 250;

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCorners(args);
};

type ModalState =
  | { mode: 'create'; columnId: number }
  | { mode: 'edit'; task: Task };

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const loadIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const ignoreClicksUntilRef = useRef(0);
  const movingRef = useRef(false);
  const unfilteredBoardRef = useRef<Board | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setBoard(null);
    });
    void fetchMe()
      .then((current) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setSessionReady(true));
    return () => setUnauthorizedHandler(null);
  }, []);

  const loadBoard = useCallback(async () => {
    if (!user?.board_id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const loadId = ++loadIdRef.current;
    try {
      const data = await fetchBoard(
        user.board_id,
        { priority, q: debouncedSearch },
        controller.signal
      );
      if (loadId !== loadIdRef.current) return;
      setBoard(data);
      const isFiltered = priority !== 'all' || Boolean(debouncedSearch.trim());
      if (!isFiltered) unfilteredBoardRef.current = data;
      setError(null);
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      const abortedByUs = controller.signal.aborted;
      if (abortedByUs) return;
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not load the board');
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [user, priority, debouncedSearch]);

  useEffect(() => {
    if (!user) {
      setBoard(null);
      setLoading(false);
      return;
    }
    if (!user.board_id) {
      setBoard(null);
      setLoading(false);
      setError('Your board could not be created. Sign out and try again.');
      return;
    }
    setLoading(true);
    void loadBoard();
    return () => abortRef.current?.abort();
  }, [loadBoard, user]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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

  function ignoreTrailingClick() {
    ignoreClicksUntilRef.current = Date.now() + 200;
  }

  function ifNotAfterDrag(action: () => void) {
    if (Date.now() < ignoreClicksUntilRef.current) return;
    action();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    ignoreTrailingClick();
    if (!over || movingRef.current) return;

    const taskId = Number(active.id);
    const fromDrag = active.data.current?.task as Task | undefined;
    const task = fromDrag ?? tasksById.get(taskId);
    const rawColumnId = over.data.current?.columnId;
    const targetColumnId = typeof rawColumnId === 'number' ? rawColumnId : Number(rawColumnId);
    if (!task || !Number.isInteger(taskId) || taskId < 1) return;
    if (!Number.isInteger(targetColumnId) || targetColumnId < 1) return;
    if (task.column_id === targetColumnId) return;

    movingRef.current = true;
    const generation = loadIdRef.current;
    let previous: Board | null = null;
    setBoard((current) => {
      previous = current;
      return current ? optimisticMove(current, taskId, targetColumnId) : current;
    });

    try {
      await moveTask(taskId, targetColumnId);
      await loadBoard();
    } catch (err) {
      if (loadIdRef.current === generation && previous) setBoard(previous);
      setError(err instanceof Error ? err.message : 'Could not move the task');
    } finally {
      movingRef.current = false;
    }
  }

  const filtered = priority !== 'all' || Boolean(debouncedSearch.trim());
  const visibleCount = board?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0;

  function clearFilters() {
    setPriority('all');
    setSearch('');
    setDebouncedSearch('');
    if (unfilteredBoardRef.current) setBoard(unfilteredBoardRef.current);
  }

  const firstColumnId = board?.columns[0]?.id;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'c' && event.key !== 'C') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (modal || firstColumnId == null) return;
      event.preventDefault();
      setModal({ mode: 'create', columnId: firstColumnId });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, firstColumnId]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* cookie is cleared server-side even if this fails */
    }
    setUser(null);
    setBoard(null);
    unfilteredBoardRef.current = null;
    setError(null);
    setModal(null);
    setSearch('');
    setDebouncedSearch('');
    setPriority('all');
  }

  if (!sessionReady) {
    return (
      <div className="app">
        <header className="site-header">
          <div className="site-header-inner">
            <a className="brand" href="/" aria-label="TaskFlow home">
              <LogoMark size={28} />
              <span className="brand-name">TaskFlow</span>
            </a>
          </div>
        </header>
        <main className="board-wrap">
          <BoardSkeleton />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthed={(next) => {
          setUser(next);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="app">
      <SiteHeader
        search={search}
        onSearchChange={setSearch}
        email={user.email}
        onLogout={() => void handleLogout()}
        onNewTask={
          modal == null && firstColumnId != null
            ? () => setModal({ mode: 'create', columnId: firstColumnId })
            : undefined
        }
      />

      <div className="viewbar">
        <Toolbar
          priority={priority}
          onPriorityChange={setPriority}
          filtered={filtered}
          onClearFilters={clearFilters}
        />
        {filtered && board ? (
          <p className="result-meta" aria-live="polite">
            {loading ? 'Updating… · ' : ''}
            {visibleCount === 1 ? '1 task matches' : `${visibleCount} tasks match`}
            {priority !== 'all' ? ` · ${priority}` : ''}
            {debouncedSearch.trim() ? ` · “${debouncedSearch.trim()}”` : ''}
          </p>
        ) : null}
      </div>

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          onRetry={user.board_id ? () => void loadBoard() : undefined}
        />
      )}

      <main className="board-wrap">
        {loading && !board ? (
          <BoardSkeleton />
        ) : board ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveTask(null);
              ignoreTrailingClick();
            }}
          >
            <BoardView
              columns={board.columns}
              filtered={filtered}
              onAdd={(columnId) => ifNotAfterDrag(() => setModal({ mode: 'create', columnId }))}
              onEdit={(task) => ifNotAfterDrag(() => setModal({ mode: 'edit', task }))}
              onClearFilters={clearFilters}
            />
            <DragOverlay dropAnimation={null}>
              {activeTask ? <TaskCard task={activeTask} onEdit={() => undefined} overlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p className="status">{error ?? 'The board could not be loaded.'}</p>
        )}
      </main>

      <SiteFooter />

      {modal && board && (
        <TaskModal
          key={modal.mode === 'edit' ? `edit-${modal.task.id}` : `create-${modal.columnId}`}
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
