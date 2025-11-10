import { useCallback, useState } from 'react';
import { getApiBaseUrl } from '../lib/api';
import type { Message } from '../lib/types';

interface UseContextDataReturn {
  contextData: Record<string, unknown> | null;
  contextLoading: boolean;
  contextError: string;
  showContextPopup: boolean;
  setShowContextPopup: (show: boolean) => void;
  fetchContextData: (threadId: string, selectedThreadMessages?: Message[]) => Promise<void>;
  searchContextKeys: (obj: unknown, keys: string[]) => unknown;
  displayContextValue: (val: unknown) => string;
  getAllKeys: (obj: unknown, depth?: number, prefix?: string) => string[];
}

export function useContextData(apiKey: string): UseContextDataReturn {
  const [contextData, setContextData] = useState<Record<string, unknown> | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string>('');
  const [showContextPopup, setShowContextPopup] = useState(false);

  const fetchContextData = useCallback(
    async (threadId: string, selectedThreadMessages?: Message[]) => {
      if (!threadId || !apiKey.trim()) {
        setContextError('Thread ID and API key are required');
        return;
      }

      setContextLoading(true);
      setContextError('');

      try {
        const baseUrl = getApiBaseUrl();

        const response = await fetch(`${baseUrl}/attributes/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            threads: [{ threadId }],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Extract actual context data from response
        let contextToStore: Record<string, unknown> = data;

        // Handle the nested response structure: response.data.results[0].attributes
        if (
          data?.data?.results &&
          Array.isArray(data.data.results) &&
          data.data.results.length > 0
        ) {
          const firstResult = data.data.results[0];
          if (firstResult?.attributes) {
            contextToStore = firstResult.attributes;

            // If there's a PageContext field, try to extract the structured JSON from it
            if (contextToStore.PageContext && typeof contextToStore.PageContext === 'string') {
              try {
                // Try format 1: <structured>{...JSON...}</structured>
                let structuredJson = null;
                const structuredMatch = contextToStore.PageContext.match(
                  /<structured>(.*?)<\/structured>/
                );
                if (structuredMatch?.[1]) {
                  structuredJson = JSON.parse(structuredMatch[1]);
                } else {
                  // Try format 2: JSON object directly embedded in the string
                  const jsonMatch = contextToStore.PageContext.match(/\{[\s\S]*\}$/);
                  if (jsonMatch) {
                    try {
                      structuredJson = JSON.parse(jsonMatch[0]);
                    } catch {
                      // If that fails, try to find any JSON object in the string
                      const anyJsonMatch = contextToStore.PageContext.match(/\{[\s\S]*?\}/);
                      if (anyJsonMatch) {
                        structuredJson = JSON.parse(anyJsonMatch[0]);
                      }
                    }
                  }
                }

                // Merge structured data with other attributes if found
                if (structuredJson) {
                  contextToStore = { ...contextToStore, ...structuredJson };
                }
              } catch {
                // If parsing fails, keep the original attributes
              }
            }
          }
        } else if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
          // Fallback: try direct results (in case API response structure differs)
          const firstResult = data.results[0];
          if (firstResult?.attributes) {
            contextToStore = firstResult.attributes;
          }
        }

        // Also try to extract from messages if it's a thread context response
        if (!contextToStore || Object.keys(contextToStore).length === 0) {
          // Try to find context in system/status messages
          const systemMessages =
            selectedThreadMessages?.filter((m) => m.role === 'system' || m.role === 'status') || [];
          if (systemMessages.length > 0) {
            const contextFromMessages: Record<string, unknown> = {};
            systemMessages.forEach((msg) => {
              if (msg.content && Array.isArray(msg.content)) {
                msg.content.forEach((c) => {
                  if (c.content && typeof c.content === 'string') {
                    try {
                      const parsed = JSON.parse(c.content);
                      Object.assign(contextFromMessages, parsed);
                    } catch {
                      // Not JSON, skip
                    }
                  }
                });
              }
            });

            if (Object.keys(contextFromMessages).length > 0) {
              contextToStore = contextFromMessages;
            }
          }
        }

        setContextData(contextToStore);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setContextError(`Failed to fetch context: ${errorMessage}`);
      } finally {
        setContextLoading(false);
      }
    },
    [apiKey]
  );

  const searchContextKeys = useCallback((obj: unknown, keys: string[]): unknown => {
    if (!obj) return null;
    const keySet = new Set(keys.map((k) => k.toLowerCase()));
    const visit = (node: unknown, depth = 0): unknown => {
      if (node == null || depth > 10) return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const v = visit(item, depth + 1);
          if (v != null && v !== '') return v;
        }
        return null;
      }
      if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (keySet.has(String(k).toLowerCase())) {
            if (v != null && v !== '') return v;
          }
          const inner = visit(v, depth + 1);
          if (inner != null && inner !== '') return inner;
        }
      }
      return null;
    };
    return visit(obj);
  }, []);

  const displayContextValue = useCallback((val: unknown): string => {
    return val === null || val === undefined || val === '' ? 'N/A' : String(val);
  }, []);

  const getAllKeys = useCallback((obj: unknown, depth = 0, prefix = ''): string[] => {
    if (!obj || depth > 5) return [];
    if (Array.isArray(obj)) {
      return obj.flatMap((item, i) => getAllKeys(item, depth + 1, `${prefix}[${i}]`));
    }
    if (typeof obj === 'object') {
      return Object.entries(obj).flatMap(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        return [key, ...getAllKeys(v, depth + 1, key)];
      });
    }
    return [];
  }, []);

  return {
    contextData,
    contextLoading,
    contextError,
    showContextPopup,
    setShowContextPopup,
    fetchContextData,
    searchContextKeys,
    displayContextValue,
    getAllKeys,
  };
}
