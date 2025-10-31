import { useState } from 'react';
import { getApiBaseUrl } from '../lib/api';

export function useConversationSearch() {
  const [conversationSearchId, setConversationSearchId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleConversationSearch = async (
    apiKey: string,
    onConversationFound: (conversation: any, thread?: any) => void
  ) => {
    if (!conversationSearchId.trim()) return;
    
    if (!apiKey.trim()) {
      setSearchError('Please enter an API key first');
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      const conversationId = conversationSearchId.trim();
      
      console.log('🌐 Fetching conversation from API');
      
      // Fetch the conversation
      const apiBaseUrl = getApiBaseUrl();
      const conversationResponse = await fetch(`${apiBaseUrl}/conversation/${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
      });
      
      if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text();
        throw new Error(`HTTP ${conversationResponse.status}: ${errorText}`);
      }
      
      const conversation = await conversationResponse.json();
      
      // No more caching - just use the data directly
      
      // Calculate date range for threads endpoint
      const messages = conversation.messages || [];
      let startTimestamp = conversation.createdAt;
      let endTimestamp = conversation.lastMessageAt || conversation.createdAt;
      
      if (messages.length > 0) {
        const messageTimes = messages.map((m: any) => new Date(m.sentAt).getTime());
        const minTime = Math.min(...messageTimes);
        const maxTime = Math.max(...messageTimes);
        startTimestamp = new Date(minTime).toISOString();
        endTimestamp = new Date(maxTime).toISOString();
      }
      
      // Fetch threads (system messages) for the date range
      let threadsData = null;
      try {
        const threadsResponse = await fetch(`${apiBaseUrl}/thread`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startTimestamp,
            endTimestamp
          }),
        });
        
        if (threadsResponse.ok) {
          threadsData = await threadsResponse.json();
        }
      } catch (threadsError) {
        console.warn('⚠️ Error fetching threads data:', threadsError);
      }
      
      // Find the specific thread for this conversation
      const matchingThread = threadsData?.threads?.find((t: any) => 
        t.thread.conversationId === conversation.id
      )?.thread;
      
      onConversationFound(conversation, matchingThread);
      setConversationSearchId('');
      
    } catch (error: any) {
      console.error('❌ Search error:', error);
      
      let errorMessage = error.message || 'Failed to fetch conversation';
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to API. Check your internet connection and CORS settings.';
      }
      
      setSearchError(errorMessage);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent, apiKey: string, onConversationFound: (conversation: any, thread?: any) => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConversationSearch(apiKey, onConversationFound);
    }
  };

  return {
    conversationSearchId,
    setConversationSearchId,
    searchLoading,
    searchError,
    handleConversationSearch,
    handleSearchKeyDown,
  };
}
