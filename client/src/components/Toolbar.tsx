import type { Priority } from '../types';
import { PRIORITIES } from '../types';

type Props = {
  priority: Priority | 'all';
  search: string;
  onPriorityChange: (value: Priority | 'all') => void;
  onSearchChange: (value: string) => void;
};

export default function Toolbar({ priority, search, onPriorityChange, onSearchChange }: Props) {
  return (
    <div className="toolbar">
      <label className="field">
        <span>Search</span>
        <div className="search-wrap">
          <input
            type="search"
            placeholder="Filter by title"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {search && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onSearchChange('')}>
              ×
            </button>
          )}
        </div>
      </label>
      <div className="field">
        <span>Priority</span>
        <div className="pills" role="group" aria-label="Filter by priority">
          <button
            type="button"
            className={`pill ${priority === 'all' ? 'is-active' : ''}`}
            onClick={() => onPriorityChange('all')}
          >
            All
          </button>
          {PRIORITIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`pill ${priority === item ? 'is-active' : ''}`}
              onClick={() => onPriorityChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
