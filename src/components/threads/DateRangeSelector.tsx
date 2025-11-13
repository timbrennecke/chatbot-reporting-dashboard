/**
 * Date range selector with quick filters for thread search
 */

import { Calendar, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onFetch: () => void;
  loading: boolean;
  error: string | null;
  activeQuickFilter: number | null;
  onQuickFilterClick: (hours: number) => void;
  loadingProgress?: {
    current: number;
    total: number;
    currentDate?: string;
  };
  chunkStatuses?: Array<{ chunk: number; status: string; date: string }>;
}

const QUICK_FILTERS = [
  { label: 'Last Hour', hours: 1 },
  { label: 'Last 24 Hours', hours: 24 },
  { label: 'Last 3 Days', hours: 72 },
  { label: 'Last 7 Days', hours: 168 },
];

export function DateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onFetch,
  loading,
  error,
  activeQuickFilter,
  onQuickFilterClick,
  loadingProgress,
  chunkStatuses = [],
}: DateRangeSelectorProps) {
  const [showChunkStatus, setShowChunkStatus] = useState(false);

  return (
    <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-medium text-gray-900">Search Threads</h2>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_FILTERS.map((filter) => (
          <Button
            key={filter.hours}
            variant={activeQuickFilter === filter.hours ? 'default' : 'outline'}
            size="sm"
            onClick={() => onQuickFilterClick(filter.hours)}
            disabled={loading}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Date Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date & Time</Label>
          <Input
            id="start-date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-date">End Date & Time</Label>
          <Input
            id="end-date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label className="invisible">Action</Label>
          <div className="flex gap-2">
            <Button onClick={onFetch} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search Threads'
              )}
            </Button>
            {chunkStatuses.length > 0 && (
              <button
                onClick={() => setShowChunkStatus(true)}
                className="px-4 h-10 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md border border-gray-300"
                style={{ 
                  backgroundColor: 'transparent',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                Chunk Status ({chunkStatuses.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Progress Bar */}
      {loading && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <div style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              border: '3px solid #d1d5db',
              borderTop: '3px solid #111827',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
            >
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
            <span className="text-sm font-medium text-gray-900">
              Searching threads...
            </span>
          </div>
          
          {loadingProgress && loadingProgress.total > 0 && (
            <>
              {/* Progress Info */}
              <div className="flex justify-between text-xs text-gray-600">
                <span>Batch {loadingProgress.current} of {loadingProgress.total}</span>
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

              {/* Current Status */}
              {loadingProgress.currentDate && (
                <div className="flex items-center gap-1.5 text-xs">
                  {loadingProgress.currentDate.includes('Failed') || 
                   loadingProgress.currentDate.includes('Error') ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                      <span className="text-red-700 font-medium">{loadingProgress.currentDate}</span>
                    </>
                  ) : loadingProgress.currentDate.includes('Success') || 
                     loadingProgress.currentDate.includes('✓') ? (
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

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Chunk Status Modal */}
      {showChunkStatus && (
        <button
          type="button"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => setShowChunkStatus(false)}
        >
          <div
            role="dialog"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Chunk Status Summary
              </h3>
              <button
                type="button"
                onClick={() => setShowChunkStatus(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: '#6b7280',
                  borderRadius: '4px',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {chunkStatuses.map((chunk) => (
                  <div
                    key={chunk.chunk}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      backgroundColor: chunk.status === '200' ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${chunk.status === '200' ? '#10b981' : '#ef4444'}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: chunk.status === '200' ? '#10b981' : '#ef4444',
                      }}
                    />
                    <span style={{ color: chunk.status === '200' ? '#059669' : '#dc2626', fontWeight: 500 }}>
                      {chunk.date}: {chunk.status === '200' ? 'Success' : 'Failed'} ({chunk.status})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setShowChunkStatus(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
