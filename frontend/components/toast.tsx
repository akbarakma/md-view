"use client";

type ToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Toast({ message, actionLabel, onAction }: ToastProps) {
  const hasAction = Boolean(actionLabel && onAction);
  return (
    <div
      role="status"
      className={`fixed bottom-20 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-3xl bg-ink text-[13px] text-paper shadow-lg md:bottom-5 ${
        hasAction ? "py-1.5 pl-5 pr-1.5" : "px-5 py-3.5"
      }`}
    >
      <span className="min-w-0">{message}</span>
      {hasAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-ember px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition-colors duration-150 ease-out hover:bg-ember-soft focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
