/**
 * Bulk actions component for thread selection and operations
 */

import { Zap } from 'lucide-react';
import type { BulkResults } from '../../lib/threadTypes';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface BulkActionsProps {
  selectedCount: number;
  onFetchAttributes: () => void;
  bulkLoading: boolean;
  bulkResults: BulkResults | null;
  bulkError: string | null;
}

export function BulkActions({
  selectedCount,
  onFetchAttributes,
  bulkLoading,
  bulkResults,
  bulkError,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Card className="mb-6 bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Zap className="h-5 w-5" />
          Bulk Actions ({selectedCount} selected)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onFetchAttributes} disabled={bulkLoading} className="w-full md:w-auto">
          {bulkLoading ? 'Fetching Attributes...' : 'Fetch Attributes (Bulk)'}
        </Button>

        {bulkError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {bulkError}
          </div>
        )}

        {bulkResults && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Results:</div>

            {bulkResults.results.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="text-sm font-medium text-green-800 mb-2">
                  Success ({bulkResults.results.length}):
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {bulkResults.results.map((result, idx) => (
                    <div key={idx} className="text-xs text-green-700">
                      {result.threadId.threadId} - {result.meta.status}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bulkResults.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-sm font-medium text-red-800 mb-2">
                  Errors ({bulkResults.errors.length}):
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {bulkResults.errors.map((error, idx) => (
                    <div key={idx} className="text-xs text-red-700">
                      {error.threadId.threadId} - {error.code}: {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
