"use client";

type Props = {
  onCompleteStep: () => void;
  onOpenAllTools: () => void;
  completeDisabled: boolean;
  showToolsButton: boolean;
  isLastStep: boolean;
};

export function StickyActionBar({
  onCompleteStep,
  onOpenAllTools,
  completeDisabled,
  showToolsButton,
  isLastStep,
}: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      role="toolbar"
      aria-label="Onderzoeksacties"
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-gray-200 bg-[var(--card-bg)]/95 p-3 shadow-lg backdrop-blur-md dark:border-[var(--card-border)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {showToolsButton ? (
            <button
              type="button"
              onClick={onOpenAllTools}
              className="order-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--card-bg-hover)] dark:border-[var(--card-border)] sm:order-1 sm:py-2.5"
            >
              Open alle tools
            </button>
          ) : null}
          <button
            type="button"
            disabled={completeDisabled}
            onClick={onCompleteStep}
            className={
              "order-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition sm:order-2 sm:min-w-[10rem] sm:py-2.5 " +
              (completeDisabled
                ? "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                : "bg-blue-600 shadow-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500")
            }
          >
            {isLastStep ? "Afronden" : "Voltooi stap"}
          </button>
        </div>
      </div>
    </div>
  );
}
