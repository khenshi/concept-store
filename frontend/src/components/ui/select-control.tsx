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
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  function select(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      )
        setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
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
    <span className="relative block min-w-0" ref={containerRef}>
      {name && !disabled ? (
        <input type="hidden" name={name} value={selectedValue} />
      ) : null}
      <button
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[0.6rem] border border-slate-200 bg-white py-2.5 pr-3 pl-3 text-left text-slate-900 transition-colors hover:border-slate-300 focus-visible:border-emerald-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-70 ${className}`}
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
          className={`size-4 shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`}
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
          className="absolute right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-[0.7rem] border border-slate-200 bg-white p-1.5 shadow-lg"
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
        >
          {options.map((option) => (
            <button
              className={`flex w-full cursor-pointer items-center justify-between rounded-[0.5rem] border-0 px-3 py-2.5 text-left text-sm ${option.value === selectedValue ? 'bg-emerald-50 font-bold text-emerald-800' : 'bg-white text-slate-700 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-45`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
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
