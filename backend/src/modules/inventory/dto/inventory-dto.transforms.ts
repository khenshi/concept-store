import type { TransformFnParams } from 'class-transformer';

export function trimOptionalString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function trimRequiredString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
