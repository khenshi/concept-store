'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonStyles } from './button';
import { Icon } from './icon';

export type DateRangePickerValue = {
  fromDay: string;
  throughDay: string;
};

const dayFormatter = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const longDayFormatter = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Manila',
});

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayDate(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function dayValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthDate(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value - 1, 1));
}

function shiftMonth(month: string, amount: number) {
  const date = monthDate(month);
  return monthValue(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)),
  );
}

function todayPhilippines() {
  const parts = Object.fromEntries(
    todayFormatter
      .formatToParts(new Date())
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function monthDays(month: string) {
  const date = monthDate(month);
  const firstWeekday = date.getUTCDay();
  const count = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: count }, (_, index) =>
      dayValue(
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), index + 1),
        ),
      ),
    ),
  ];
}

function selectionLabel({ fromDay, throughDay }: DateRangePickerValue) {
  if (!fromDay) return 'All dates';
  if (!throughDay || fromDay === throughDay)
    return dayFormatter.format(dayDate(fromDay));
  return `${dayFormatter.format(dayDate(fromDay))} – ${dayFormatter.format(dayDate(throughDay))}`;
}

export function DateRangePicker({
  id,
  value,
  onChange,
  onApply,
  onClear,
  label = 'Date',
  filterLabel = 'Date filter',
  dialogLabel = 'Choose dates',
  applyLabel = 'Apply dates',
  clearLabel = 'Clear dates',
  align = 'start',
  validate,
  className = '',
}: {
  id: string;
  value: DateRangePickerValue;
  onChange(value: DateRangePickerValue): void;
  onApply(value: DateRangePickerValue): void;
  onClear?(): void;
  label?: string;
  filterLabel?: string;
  dialogLabel?: string;
  applyLabel?: string;
  clearLabel?: string;
  align?: 'start' | 'end';
  validate?(value: DateRangePickerValue): string | undefined;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthValue(dayDate(todayPhilippines())),
  );
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const selectedLabel = selectionLabel(value);
  const monthLabel = monthFormatter.format(monthDate(visibleMonth));
  const appliedValue = {
    fromDay: value.fromDay,
    throughDay: value.throughDay || value.fromDay,
  };
  const validationError = value.fromDay ? validate?.(appliedValue) : undefined;

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function selectDay(day: string) {
    if (!selecting || !value.fromDay) {
      onChange({ fromDay: day, throughDay: day });
      setSelecting(true);
      return;
    }

    onChange(
      day < value.fromDay
        ? { fromDay: day, throughDay: value.fromDay }
        : { fromDay: value.fromDay, throughDay: day },
    );
    setSelecting(false);
  }

  function apply() {
    if (!value.fromDay || validationError) return;
    onApply(appliedValue);
    setOpen(false);
    setSelecting(false);
  }

  function clear() {
    onClear?.();
    setOpen(false);
    setSelecting(false);
  }

  function toggleOpen() {
    if (!open) {
      setVisibleMonth(
        monthValue(
          dayDate(value.fromDay || value.throughDay || todayPhilippines()),
        ),
      );
      setSelecting(false);
    }
    setOpen((current) => !current);
  }

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 text-xs font-medium text-muted ${className}`}
    >
      <label className="block" htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        className="relative mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-control-border bg-surface px-3 !pl-10 text-left text-sm font-medium text-ink transition-colors hover:border-selected-border focus-visible:border-focus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={filterLabel}
        onClick={toggleOpen}
      >
        <Icon
          name="calendar"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
        />
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <svg
          className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m6 8 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={dialogLabel}
          className={`absolute top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-control border border-hairline bg-surface p-4 shadow-floating ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-label="Previous month"
              onClick={() =>
                setVisibleMonth((current) => shiftMonth(current, -1))
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m14 5-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <p className="text-sm font-semibold text-ink">{monthLabel}</p>
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-label="Next month"
              onClick={() =>
                setVisibleMonth((current) => shiftMonth(current, 1))
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m10 5 7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-muted">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div
            role="grid"
            aria-label={`${monthLabel} calendar`}
            className="mt-1 grid grid-cols-7 gap-1"
          >
            {days.map((day, index) => {
              if (!day)
                return <span key={`empty-${index}`} aria-hidden="true" />;
              const selected =
                day === value.fromDay || day === value.throughDay;
              const rangeStart =
                value.fromDay && value.throughDay
                  ? value.fromDay < value.throughDay
                    ? value.fromDay
                    : value.throughDay
                  : '';
              const rangeEnd =
                value.fromDay && value.throughDay
                  ? value.fromDay < value.throughDay
                    ? value.throughDay
                    : value.fromDay
                  : '';
              const inRange =
                Boolean(rangeStart && rangeEnd) &&
                day > rangeStart &&
                day < rangeEnd;
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-label={longDayFormatter.format(dayDate(day))}
                  aria-selected={selected}
                  className={`grid aspect-square min-h-9 place-items-center rounded-compact text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${selected ? 'bg-action font-semibold text-surface' : inRange ? 'bg-selected text-ink' : 'text-ink hover:bg-subtle'}`}
                  onClick={() => selectDay(day)}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
          <p
            className={`mt-3 text-xs leading-5 ${validationError ? 'text-danger' : 'text-muted'}`}
            role={validationError ? 'alert' : undefined}
          >
            {validationError ??
              (selecting
                ? 'Choose a second date for a range, or apply this day.'
                : 'Choose one day or two dates to filter this view.')}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-hairline pt-3">
            {onClear ? (
              <button
                type="button"
                className={buttonStyles({
                  variant: 'quiet',
                  className: 'min-h-10 shrink-0',
                })}
                onClick={clear}
              >
                {clearLabel}
              </button>
            ) : null}
            <button
              type="button"
              className={buttonStyles({
                variant: 'primary',
                className: 'min-h-10 shrink-0',
              })}
              disabled={!value.fromDay || Boolean(validationError)}
              onClick={apply}
            >
              {applyLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
