import type { TransformFnParams } from 'class-transformer';

export function trimRequiredString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeRequiredSku({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  const trimmed = typeof input === 'string' ? input.trim() : input;
  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}

export function normalizeNullableBarcode({
  value,
}: TransformFnParams): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function trimOptionalSearch({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
