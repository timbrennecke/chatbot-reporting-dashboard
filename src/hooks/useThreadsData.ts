/**
 * Hook for fetching and managing threads data
 */

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { ChunkStatus, LoadingProgress } from '../lib/threadTypes';
import type { Thread } from '../lib/types';
import { generateDateChunks } from '../utils/statisticsUtils';

interface UseThreadsDataProps {
  uploadedThreads?: Thread[];
  onThreadsChange?: (threads: Thread[]) => void;
}

interface UseThreadsDataReturn {
  threads: Thread[];
  setThreads: (threads: Thread[]) => void;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadingProgress: LoadingProgress;
  chunkStatuses: ChunkStatus[];
  finalChunkStatuses: ChunkStatus[];
  hasSearched: boolean;
  lastSearchDates: { startDate: string; endDate: string } | null;
  fetchThreads: (startDate: string, endDate: string) => Promise<void>;
  buttonClicked: boolean;
  currentChunkStatuses: ChunkStatus[];
}

export function useThreadsData({
  uploadedThreads,
  onThreadsChange,
}: UseThreadsDataProps): UseThreadsDataReturn {
  const [threads, setThreads] = useState<Thread[]>(() => {
    if (uploadedThreads && uploadedThreads.length > 0) {
      return uploadedThreads;
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    current: 0,
    total: 0,
    currentDate: '',
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchDates, setLastSearchDates] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [chunkStatuses, setChunkStatuses] = useState<ChunkStatus[]>([]);
  const [finalChunkStatuses, setFinalChunkStatuses] = useState<ChunkStatus[]>([]);

  // Update threads when uploaded data changes
  useEffect(() => {
    if (uploadedThreads && uploadedThreads.length > 0) {
      setThreads(uploadedThreads);
      setError(null);
      setHasSearched(true);
    }
  }, [uploadedThreads?.length, uploadedThreads]);

  // Set hasSearched when threads are loaded
  useEffect(() => {
    if (threads.length > 0 && !uploadedThreads?.length && !hasSearched) {
      setHasSearched(true);
    }
  }, [threads.length, uploadedThreads?.length, hasSearched]);

  // Notify parent when threads change
  useEffect(() => {
    if (onThreadsChange) {
      onThreadsChange(threads);
    }
  }, [threads, onThreadsChange]);

  const fetchThreads = useCallback(async (startDate: string, endDate: string) => {
    console.log('🔍 fetchThreads called with:', { startDate, endDate });

    if (!startDate || !endDate) {
      console.log('❌ Missing dates');
      setError('Please select both start and end dates');
      return;
    }

    console.log('✅ Starting fetch...');
    setLoading(true);
    setButtonClicked(true);
    setError(null);
    setLoadingProgress({ current: 0, total: 0, currentDate: '' });
    setChunkStatuses([]);
    setThreads([]); // Clear existing threads while fetching

    try {
      let startDateTime = new Date(startDate);
      let endDateTime = new Date(endDate);
      console.log('📅 Parsed dates:', { startDateTime, endDateTime });

      // Handle datetime-local format (which doesn't include timezone info)
      // Add timezone offset to ensure correct date range
      if (startDate.includes('T')) {
        // This is datetime-local, parse it as local time
        const [datePart, timePart] = startDate.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        startDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }

      if (endDate.includes('T')) {
        const [datePart, timePart] = endDate.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        endDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }

      if (startDateTime >= endDateTime) {
        throw new Error('Start date must be before end date');
      }

      // Generate date chunks (same as Statistics - creates multiple time-based chunks)
      const dateChunks = generateDateChunks(startDateTime, endDateTime);

      console.log(`📦 Split into ${dateChunks.length} chunks`);
      setLoadingProgress({ current: 0, total: dateChunks.length, currentDate: '' });

      const allThreads: Thread[] = [];
      const statuses: ChunkStatus[] = [];

      for (let i = 0; i < dateChunks.length; i++) {
        const chunk = dateChunks[i];
        const dateStr = chunk.dateStr;

        console.log(`📡 Fetching chunk ${i + 1}/${dateChunks.length} for ${dateStr}`);

        setLoadingProgress({
          current: i + 1,
          total: dateChunks.length,
          currentDate: dateStr,
        });

        try {
          const response = await api.getThreads({
            startTimestamp: chunk.start.toISOString(),
            endTimestamp: chunk.end.toISOString(),
          });
          console.log(`✅ Chunk ${i + 1} response:`, response);

          const threadsData = response.threads.map((t: { thread: Thread }) => t.thread);
          allThreads.push(...threadsData);

          statuses.push({
            chunk: i + 1,
            status: '200',
            date: dateStr,
          });
        } catch (chunkError) {
          statuses.push({
            chunk: i + 1,
            status: '500',
            date: dateStr,
          });
        }

        setChunkStatuses([...statuses]);
      }

      console.log(`🎉 Fetch complete! Found ${allThreads.length} threads`);
      setThreads(allThreads);
      setFinalChunkStatuses(statuses);
      setHasSearched(true);
      setLastSearchDates({ startDate, endDate });

      if (allThreads.length === 0) {
        console.log('⚠️ No threads found');
        setError('No threads found in the selected date range');
      }
    } catch (err) {
      console.error('❌ Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch threads';
      setError(errorMessage);
    } finally {
      console.log('🏁 Fetch finished');
      setLoading(false);
    }
  }, []);

  return {
    threads,
    setThreads,
    loading,
    error,
    setError,
    loadingProgress,
    chunkStatuses,
    finalChunkStatuses,
    hasSearched,
    lastSearchDates,
    fetchThreads,
    buttonClicked,
    currentChunkStatuses: chunkStatuses,
  };
}
