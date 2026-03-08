interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-700/40 bg-red-950/20 p-4">
      <p className="font-dm text-sm text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-dm text-sm text-red-200"
        >
          Retry
        </button>
      )}
    </div>
  );
}
