import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onFetch: () => void;
  isLoading: boolean;
  error: string | null;
  loadingProgress?: {
    current: number;
    total: number;
    currentDate: string;
  };
  chunkStatuses?: Array<{ chunk: number; status: string; date: string }>;
  fetchStartTime?: Date | null;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onFetch,
  isLoading,
  error,
  loadingProgress,
  chunkStatuses = [],
  fetchStartTime,
}: DateRangeFilterProps) {
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value ? new Date(e.target.value) : null;
    if (newDate) {
      newDate.setHours(0, 0, 0, 0);
      onStartDateChange(newDate);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value ? new Date(e.target.value) : null;
    if (newDate) {
      newDate.setHours(23, 59, 59, 999);
      onEndDateChange(newDate);
    }
  };

  const setPresetDateRange = (hours?: number, days?: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();

    if (hours) {
      start.setHours(start.getHours() - hours);
    } else if (days !== undefined) {
      if (days === 0) {
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
      }
    }

    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <div className="space-y-4">
      {/* Date Selection Row */}
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <Label htmlFor="start-date" className="text-xs font-medium text-gray-600 block mb-2">
            Start Date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={formatDateForInput(startDate)}
            onChange={handleStartDateChange}
            disabled={isLoading}
            className="border-gray-300 focus:border-gray-900 focus:ring-gray-900 h-9 text-sm"
          />
        </div>

        <div className="flex-1 max-w-xs">
          <Label htmlFor="end-date" className="text-xs font-medium text-gray-600 block mb-2">
            End Date
          </Label>
          <Input
            id="end-date"
            type="date"
            value={formatDateForInput(endDate)}
            onChange={handleEndDateChange}
            disabled={isLoading}
            className="border-gray-300 focus:border-gray-900 focus:ring-gray-900 h-9 text-sm"
          />
        </div>

        <Button
          onClick={onFetch}
          disabled={!startDate || !endDate || isLoading}
          style={{ backgroundColor: '#000', color: '#fff' }}
          className="px-6 h-9 text-sm font-medium whitespace-nowrap !hover:bg-gray-800 !hover:shadow-lg !hover:scale-105 !transition-all !duration-200 !active:scale-95"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1f2937';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#000';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              Fetching...
            </>
          ) : (
            'Analyze'
          )}
        </Button>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setPresetDateRange(undefined, 0)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Today
        </Button>
        <Button
          onClick={() => setPresetDateRange(24)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Last 24h
        </Button>
        <Button
          onClick={() => setPresetDateRange(undefined, 3)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Last 3d
        </Button>
        <Button
          onClick={() => setPresetDateRange(undefined, 7)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Last 7d
        </Button>
        <Button
          onClick={() => setPresetDateRange(undefined, 14)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Last 14d
        </Button>
        <Button
          onClick={() => setPresetDateRange(undefined, 30)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-normal text-gray-600 border-gray-300"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.color = '#111827';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          Last 30d
        </Button>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          {/* Fetch Time and Chunk Summary */}
          {fetchStartTime && (
            <div className="text-xs text-gray-600 pb-2 border-b border-gray-200">
              <span>Started: {fetchStartTime.toLocaleTimeString()}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-900" />
            <span className="text-sm font-medium text-gray-900">
              Fetching conversations...
            </span>
          </div>
          
          {loadingProgress && loadingProgress.total > 0 && (
            <>
              {/* Progress Info */}
              <div className="flex justify-between text-xs text-gray-600">
                <span>Chunk {loadingProgress.current} of {loadingProgress.total}</span>
                <span className="font-semibold text-gray-900">
                  {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
                </span>
              </div>
              
              {/* Progress Bar - Visible styled bar */}
              <div 
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(1, Math.min(100, (loadingProgress.current / loadingProgress.total) * 100))}%`,
                    backgroundColor: '#111827',
                    borderRadius: '4px',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              
              {/* Current Chunk Status */}
              {loadingProgress.currentDate && (
                <div className="flex items-center gap-1.5 text-xs">
                  {loadingProgress.currentDate.includes('Failed') || 
                   loadingProgress.currentDate.includes('Error') || 
                   loadingProgress.currentDate.includes('✗') ||
                   loadingProgress.currentDate.includes('Timeout') ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                      <span className="text-red-700 font-medium">{loadingProgress.currentDate}</span>
                    </>
                  ) : loadingProgress.currentDate.includes('Success') || 
                     loadingProgress.currentDate.includes('✓') ||
                     loadingProgress.currentDate.includes('200') ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                      <span className="text-green-700 font-medium">{loadingProgress.currentDate}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse"></span>
                      <span className="text-gray-600">{loadingProgress.currentDate}</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Chunk Status Display */}
          {chunkStatuses.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-700 mb-2">Chunk Status Summary</div>
              <div className="flex flex-wrap gap-2">
                {chunkStatuses.map((chunk) => (
                  <div
                    key={chunk.chunk}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white rounded border text-xs"
                    style={{
                      borderColor: chunk.status === '200' ? '#10b981' : '#ef4444',
                      backgroundColor: chunk.status === '200' ? '#f0fdf4' : '#fef2f2',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: chunk.status === '200' ? '#10b981' : '#ef4444',
                      }}
                    />
                    <span style={{ color: chunk.status === '200' ? '#059669' : '#dc2626', fontWeight: 500 }}>
                      Chunk {chunk.chunk}: {chunk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
