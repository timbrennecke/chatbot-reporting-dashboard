import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../lib/api';
import type { Conversation } from '../lib/types';

interface UseConversationFetchProps {
  conversationId: string;
  apiKey: string;
  uploadedConversation?: Conversation;
  onConversationFetched?: (conversation: Conversation) => void;
}

interface UseConversationFetchReturn {
  fetchLoading: boolean;
  fetchError: string;
  fetchedConversation: Conversation | null;
  fetchResponse: string;
  showJsonOutput: boolean;
  setShowJsonOutput: (show: boolean) => void;
  handleFetchConversation: () => Promise<void>;
}

export function useConversationFetch({
  conversationId,
  apiKey,
  uploadedConversation,
  onConversationFetched,
}: UseConversationFetchProps): UseConversationFetchReturn {
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [fetchedConversation, setFetchedConversation] = useState<Conversation | null>(null);
  const [fetchResponse, setFetchResponse] = useState<string>('');
  const [showJsonOutput, setShowJsonOutput] = useState(false);

  const handleFetchConversation = useCallback(async () => {
    if (!conversationId.trim()) return;

    if (!apiKey.trim()) {
      setFetchError('Please enter an API key first');
      return;
    }

    setFetchLoading(true);
    setFetchError('');
    setFetchedConversation(null);
    setFetchResponse('');

    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/conversation/${conversationId.trim()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const responseText = await response.text();
      let prettyResponse = responseText;
      try {
        prettyResponse = JSON.stringify(JSON.parse(responseText), null, 2);
      } catch {
        // leave as-is if not valid JSON
      }
      setFetchResponse(prettyResponse);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      setFetchedConversation(data);

      // Notify parent component about the fetched conversation
      onConversationFetched?.(data);
    } catch (error: unknown) {
      // Provide more helpful error messages for common CORS/network issues
      let errorMessage = 'Failed to fetch conversation';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          errorMessage =
            'Network error: Unable to connect to API. This might be due to CORS restrictions or network connectivity issues.';
        }
      }

      setFetchError(errorMessage);
    } finally {
      setFetchLoading(false);
    }
  }, [conversationId, apiKey, onConversationFetched]);

  // Clear fetched conversation when conversation ID changes
  useEffect(() => {
    if (fetchedConversation && conversationId !== fetchedConversation.id) {
      setFetchedConversation(null);
    }
  }, [conversationId, fetchedConversation]);

  return {
    fetchLoading,
    fetchError,
    fetchedConversation,
    fetchResponse,
    showJsonOutput,
    setShowJsonOutput,
    handleFetchConversation,
  };
}
