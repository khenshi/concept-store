'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  listCommandRecoveries,
  type CommandRecovery,
  type CommandRecoveryKind,
} from '../api/command-recovery-api';

export function useCommandRecoveries(
  request: AuthenticatedRequest,
  organizationId: string,
  kind: CommandRecoveryKind,
  enabled = true,
) {
  const [items, setItems] = useState<CommandRecovery[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    if (!enabled) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setItems([]);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        const result = await listCommandRecoveries(
          request,
          organizationId,
          kind,
        );
        if (active) setItems(result);
      } catch {
        if (active) {
          setItems([]);
          setError('Saved command outcomes could not be loaded.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, kind, organizationId, request, revision]);
  return { items, loading, error, refresh };
}
