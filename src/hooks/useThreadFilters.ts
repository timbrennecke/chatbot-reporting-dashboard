/**
 * Hook for managing thread filters and search
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';
import { categorizeThread } from '../lib/categorization';
import type { ThreadFilters } from '../lib/threadTypes';
import type { Thread } from '../lib/types';

interface UseThreadFiltersReturn extends ThreadFilters {
  setSearchTerm: (term: string) => void;
  setHasUiFilter: (enabled: boolean) => void;
  toggleTool: (tool: string) => void;
  toggleWorkflow: (workflow: string) => void;
  setShowErrorsOnly: (enabled: boolean) => void;
  setShowTimeoutsOnly: (enabled: boolean) => void;
  setSelectedTopic: (topic: string) => void;
  setMessageSearchEnabled: (enabled: boolean) => void;
  setMessageSearchTerm: (term: string) => void;
  toggleMessageRole: (role: 'user' | 'assistant') => void;
  setMinMessages: (value: number | '') => void;
  setMaxMessages: (value: number | '') => void;
  setMinDuration: (value: number | '') => void;
  setMaxDuration: (value: number | '') => void;
  setMinResponseTime: (value: number | '') => void;
  setMaxResponseTime: (value: number | '') => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
}

const INITIAL_FILTERS: ThreadFilters = {
  searchTerm: '',
  hasUiFilter: false,
  selectedTools: new Set(),
  selectedWorkflows: new Set(),
  showErrorsOnly: false,
  showTimeoutsOnly: false,
  selectedTopic: '',
  messageSearchEnabled: false,
  messageSearchTerm: '',
  messageRoles: new Set(['user', 'assistant']),
  minMessages: '',
  maxMessages: '',
  minDuration: '',
  maxDuration: '',
  minResponseTime: '',
  maxResponseTime: '',
};

export function useThreadFilters(): UseThreadFiltersReturn {
  const [filters, setFilters] = useState<ThreadFilters>(() => {
    // Load from storage on mount
    try {
      const savedSearchTerm = getEnvironmentSpecificItem('threads-search-term');
      if (
        savedSearchTerm &&
        typeof savedSearchTerm === 'string' &&
        !savedSearchTerm.includes('[object')
      ) {
        return { ...INITIAL_FILTERS, searchTerm: savedSearchTerm };
      }
    } catch {
      // Failed to load
    }
    return INITIAL_FILTERS;
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    setIsInitialLoad(false);
  }, []);

  // Save search term to storage
  useEffect(() => {
    if (isInitialLoad) return;

    try {
      if (filters.searchTerm && typeof filters.searchTerm === 'string') {
        setEnvironmentSpecificItem('threads-search-term', filters.searchTerm);
      } else if (filters.searchTerm === '') {
        setEnvironmentSpecificItem('threads-search-term', '');
      }
    } catch {
      // Failed to save
    }
  }, [filters.searchTerm, isInitialLoad]);

  const setSearchTerm = useCallback((term: string) => {
    setFilters((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  const setHasUiFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, hasUiFilter: enabled }));
  }, []);

  const toggleTool = useCallback((tool: string) => {
    setFilters((prev) => {
      const newTools = new Set(prev.selectedTools);
      if (newTools.has(tool)) {
        newTools.delete(tool);
      } else {
        newTools.add(tool);
      }
      return { ...prev, selectedTools: newTools };
    });
  }, []);

  const toggleWorkflow = useCallback((workflow: string) => {
    setFilters((prev) => {
      const newWorkflows = new Set(prev.selectedWorkflows);
      if (newWorkflows.has(workflow)) {
        newWorkflows.delete(workflow);
      } else {
        newWorkflows.add(workflow);
      }
      return { ...prev, selectedWorkflows: newWorkflows };
    });
  }, []);

  const setShowErrorsOnly = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, showErrorsOnly: enabled }));
  }, []);

  const setShowTimeoutsOnly = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, showTimeoutsOnly: enabled }));
  }, []);

  const setSelectedTopic = useCallback((topic: string) => {
    setFilters((prev) => ({ ...prev, selectedTopic: topic }));
  }, []);

  const setMessageSearchEnabled = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, messageSearchEnabled: enabled }));
  }, []);

  const setMessageSearchTerm = useCallback((term: string) => {
    setFilters((prev) => ({ ...prev, messageSearchTerm: term }));
  }, []);

  const toggleMessageRole = useCallback((role: 'user' | 'assistant') => {
    setFilters((prev) => {
      const newRoles = new Set(prev.messageRoles);
      if (newRoles.has(role)) {
        newRoles.delete(role);
      } else {
        newRoles.add(role);
      }
      return { ...prev, messageRoles: newRoles };
    });
  }, []);

  const setMinMessages = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, minMessages: value }));
  }, []);

  const setMaxMessages = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, maxMessages: value }));
  }, []);

  const setMinDuration = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, minDuration: value }));
  }, []);

  const setMaxDuration = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, maxDuration: value }));
  }, []);

  const setMinResponseTime = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, minResponseTime: value }));
  }, []);

  const setMaxResponseTime = useCallback((value: number | '') => {
    setFilters((prev) => ({ ...prev, maxResponseTime: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.hasUiFilter) count++;
    if (filters.selectedTools.size > 0) count++;
    if (filters.selectedWorkflows.size > 0) count++;
    if (filters.showErrorsOnly) count++;
    if (filters.showTimeoutsOnly) count++;
    if (filters.selectedTopic) count++;
    if (filters.messageSearchEnabled && filters.messageSearchTerm) count++;
    if (filters.minMessages !== '') count++;
    if (filters.maxMessages !== '') count++;
    if (filters.minDuration !== '') count++;
    if (filters.maxDuration !== '') count++;
    if (filters.minResponseTime !== '') count++;
    if (filters.maxResponseTime !== '') count++;
    return count;
  }, [filters]);

  return {
    ...filters,
    setSearchTerm,
    setHasUiFilter,
    toggleTool,
    toggleWorkflow,
    setShowErrorsOnly,
    setShowTimeoutsOnly,
    setSelectedTopic,
    setMessageSearchEnabled,
    setMessageSearchTerm,
    toggleMessageRole,
    setMinMessages,
    setMaxMessages,
    setMinDuration,
    setMaxDuration,
    setMinResponseTime,
    setMaxResponseTime,
    clearAllFilters,
    activeFilterCount,
  };
}

/**
 * Hook for filtering threads based on active filters
 */
