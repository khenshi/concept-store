'use client';

import {
  DateRangePicker,
  type DateRangePickerValue,
} from '@/shared/components/ui/date-range-picker';
import {
  reportDateRangeSchema,
  reportPresets,
  type ReportPreset,
  type ReportDateRange,
} from '../model/report-dates';
import { SelectControl } from '@/shared/components/ui/select-control';

export function ReportDateFilter({
  value,
  onChange,
  onApply,
  preset = 'CUSTOM',
  onPresetChange,
}: {
  value: ReportDateRange;
  onChange(value: ReportDateRange): void;
  onApply(value: ReportDateRange): void;
  preset?: ReportPreset;
  onPresetChange?(value: ReportPreset): void;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-end gap-3 lg:w-[30rem]">
      {onPresetChange ? (
        <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
          Period
          <SelectControl
            value={preset}
            onValueChange={(next) => onPresetChange(next as ReportPreset)}
            className="text-sm font-normal"
          >
            {reportPresets.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectControl>
        </label>
      ) : null}
      {
        <DateRangePicker
          id="report-date-filter"
          value={value}
          onChange={(next: DateRangePickerValue) => {
            onPresetChange?.('CUSTOM');
            onChange(next);
          }}
          onApply={(next: DateRangePickerValue) => onApply(next)}
          onClear={() => {
            onPresetChange?.('CUSTOM');
            onChange({ fromDay: '', throughDay: '' });
          }}
          label="Report dates (PH)"
          filterLabel="Report date filter"
          dialogLabel="Choose report dates"
          applyLabel="Apply"
          align="end"
          validate={(next: DateRangePickerValue) => {
            const result = reportDateRangeSchema.safeParse(next);
            return result.success ? undefined : result.error.issues[0]?.message;
          }}
          className={`min-w-0 w-full ${!onPresetChange ? 'col-span-2' : ''}`}
        />
      }
    </div>
  );
}
