'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import {
  reportDateRangeSchema,
  type ReportDateRange,
} from '../model/report-dates';

export function ReportDateFilter({
  value,
  onChange,
  onApply,
}: {
  value: ReportDateRange;
  onChange(value: ReportDateRange): void;
  onApply(value: ReportDateRange): void;
}) {
  const [errors, setErrors] = useState<
    Partial<Record<keyof ReportDateRange, string>>
  >({});
  const timer = useRef<number | undefined>(undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function validate() {
    const data = new FormData(form.current!);
    const result = reportDateRangeSchema.safeParse({
      fromDay: data.get('fromDay'),
      throughDay: data.get('throughDay'),
    });
    setErrors(
      result.success
        ? {}
        : Object.fromEntries(
            result.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
    );
    return result;
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.clearTimeout(timer.current);
    const result = validate();
    if (!result.success) {
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    onApply(result.data);
  }
  return (
    <form
      ref={form}
      noValidate
      onSubmit={apply}
      className="grid w-fit max-w-full min-w-0 items-end gap-x-0 gap-y-4 sm:grid-cols-[10.5rem_10.5rem] lg:justify-self-end lg:grid-cols-[10.5rem_10.5rem_auto]"
      onChange={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(validate, 300);
      }}
      onBlur={() => {
        window.clearTimeout(timer.current);
        validate();
      }}
    >
      <TextField
        name="fromDay"
        type="date"
        required
        label="From (PH, inclusive)"
        containerClassName="w-full max-w-[10.5rem]"
        className="max-w-[10rem]"
        value={value.fromDay}
        onChange={(event) =>
          onChange({ ...value, fromDay: event.target.value })
        }
        error={errors.fromDay}
      />
      <TextField
        name="throughDay"
        type="date"
        required
        label="Through (PH, inclusive)"
        containerClassName="w-full max-w-[10.5rem]"
        className="max-w-[10rem]"
        value={value.throughDay}
        onChange={(event) =>
          onChange({ ...value, throughDay: event.target.value })
        }
        error={errors.throughDay}
      />
      <div className="flex items-center sm:col-span-2 lg:col-span-1">
        <button type="submit" className={buttonStyles({ variant: 'accent' })}>
          Apply period
        </button>
      </div>
    </form>
  );
}