interface UseFilteredThreadsProps {
  threads: Thread[];
  filters: ThreadFilters;
}

export function useFilteredThreads({ threads, filters }: UseFilteredThreadsProps): Thread[] {
  // Helper functions for checking thread properties
  const threadHasErrors = useCallback((thread: Thread): boolean => {
    return thread.messages.some((message) => {
      if (message.role === 'system' || message.role === 'status') {
        return message.content.some((content) => {
          const text = content.text || content.content || '';
          const errorPatterns = [
            /Agent execution error/gi,
            /Error:/gi,
            /Failed:/gi,
            /Exception:/gi,
            /Timeout/gi,
            /Connection error/gi,
            /Invalid/gi,
            /Not found/gi,
            /Unauthorized/gi,
            /Forbidden/gi,
          ];
          return errorPatterns.some((pattern) => pattern.test(text));
        });
      }
      return false;
    });
  }, []);

  const threadHasTimeouts = useCallback((thread: Thread): boolean => {
    if (!thread.messages || thread.messages.length < 2) return false;

    const sortedMessages = [...thread.messages].sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || a.sentAt).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.sentAt).getTime();
      return timeA - timeB;
    });

    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMessage = sortedMessages[i - 1];
      const currentMessage = sortedMessages[i];

      const prevTime = new Date(
        prevMessage.created_at || prevMessage.createdAt || prevMessage.sentAt
      ).getTime();
      const currentTime = new Date(
        currentMessage.created_at || currentMessage.createdAt || currentMessage.sentAt
      ).getTime();

      if (currentTime - prevTime >= 30000) {
        if (currentMessage.role === 'user') {
          continue;
        }
        return true;
      }
    }

    return false;
  }, []);

  const threadMatchesTool = useCallback((thread: Thread, toolName: string): boolean => {
    return thread.messages.some((message) =>
      message.content.some((content) => {
        const text = content.text || content.content || '';
        return text.includes(toolName);
      })
    );
  }, []);

  const threadMatchesWorkflow = useCallback((thread: Thread, workflowName: string): boolean => {
    return thread.messages.some((message) =>
      message.content.some((content) => {
        const text = content.text || content.content || '';
        return text.includes(workflowName);
      })
    );
  }, []);

  const threadMatchesTopic = useCallback((thread: Thread, topicName: string): boolean => {
    const threadCategory = categorizeThread(thread);
    return threadCategory === topicName;
  }, []);

  return useMemo(() => {
    return threads
      .filter((thread) => {
        // Search term filter
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          const matchesId = thread.id.toLowerCase().includes(searchLower);
          const matchesConvId = thread.conversationId.toLowerCase().includes(searchLower);

          const firstUserMessage = thread.messages.find((m) => m.role === 'user');
          const firstUserText =
            firstUserMessage?.content
              .map((c) => c.text || c.content || '')
              .join(' ')
              .toLowerCase() || '';
          const matchesText = firstUserText.includes(searchLower);

          if (!matchesId && !matchesConvId && !matchesText) {
            return false;
          }
        }

        // UI filter
        if (filters.hasUiFilter) {
          const hasUi = thread.messages.some((msg) => msg.content.some((c) => c.kind === 'ui'));
          if (!hasUi) return false;
        }

        // Tool filter
        if (filters.selectedTools.size > 0) {
          const hasAnyTool = Array.from(filters.selectedTools).some((tool) =>
            threadMatchesTool(thread, tool)
          );
          if (!hasAnyTool) return false;
        }

        // Workflow filter
        if (filters.selectedWorkflows.size > 0) {
          const hasAnyWorkflow = Array.from(filters.selectedWorkflows).some((workflow) =>
            threadMatchesWorkflow(thread, workflow)
          );
          if (!hasAnyWorkflow) return false;
        }

        // Error filter
        if (filters.showErrorsOnly && !threadHasErrors(thread)) {
          return false;
        }

        // Timeout filter
        if (filters.showTimeoutsOnly && !threadHasTimeouts(thread)) {
          return false;
        }

        // Topic filter
        if (filters.selectedTopic && !threadMatchesTopic(thread, filters.selectedTopic)) {
          return false;
        }

        // Message search filter - only search user and assistant messages
        if (filters.messageSearchEnabled && filters.messageSearchTerm) {
          const searchLower = filters.messageSearchTerm.toLowerCase();
          const hasMatch = thread.messages.some((msg) => {
            // Only search in user or assistant messages, skip system messages
            if (msg.role !== 'user' && msg.role !== 'assistant') {
              return false;
            }
            // Only search if this role is selected
            if (!filters.messageRoles.has(msg.role as 'user' | 'assistant')) {
              return false;
            }
            return msg.content.some((c) => {
              const text = c.text || c.content || '';
              return text.toLowerCase().includes(searchLower);
            });
          });
          if (!hasMatch) return false;
        }

        // Message count filters
        const messageCount = thread.messages.filter(
          (msg) => msg.role === 'user' || msg.role === 'assistant'
        ).length;

        if (filters.minMessages !== '' && messageCount < filters.minMessages) {
          return false;
        }
        if (filters.maxMessages !== '' && messageCount > filters.maxMessages) {
          return false;
        }

        // Duration filters
        const allTimestamps = thread.messages
          .map((m) => new Date(m.created_at || m.createdAt || m.sentAt))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

        const conversationDuration =
          allTimestamps.length > 1
            ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
            : 0;
        const durationSeconds = Math.round(conversationDuration / 1000);

        if (filters.minDuration !== '' && durationSeconds < filters.minDuration) {
          return false;
        }
        if (filters.maxDuration !== '' && durationSeconds > filters.maxDuration) {
          return false;
        }

        // Response time filters
        const userMessages = thread.messages.filter((m) => m.role === 'user');
        const assistantMessages = thread.messages.filter((m) => m.role === 'assistant');

        let responseTimeSeconds = 0;
        if (userMessages.length > 0 && assistantMessages.length > 0) {
          const firstUserMessage = userMessages
            .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
            .filter((m) => !Number.isNaN(m.timestamp.getTime()))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

          const firstAssistantMessage = assistantMessages
            .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
            .filter((m) => !Number.isNaN(m.timestamp.getTime()))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

          if (
            firstUserMessage &&
            firstAssistantMessage &&
            firstAssistantMessage.timestamp > firstUserMessage.timestamp
          ) {
            const timeToFirstResponse =
              firstAssistantMessage.timestamp.getTime() - firstUserMessage.timestamp.getTime();
            responseTimeSeconds = Math.round(timeToFirstResponse / 1000);
          }
        }

        if (filters.minResponseTime !== '' && responseTimeSeconds < filters.minResponseTime) {
          return false;
        }
        if (filters.maxResponseTime !== '' && responseTimeSeconds > filters.maxResponseTime) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; // Most recent first
      });
  }, [
    threads,
    filters,
    threadHasErrors,
    threadHasTimeouts,
    threadMatchesTool,
    threadMatchesWorkflow,
    threadMatchesTopic,
  ]);
}
