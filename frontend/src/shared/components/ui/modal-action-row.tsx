import { cloneElement, isValidElement, type ReactNode } from 'react';

export function ModalActionRow({
  feedback,
  children,
  className = '',
}: {
  feedback?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const feedbackElement = isValidElement<{ className?: string }>(feedback)
    ? cloneElement(feedback, {
        className: `min-w-0 flex-1 ${feedback.props.className ?? ''}`,
      })
    : feedback;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5 ${className}`}
    >
      {feedbackElement}
      <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-3 self-end">
        {children}
      </div>
    </div>
  );
}
