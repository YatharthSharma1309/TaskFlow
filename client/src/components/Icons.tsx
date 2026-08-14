type IconProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** Original TaskFlow mark: TF ligature on an indigo plate. Left bar overhang = T; mid arm = F. */
export const MARK_PATHS = {
  plate: 'M8 0h16a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V8a8 8 0 0 1 8-8z',
  stem: 'M13.5 8A2.5 2.5 0 0 1 16 10.5v11A2.5 2.5 0 0 1 11 21.5v-11A2.5 2.5 0 0 1 13.5 8z',
  topBar: 'M9.5 8h13a2.5 2.5 0 0 1 0 5h-13a2.5 2.5 0 0 1 0-5z',
  midArm: 'M13.25 15.25h6.5a2.25 2.25 0 0 1 0 4.5h-6.5a2.25 2.25 0 0 1 0-4.5z',
} as const;

export function LogoMark({ size = 28, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={MARK_PATHS.plate} fill="#5e6ad2" />
      <path d={MARK_PATHS.stem} fill="#fff" />
      <path d={MARK_PATHS.topBar} fill="#fff" />
      <path d={MARK_PATHS.midArm} fill="#fff" />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.75" cy="6.75" r="4.35" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.1 10.1 13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const METER_PATHS = {
  low: 'M2.5 10h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z',
  mid: 'M7.5 7h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  high: 'M12.5 4h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
} as const;

const METER_BARS = [{ d: METER_PATHS.low }, { d: METER_PATHS.mid }, { d: METER_PATHS.high }] as const;

export function PriorityMeter({
  level,
  className,
}: {
  level: 'all' | 'Low' | 'Medium' | 'High';
  className?: string;
}) {
  const filled = level === 'High' ? 3 : level === 'Medium' ? 2 : level === 'Low' ? 1 : 0;
  const onCount = level === 'all' ? 3 : filled;

  return (
    <svg
      className={`prio-meter ${className ?? ''}`}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {METER_BARS.map((bar, index) => {
        const on = index < onCount;
        return (
          <path
            key={bar.d}
            d={bar.d}
            fill={on ? 'currentColor' : '#8b8d98'}
            opacity={on ? 1 : 0.32}
          />
        );
      })}
    </svg>
  );
}
