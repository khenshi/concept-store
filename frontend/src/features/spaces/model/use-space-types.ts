'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listSpaceTypes } from '../api/space-api';
import type { SpaceType } from './space.schemas';

export function useSpaceTypes(
  organizationId: string,
  revision = 0,
  enabled = true,
) {
  const { request } = useAuth();
  const [result, setResult] = useState<{
    types: SpaceType[] | null;
    error: string | null;
  }>({ types: null, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult({ types: null, error: null });
      try {
        const types = await listSpaceTypes(request, organizationId);
        if (active) setResult({ types, error: null });
      } catch (cause) {
        if (active)
          setResult({
            types: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'Space types could not be loaded.',
          });
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, retry, revision, enabled]);
  return { ...result, reload: () => setRetry((value) => value + 1) };
}
