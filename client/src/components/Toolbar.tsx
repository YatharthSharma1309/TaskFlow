import type { Priority } from '../types';
import { PRIORITIES } from '../types';
import { PriorityMeter } from './Icons';

type Props = {
  priority: Priority | 'all';
  onPriorityChange: (value: Priority | 'all') => void;
  filtered?: boolean;
  onClearFilters?: () => void;
};

const FILTERS: Array<{ id: Priority | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  ...PRIORITIES.map((item) => ({ id: item, label: item })),
];

export default function Toolbar({ priority, onPriorityChange, filtered, onClearFilters }: Props) {
  return (
    <div className="toolbar">
      <div className="priority-field">
        <span className="toolbar-label" id="priority-filter-label">
          Priority
        </span>
        <div className="pills" role="group" aria-labelledby="priority-filter-label">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pill pill-${item.id.toLowerCase()} ${priority === item.id ? 'is-active' : ''}`}
              aria-pressed={priority === item.id}
              onClick={() => onPriorityChange(item.id)}
            >
              <PriorityMeter level={item.id} />
              {item.label}
            </button>
          ))}
        </div>
        {filtered && onClearFilters ? (
          <button type="button" className="filter-clear" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
