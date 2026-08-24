export function trimRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeRequiredCode({ value }: { value: unknown }): unknown {
  const trimmed = trimRequiredString({ value });
  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}

export function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function trimNullableString({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
