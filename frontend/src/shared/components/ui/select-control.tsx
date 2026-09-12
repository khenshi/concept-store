'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type AriaAttributes,
  type ReactNode,
} from 'react';

interface SelectControlProps {
  children: ReactNode;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
  'aria-label'?: string;
  onValueChange?(value: string): void;
}

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
}

export function SelectControl({
  className = '',
  children,
  value,
  defaultValue = '',
  onValueChange,
  name,
  id,
  disabled,
  required,
  ...ariaProps
}: SelectControlProps) {
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const options = useMemo<SelectOption[]>(
    () =>
      Children.toArray(children).flatMap((child) => {
        if (
          !isValidElement<{
            value?: string;
            disabled?: boolean;
            children?: ReactNode;
          }>(child)
        )
          return [];
        return [
          {
            value: String(child.props.value ?? ''),
            label: Children.toArray(child.props.children).join(''),
            disabled: Boolean(child.props.disabled),
          },
        ];
      }),
    [children],
  );
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  function select(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;
    const selected = listboxRef.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]:not(:disabled)',
    );
    const first = listboxRef.current?.querySelector<HTMLButtonElement>(
      'button:not(:disabled)',
    );
    (selected ?? first)?.focus();
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      )
        setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    const form = containerRef.current?.closest('form');
    if (!form || value !== undefined) return;
    function resetValue() {
      setInternalValue(defaultValue);
      setIsOpen(false);
    }
    form.addEventListener('reset', resetValue);
    return () => form.removeEventListener('reset', resetValue);
  }, [defaultValue, value]);

  return (
    <span
      className="relative block min-w-0"
      ref={containerRef}
      onKeyDown={(event) => {
        if (isOpen && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {name && !disabled ? (
        <input type="hidden" name={name} value={selectedValue} />
      ) : null}
      <button
        ref={triggerRef}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-control-border bg-surface px-3 py-2.5 text-left text-ink transition-colors hover:border-focus focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted disabled:opacity-70 aria-invalid:border-danger ${className}`}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        {...ariaProps}
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label || 'Select an option'}
        </span>
        <svg
          className={`size-4 shrink-0 text-muted transition ${isOpen ? 'rotate-180' : ''}`}
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
      {isOpen ? (
        <div
          ref={listboxRef}
          className="absolute right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-control border border-hairline bg-surface p-1.5 shadow-floating"
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          aria-label={id ? undefined : ariaProps['aria-label']}
          onKeyDown={(event) => {
            const enabled = Array.from(
              listboxRef.current?.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)',
              ) ?? [],
            );
            const current = enabled.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (!enabled.length) return;
            let next = current;
            if (event.key === 'ArrowDown')
              next = (current + 1) % enabled.length;
            else if (event.key === 'ArrowUp')
              next = (current - 1 + enabled.length) % enabled.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = enabled.length - 1;
            else if (event.key === 'Tab') {
              setIsOpen(false);
              triggerRef.current?.focus();
              return;
            } else return;
            event.preventDefault();
            enabled[next]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              className={`flex min-h-11 w-full items-center justify-between rounded-compact border-0 px-3 py-2.5 text-left text-sm focus-visible:outline-offset-[-2px] ${option.value === selectedValue ? 'bg-selected font-semibold text-ink' : 'bg-surface text-ink hover:bg-subtle'} disabled:cursor-not-allowed disabled:opacity-45`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              tabIndex={-1}
              disabled={option.disabled}
              onClick={() => select(option.value)}
            >
              <span>{option.label}</span>
              {option.value === selectedValue ? (
                <span aria-hidden="true">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
