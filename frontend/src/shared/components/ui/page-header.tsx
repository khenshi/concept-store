'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { RequestError } from './request-error';

type PageHeaderError = {
  message: string;
  onRetry(): void;
};

const PageHeaderErrorContext = createContext<Dispatch<
  SetStateAction<PageHeaderError | null>
> | null>(null);

export function usePageHeaderRequestError(
  message: string | null,
  onRetry: () => void,
) {
  const setPageHeaderError = useContext(PageHeaderErrorContext);

  useEffect(() => {
    if (!setPageHeaderError) return;
    setPageHeaderError(message ? { message, onRetry } : null);
    return () => setPageHeaderError(null);
  }, [message, onRetry, setPageHeaderError]);

  return Boolean(setPageHeaderError);
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  id,
  className = '',
}: {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  const [pageHeaderError, setPageHeaderError] =
    useState<PageHeaderError | null>(null);

  return (
    <PageHeaderErrorContext.Provider value={setPageHeaderError}>
      <header
        className={`${
          action
            ? 'grid grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] max-sm:grid-cols-1'
            : 'grid grid-cols-1'
        } items-start gap-6 border-b border-hairline pb-10 ${className}`}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-3 break-words text-xs font-medium text-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1 id={id} className="text-page break-words font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {action ? <div className="min-w-0 max-sm:w-full">{action}</div> : null}
        {pageHeaderError ? (
          <RequestError
            message={pageHeaderError.message}
            onRetry={pageHeaderError.onRetry}
            className="col-span-full w-full"
          />
        ) : null}
      </header>
    </PageHeaderErrorContext.Provider>
  );
}
