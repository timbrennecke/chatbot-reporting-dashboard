/**
 * Hook for managing thread selection (for bulk operations)
 */

import { useCallback, useState } from 'react';

interface UseThreadSelectionReturn {
  selectedThreads: Set<string>;
  toggleThreadSelection: (threadId: string) => void;
  toggleAllThreads: (threadIds: string[]) => void;
  clearSelection: () => void;
  isAllSelected: (threadIds: string[]) => boolean;
}

export function useThreadSelection(): UseThreadSelectionReturn {
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());

  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  }, []);

  const toggleAllThreads = useCallback((threadIds: string[]) => {
    setSelectedThreads((prev) => {
      const allSelected = threadIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(threadIds);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedThreads(new Set());
  }, []);

  const isAllSelected = useCallback(
    (threadIds: string[]) => {
      if (threadIds.length === 0) return false;
      return threadIds.every((id) => selectedThreads.has(id));
    },
    [selectedThreads]
  );

  return {
    selectedThreads,
    toggleThreadSelection,
    toggleAllThreads,
    clearSelection,
    isAllSelected,
  };
}
