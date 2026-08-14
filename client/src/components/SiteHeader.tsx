import { CloseIcon, LogoMark, PlusIcon, SearchIcon } from './Icons';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onNewTask?: () => void;
  email?: string;
  onLogout?: () => void;
};

export default function SiteHeader({ search, onSearchChange, onNewTask, email, onLogout }: Props) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/" aria-label="TaskFlow home">
          <LogoMark size={28} />
          <span className="brand-name">TaskFlow</span>
        </a>

        <label className="header-search" htmlFor="task-search">
          <span className="sr-only">Search tasks by title</span>
          <span className="search-icon">
            <SearchIcon size={14} />
          </span>
          <input
            id="task-search"
            type="search"
            placeholder="Search tasks…"
            value={search}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {search ? (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onSearchChange('')}>
              <CloseIcon />
            </button>
          ) : null}
        </label>

        <div className="header-actions">
          <button
            type="button"
            className="header-new"
            onClick={onNewTask}
            disabled={!onNewTask}
            title="New task (C)"
            aria-keyshortcuts="c"
          >
            <PlusIcon />
            New task
            <kbd className="header-new-key">C</kbd>
          </button>
          {email && onLogout ? (
            <div className="header-account">
              <span className="header-email" title={email}>{email}</span>
              <button type="button" className="header-logout" onClick={onLogout}>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
