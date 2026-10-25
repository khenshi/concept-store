'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import type {
  ActiveSession,
  ActiveSessionPage,
} from '@/features/auth/model/auth.schemas';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';

function SessionDate({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}

export function ActiveSessionsPanel({
  className = '',
}: {
  className?: string;
}) {
  const { listSessions, revokeSession } = useAuth();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ActiveSessionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActiveSession | null>(null);
  const [pending, setPending] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) feedbackRef.current?.focus();
  }, [message]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setData(null);
      setError(null);
      try {
        const result = await listSessions(page);
        if (!active) return;
        if (page > Math.max(1, result.totalPages)) {
          setPage(Math.max(1, result.totalPages));
          return;
        }
        setData(result);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sessions could not be loaded. Please try again.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [listSessions, page, revision]);

  async function confirmRevoke() {
    if (!selected || pending) return;
    setPending(true);
    setRevokeError(null);
    try {
      await revokeSession(selected.id, selected.isCurrent);
      setSelected(null);
      if (!selected.isCurrent) {
        setMessage('The selected session has been signed out.');
        setRevision((value) => value + 1);
      }
    } catch (cause) {
      setRevokeError(
        cause instanceof ApiError
          ? cause.message
          : 'The session could not be signed out. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <OperationalPanel
        variant="open"
        className={className}
        title="Active sessions"
        description="Review your account’s active sign-ins. Sign out a session you no longer use."
      >
        <div
          ref={feedbackRef}
          role="group"
          aria-label="Session management"
          tabIndex={-1}
          className="grid gap-4 pb-4 outline-none"
          aria-busy={loading}
        >
          {message ? <Notice>{message}</Notice> : null}
          {loading ? (
            <ListSkeleton label="Loading active sessions" />
          ) : error ? (
            <>
              <Notice tone="error">{error}</Notice>
              <Button
                variant="secondary"
                className="w-fit"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </>
          ) : data ? (
            <>
              {data.items.length === 0 ? (
                <p className="py-4 text-sm text-muted">
                  No active sessions to display. Refresh the list to check
                  again.
                </p>
              ) : (
                <ul aria-label="Active sessions" className="grid gap-5">
                  {data.items.map((session, index) => (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 text-sm">
                        <h3 className="font-semibold text-ink">
                          {session.isCurrent
                            ? 'Current session'
                            : `Session ${(data.page - 1) * 15 + index + 1}`}
                        </h3>
                        <p className="mt-1 text-muted">
                          Created <SessionDate value={session.createdAt} />
                        </p>
                        <p className="text-muted">
                          Expires <SessionDate value={session.expiresAt} />
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        aria-label={
                          session.isCurrent
                            ? 'Sign out current session'
                            : `Sign out session ${(data.page - 1) * 15 + index + 1}`
                        }
                        onClick={(event) => {
                          triggerRef.current = event.currentTarget;
                          setMessage(null);
                          setRevokeError(null);
                          setSelected(session);
                        }}
                      >
                        Sign out
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <PaginationControls
                ariaLabel="Active sessions pagination"
                currentPage={data.page}
                totalPages={data.totalPages}
                hasNext={data.page < data.totalPages}
                summary={`${data.total} active ${data.total === 1 ? 'session' : 'sessions'}`}
                onPrevious={() => setPage((value) => Math.max(1, value - 1))}
                onNext={() => setPage((value) => value + 1)}
              />
              <Button
                variant="quiet"
                className="w-fit"
                onClick={() => setRevision((value) => value + 1)}
              >
                Refresh sessions
              </Button>
            </>
          ) : null}
        </div>
      </OperationalPanel>
      {selected ? (
        <FormDialog
          role="alertdialog"
          title={
            selected.isCurrent
              ? 'Sign out of this session?'
              : 'Sign out this session?'
          }
          description={
            selected.isCurrent
              ? 'You will return to sign in. Finish any work in progress before continuing. This does not cancel submitted transactions.'
              : 'This sign-in will lose access on its next request. Any work already submitted may still complete.'
          }
          size="confirmation"
          initialFocusRef={cancelRef}
          returnFocusRef={triggerRef}
          pending={pending}
          dismissOnBackdrop={false}
          onClose={() => {
            if (!pending) setSelected(null);
          }}
        >
          <div className="mt-5 grid gap-5">
            <p className="text-sm text-muted">
              Created <SessionDate value={selected.createdAt} />
            </p>
            <ModalActionRow
              feedback={
                revokeError ? (
                  <p role="alert" className="text-sm text-danger">
                    {revokeError}
                  </p>
                ) : null
              }
            >
              <Button
                ref={cancelRef}
                variant="quiet"
                disabled={pending}
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                pending={pending}
                pendingLabel="Signing out…"
                onClick={() => void confirmRevoke()}
              >
                Sign out session
              </Button>
            </ModalActionRow>
          </div>
        </FormDialog>
      ) : null}
    </>
  );
}
