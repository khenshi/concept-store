'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonStyles } from './button';
import { InputControl } from './input-control';
import { SelectControl } from './select-control';

export type PagedOption = { id: string; label: string };
export type PagedOptionResult = { items: PagedOption[]; hasNext: boolean };

export function PagedOptionSelect({
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
}: {
  id: string;
  value: string;
  selectedOption?: PagedOption | null;
  placeholder: string;
  searchPlaceholder?: string;
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
}) {
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
