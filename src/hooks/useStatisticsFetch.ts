import { useCallback, useState } from 'react';
import { getApiBaseUrl, getEnvironmentSpecificItem } from '../lib/api';
import type { ConversationData, DateChunk } from '../utils/statisticsUtils';
import { convertThreadToConversation, generateDateChunks } from '../utils/statisticsUtils';

interface FetchProgress {
  current: number;
  total: number;
  currentDate: string;
}

interface ChunkResult {
  conversations: ConversationData[];
  index: number;
  chunk: DateChunk;
  error?: string;
  status?: string;
  statusCode?: number;
}

export interface ChunkStatus {
  chunk: number;
  status: string;
  date: string;
}

export function useStatisticsFetch() {
  const [fetchedConversations, setFetchedConversations] = useState<ConversationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchKey, setLastSearchKey] = useState<string>('');
  const [chunkStatuses, setChunkStatuses] = useState<ChunkStatus[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<FetchProgress>({
    current: 0,
    total: 0,
    currentDate: '',
  });

  const fetchConversationsForStats = useCallback(
    async (startDate: Date | null, endDate: Date | null) => {
      if (!startDate || !endDate) {
        setError('Please select start and end dates');
        return;
      }

      // Create cache key
      const searchKey = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

      // Check if we already have this data cached
      if (searchKey === lastSearchKey && fetchedConversations.length > 0) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const apiKey = await getEnvironmentSpecificItem('chatbot-dashboard-api-key');
        if (!apiKey?.trim()) {
          throw new Error('API key is required');
        }

        const apiBaseUrl = getApiBaseUrl();
        const chunks = generateDateChunks(startDate, endDate);

        setLoadingProgress({ current: 0, total: chunks.length, currentDate: '' });
        let completedChunks = 0;

        // Function to process a single chunk
        const processChunk = async (chunk: DateChunk, index: number): Promise<ChunkResult> => {
          try {
            const response = await fetch(`${apiBaseUrl}/thread`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey.trim()}`,
              },
              body: JSON.stringify({
                startTimestamp: chunk.start.toISOString(),
                endTimestamp: chunk.end.toISOString(),
                limit: 10000,
              }),
            });

            if (!response.ok) {
              completedChunks++;
              setLoadingProgress({
                current: completedChunks,
                total: chunks.length,
                currentDate: `Failed: ${chunk.dateStr}`,
              });
              return { conversations: [], index, chunk, statusCode: response.status, status: response.status.toString() };
            }

            const chunkData = await response.json();
            const chunkThreads =
              chunkData.threads?.map((item: { thread: unknown }) => item.thread) || [];

            // Convert to conversation-like objects
            const chunkConversations = chunkThreads.map(convertThreadToConversation);

            completedChunks++;
            setLoadingProgress({
              current: completedChunks,
              total: chunks.length,
              currentDate: `Completed: ${chunk.dateStr}`,
            });

            return { conversations: chunkConversations, index, chunk, statusCode: 200, status: '200' };
          } catch (chunkError) {
            const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown error';
            const isTimeout = errorMessage.includes('504') || errorMessage.includes('timeout');

            completedChunks++;
            setLoadingProgress({
              current: completedChunks,
              total: chunks.length,
              currentDate: `⚠️ ${isTimeout ? 'Timeout' : 'Error'}: ${chunk.dateStr}`,
            });
            return { conversations: [], index, chunk, error: errorMessage, statusCode: isTimeout ? 504 : 500, status: isTimeout ? '504' : '500' };
          }
        };

        // Process chunks sequentially
        const results: ChunkResult[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const result = await processChunk(chunk, i);
          results.push(result);

          // Small delay between requests
          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Sort results by original index and collect all conversations
        results.sort((a, b) => a.index - b.index);

        const allConversations: ConversationData[] = [];
        const statusList: ChunkStatus[] = [];
        
        results.forEach((result, idx) => {
          allConversations.push(...result.conversations);
          
          // Collect chunk status - must match ChunkStatusModal format exactly
          statusList.push({
            chunk: idx + 1,
            status: result.status || 'Unknown',
            date: result.chunk.dateStr,
          });
        });

        setLoadingProgress({ current: 0, total: 0, currentDate: '' });
        setFetchedConversations(allConversations);
        setChunkStatuses(statusList);
        setLastSearchKey(searchKey);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error ? fetchError.message : 'Failed to fetch conversations'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [lastSearchKey, fetchedConversations.length]
  );

  return {
    fetchedConversations,
    isLoading,
    error,
    loadingProgress,
    chunkStatuses,
    fetchConversationsForStats,
  };
}
