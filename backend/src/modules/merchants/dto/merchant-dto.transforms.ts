export function trimRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeEmail({ value }: { value: unknown }): unknown {
  const trimmed = trimRequiredString({ value });
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

export function normalizeOptionalCode({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toUpperCase() : undefined;
}

export function normalizeNullableCode({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toUpperCase() : null;
}

export function trimOptionalSearch({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
