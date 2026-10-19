'use client';

import {
  DateRangePicker,
  type DateRangePickerValue,
} from '@/shared/components/ui/date-range-picker';
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
  return (
    <DateRangePicker
      id="report-date-filter"
      value={value}
      onChange={(next: DateRangePickerValue) => onChange(next)}
      onApply={(next: DateRangePickerValue) => onApply(next)}
      onClear={() => onChange({ fromDay: '', throughDay: '' })}
      label="Report dates (PH)"
      filterLabel="Report date filter"
      dialogLabel="Choose report dates"
      applyLabel="Apply period"
      align="end"
      validate={(next: DateRangePickerValue) => {
        const result = reportDateRangeSchema.safeParse(next);
        return result.success ? undefined : result.error.issues[0]?.message;
      }}
      className="w-full max-w-[20rem] lg:justify-self-end"
    />
  );
}
