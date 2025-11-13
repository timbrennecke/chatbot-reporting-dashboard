/**
 * Hook for tracking viewed threads and conversations
 */

import { useCallback, useEffect, useState } from 'react';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';

interface UseViewedThreadsReturn {
  viewedThreads: Set<string>;
  viewedConversations: Set<string>;
  markThreadAsViewed: (threadId: string) => void;
  markConversationAsViewed: (conversationId: string) => void;
  isThreadViewed: (threadId: string) => boolean;
  isConversationViewed: (conversationId: string) => boolean;
}

export function useViewedThreads(
  onConversationViewed?: (conversationId: string) => void
): UseViewedThreadsReturn {
  const [viewedThreads, setViewedThreads] = useState<Set<string>>(new Set());
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load viewed data on mount
  useEffect(() => {
    try {
      const savedThreads = getEnvironmentSpecificItem('chatbot-dashboard-viewed-threads');
      if (savedThreads) {
        setViewedThreads(new Set(JSON.parse(savedThreads)));
      }

      const savedConversations = getEnvironmentSpecificItem(
        'chatbot-dashboard-viewed-conversations'
      );
      if (savedConversations) {
        setViewedConversations(new Set(JSON.parse(savedConversations)));
      }
    } catch {
      // Failed to load viewed data
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  // Listen for conversation viewed events
  useEffect(() => {
    const handleConversationViewed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { conversationId } = customEvent.detail;

      setViewedConversations((prev) => {
        const newSet = new Set(prev);
        newSet.add(conversationId);
        return newSet;
      });
    };

    window.addEventListener('conversation-viewed', handleConversationViewed);
    return () => {
      window.removeEventListener('conversation-viewed', handleConversationViewed);
    };
  }, []);

  // Save viewed threads to storage
  useEffect(() => {
    if (isInitialLoad || viewedThreads.size === 0) return;

    try {
      setEnvironmentSpecificItem(
        'chatbot-dashboard-viewed-threads',
        JSON.stringify(Array.from(viewedThreads))
      );
    } catch {
      // Failed to save
    }
  }, [viewedThreads, isInitialLoad]);

  // Save viewed conversations to storage
  useEffect(() => {
    if (isInitialLoad || viewedConversations.size === 0) return;

    try {
      setEnvironmentSpecificItem(
        'chatbot-dashboard-viewed-conversations',
        JSON.stringify(Array.from(viewedConversations))
      );
    } catch {
      // Failed to save
    }
  }, [viewedConversations, isInitialLoad]);

  const markThreadAsViewed = useCallback((threadId: string) => {
    setViewedThreads((prev) => {
      const newSet = new Set(prev);
      newSet.add(threadId);
      return newSet;
    });
  }, []);

  const markConversationAsViewed = useCallback(
    (conversationId: string) => {
      setViewedConversations((prev) => {
        const newSet = new Set(prev);
        newSet.add(conversationId);
        return newSet;
      });

      if (onConversationViewed) {
        onConversationViewed(conversationId);
      }
    },
    [onConversationViewed]
  );

  const isThreadViewed = useCallback(
    (threadId: string) => {
      return viewedThreads.has(threadId);
    },
    [viewedThreads]
  );

  const isConversationViewed = useCallback(
    (conversationId: string) => {
      return viewedConversations.has(conversationId);
    },
    [viewedConversations]
  );

  return {
    viewedThreads,
    viewedConversations,
    markThreadAsViewed,
    markConversationAsViewed,
    isThreadViewed,
    isConversationViewed,
  };
}
