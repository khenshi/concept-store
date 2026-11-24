'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonStyles } from './button';
import { fieldIconForLabel, Icon } from './icon';
import { InputControl } from './input-control';
import { SelectControl } from './select-control';

export type PagedOption = { id: string; label: string };
export type PagedOptionResult = { items: PagedOption[]; hasNext: boolean };

export type PagedOptionSelectProps = {
  id: string;
  value: string;
  selectedOption?: PagedOption | null;
  placeholder: string;
  searchPlaceholder?: string;
  searchOnOpen?: boolean;
  loadPage(query: string, page: number): Promise<PagedOptionResult>;
  onValueChange(value: string): void;
  onOptionChange?(option: PagedOption | null): void;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  retryKey?: number;
  onLoadingChange?(loading: boolean): void;
  'aria-invalid'?: 'true' | 'false' | boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
};

export function PagedOptionSelect(props: PagedOptionSelectProps) {
  return props.searchOnOpen ? (
    <SearchOnOpenPagedOptionSelect {...props} />
  ) : (
    <DefaultPagedOptionSelect {...props} />
  );
}

function DefaultPagedOptionSelect({
  id,
  value,
  selectedOption,
  placeholder,
  searchPlaceholder,
  loadPage,
  onValueChange,
  onOptionChange,
  disabled = false,
  className,
  emptyMessage = 'No options found.',
  retryKey = 0,
  onLoadingChange,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: PagedOptionSelectProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PagedOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const generation = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const current = ++generation.current;
    if (disabled) {
      queueMicrotask(() => setLoading(false));
      onLoadingChange?.(false);
      return () => {};
    }
    onLoadingChange?.(true);
    timer.current = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void loadPage(query.trim(), 1)
        .then((result) => {
          if (current !== generation.current) return;
          setOptions(result.items);
          setPage(1);
          setHasNext(result.hasNext);
        })
        .catch(() => {
          if (current !== generation.current) return;
          setOptions([]);
          setPage(1);
          setHasNext(false);
          setError('Options could not be loaded. Try again.');
        })
        .finally(() => {
          if (current === generation.current) {
            setLoading(false);
            onLoadingChange?.(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [disabled, loadPage, onLoadingChange, query, retryCount, retryKey]);

  const isLoading = !disabled && loading;

  const visibleOptions = useMemo(() => {
    if (!selectedOption || !value || options.some(({ id }) => id === value))
      return options;
    return [selectedOption, ...options];
  }, [options, selectedOption, value]);

  async function loadMore() {
    if (loading || loadingMore || !hasNext) return;
    const current = generation.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await loadPage(query.trim(), nextPage);
      if (current !== generation.current) return;
      setOptions((previous) => [
        ...previous,
        ...result.items.filter(
          (item) => !previous.some(({ id }) => id === item.id),
        ),
      ]);
      setPage(nextPage);
      setHasNext(result.hasNext);
    } catch {
      if (current === generation.current)
        setError('More options could not be loaded.');
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      {searchPlaceholder ? (
        <InputControl
          id={`${id}-search`}
          type="search"
          icon="search"
          value={query}
          disabled={disabled}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}
      <SelectControl
        id={id}
        value={value}
        disabled={
          disabled ||
          isLoading ||
          Boolean(error) ||
          (!loading && !error && visibleOptions.length === 0)
        }
        className={className}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        onValueChange={(next) => {
          onValueChange(next);
          onOptionChange?.(
            visibleOptions.find((option) => option.id === next) ?? null,
          );
        }}
      >
        <option value="">{isLoading ? 'Loading options…' : placeholder}</option>
        {visibleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectControl>
      {hasNext ? (
        <button
          type="button"
          className={buttonStyles({ variant: 'quiet' })}
          disabled={disabled || loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Loading more…' : 'Load more options'}
        </button>
      ) : null}
      {!isLoading && !error && visibleOptions.length === 0 ? (
        <p className="text-sm text-muted" role="status">
          {emptyMessage}
        </p>
      ) : null}
      {error ? (
        <div className="grid gap-2">
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
          <button
            type="button"
            className={buttonStyles({ variant: 'quiet' })}
            onClick={() => setRetryCount((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SearchOnOpenPagedOptionSelect({
  id,
  value,
  selectedOption,
  placeholder,
  searchPlaceholder = 'Search options',
  loadPage,
  onValueChange,
  onOptionChange,
  disabled = false,
  className = '',
  emptyMessage = 'No options found.',
  retryKey = 0,
  onLoadingChange,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: PagedOptionSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PagedOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const generation = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;
  const isOpen = open && !disabled;
  const selectedLabel = selectedOption?.label || placeholder;
  const fieldIcon = fieldIconForLabel(`${ariaLabel ?? ''} ${id}`);

  function prepareLoad() {
    setLoading(true);
    setError(null);
    setOptions([]);
    setPage(1);
    setHasNext(false);
    onLoadingChange?.(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    window.clearTimeout(timer.current);
    const current = ++generation.current;
    timer.current = window.setTimeout(() => {
      void loadPage(query.trim(), 1)
        .then((result) => {
          if (current !== generation.current) return;
          setOptions(result.items);
          setHasNext(result.hasNext);
        })
        .catch(() => {
          if (current !== generation.current) return;
          setError('Options could not be loaded. Try again.');
        })
        .finally(() => {
          if (current !== generation.current) return;
          setLoading(false);
          onLoadingChange?.(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer.current);
      generation.current = current + 1;
    };
  }, [isOpen, loadPage, onLoadingChange, query, retryCount, retryKey]);

  useEffect(() => {
    if (isOpen) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  const visibleOptions = useMemo(() => {
    if (
      !selectedOption ||
      !value ||
      options.some(({ id: optionId }) => optionId === value)
    )
      return options;
    return [selectedOption, ...options];
  }, [options, selectedOption, value]);

  function close() {
    setOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function select(option: PagedOption) {
    onValueChange(option.id);
    onOptionChange?.(option);
    close();
  }

  async function loadMore() {
    if (loading || loadingMore || !hasNext) return;
    const current = generation.current;
    setLoadingMore(true);
    try {
      const result = await loadPage(query.trim(), page + 1);
      if (current !== generation.current) return;
      setOptions((previous) => [
        ...previous,
        ...result.items.filter(
          (item) =>
            !previous.some(({ id: previousId }) => previousId === item.id),
        ),
      ]);
      setPage((currentPage) => currentPage + 1);
      setHasNext(result.hasNext);
    } catch {
      if (current === generation.current)
        setError('More options could not be loaded.');
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  }

  return (
    <span ref={containerRef} className="relative block min-w-0">
      {isOpen ? (
        <InputControl
          ref={inputRef}
          id={id}
          icon="search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded="true"
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          autoComplete="off"
          value={query}
          placeholder={searchPlaceholder}
          disabled={disabled}
          onChange={(event) => {
            prepareLoad();
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            } else if (event.key === 'ArrowDown' && visibleOptions.length) {
              event.preventDefault();
              listboxRef.current
                ?.querySelector<HTMLButtonElement>('[role="option"]')
                ?.focus();
            } else if (event.key === 'Enter' && visibleOptions[0]) {
              event.preventDefault();
              select(visibleOptions[0]);
            }
          }}
        />
      ) : (
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          disabled={disabled}
          className={`relative flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-control-border bg-surface px-3 !pl-10 text-left text-ink transition-colors hover:border-selected-border focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted disabled:opacity-70 ${className}`}
          onClick={() => {
            prepareLoad();
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter') {
              event.preventDefault();
              prepareLoad();
              setOpen(true);
            }
          }}
        >
          <Icon
            name={fieldIcon}
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
          />
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <svg
            className="size-4 shrink-0 text-muted"
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
      )}
      {isOpen ? (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={`Available ${ariaLabel?.toLowerCase() ?? 'options'}`}
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-control border border-hairline bg-surface p-1.5 shadow-floating"
        >
          {loading ? (
            <p className="px-3 py-4 text-sm text-muted" role="status">
              Loading options
            </p>
          ) : error ? (
            <div className="grid gap-2 p-2">
              <p className="text-xs text-danger" role="alert">
                {error}
              </p>
              <button
                type="button"
                className={buttonStyles({ variant: 'quiet' })}
                onClick={() => {
                  prepareLoad();
                  setRetryCount((current) => current + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : visibleOptions.length ? (
            visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === value}
                tabIndex={-1}
                className={`flex min-h-11 w-full items-center justify-between rounded-compact border-0 px-3 py-2.5 text-left text-sm ${option.id === value ? 'bg-selected font-semibold text-ink' : 'bg-surface text-ink hover:bg-subtle'}`}
                onClick={() => select(option)}
              >
                <span>{option.label}</span>
                {option.id === value ? (
                  <Icon name="check" className="size-4" />
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted">{emptyMessage}</p>
          )}
          {hasNext ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Loading more...' : 'Load more options'}
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
