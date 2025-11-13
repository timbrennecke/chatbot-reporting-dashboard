/**
 * Hook for bulk operations on threads (e.g., bulk attribute fetching)
 */

import { useCallback, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { BulkResults } from '../lib/threadTypes';
import type { BulkAttributesRequest } from '../lib/types';

interface UseBulkOperationsReturn {
  bulkLoading: boolean;
  bulkResults: BulkResults | null;
  bulkError: string | null;
  fetchBulkAttributes: (threadIds: string[]) => Promise<void>;
  clearBulkResults: () => void;
}

export function useBulkOperations(): UseBulkOperationsReturn {
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResults | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const fetchBulkAttributes = useCallback(async (threadIds: string[]) => {
    if (threadIds.length === 0) {
      setBulkError('No threads selected');
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    setBulkResults(null);

    try {
      const request: BulkAttributesRequest = {
        threads: threadIds.map((id) => ({ threadId: id })),
      };

      const response = await api.bulkAttributeThreads(request);
      setBulkResults(response);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : 'Failed to fetch bulk attributes';
      setBulkError(errorMessage);
    } finally {
      setBulkLoading(false);
    }
  }, []);

  const clearBulkResults = useCallback(() => {
    setBulkResults(null);
    setBulkError(null);
  }, []);

  return {
    bulkLoading,
    bulkResults,
    bulkError,
    fetchBulkAttributes,
    clearBulkResults,
  };
}
