interface ProgressBarProps {
  current: number;
  total: number;
  currentStatus?: string;
}

export function ProgressBar({ current, total, currentStatus }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
        <span className="text-sm font-medium text-gray-900">Loading conversations...</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-700">
          <span>
            Chunk {current} of {total}
          </span>
          <span className="font-medium">{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {currentStatus && (
          <div className="flex items-center gap-2 mt-2">
            {currentStatus.includes('Failed') || currentStatus.includes('Error') ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {currentStatus}
              </span>
            ) : currentStatus.includes('Completed') ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {currentStatus}
              </span>
            ) : (
              <span className="text-xs text-gray-600">{currentStatus}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

