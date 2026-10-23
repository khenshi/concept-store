'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Notice } from './notice';

export function FloatingNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss(): void;
}) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setClosing(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onDismiss, 200);
    return () => window.clearTimeout(timer);
  }, [closing, onDismiss]);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
      <div
        className={`pointer-events-auto w-full max-w-xl rounded-control bg-surface shadow-overlay ${closing ? 'inventory-notice-exit' : 'inventory-notice-enter'}`}
      >
        <Notice>
          <div className="flex items-center gap-4">
            <span>{message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="shrink-0 rounded-full p-2 text-muted hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
              onClick={() => setClosing(true)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </Notice>
      </div>
    </div>,
    document.body,
  );
}
