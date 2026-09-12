export function trimRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
}

export function normalizeOptionalSku({ value }: { value: unknown }): unknown {
  const trimmed = trimOptionalString({ value });
  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}

export function trimNullableString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

export function normalizeNullableSku({ value }: { value: unknown }): unknown {
  const trimmed = trimNullableString({ value });
  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}
