import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Alert, AlertDescription } from './components/ui/alert';
import { 
  MessageSquare, 
  Info,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Power
} from 'lucide-react';
import { Badge } from './components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './components/ui/select';

import { ThreadsOverview } from './components/ThreadsOverview';
import { ConversationDetail } from './components/ConversationDetail';
import { SavedChats } from './components/SavedChats';
import { UploadedData, Thread, Conversation } from './lib/types';
import { 
  setGlobalOfflineMode, 
  getApiBaseUrl, 
  getEnvironmentSpecificItem, 
  setEnvironmentSpecificItem 
} from './lib/api';
import { 
  mockConversation, 
  mockThreadsResponse, 
  mockAttributesResponse, 
  mockBulkAttributesResponse 
} from './lib/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploadedData, setUploadedData] = useState<UploadedData>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [environment, setEnvironment] = useState(() => {
    // Load environment from localStorage on app start
    return localStorage.getItem('chatbot-dashboard-environment') || 'staging';
  });
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from environment-specific localStorage on app start
    return getEnvironmentSpecificItem('chatbot-dashboard-api-key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Conversation search state
  const [conversationSearchId, setConversationSearchId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Conversation navigation state
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [currentConversationIndex, setCurrentConversationIndex] = useState<number>(-1);
  const [fetchedConversationsMap, setFetchedConversationsMap] = useState<Map<string, any>>(new Map());
  const [threadOrder, setThreadOrder] = useState<string[]>([]);
  const [currentThreads, setCurrentThreads] = useState<Thread[]>([]); // Store current threads from ThreadsOverview
  
  // Use ref to store current thread order to avoid stale closures in navigation
  const threadOrderRef = useRef<string[]>([]);
  const selectedConversationIdRef = useRef<string | undefined>();
  const currentThreadPositionRef = useRef<number>(-1);
  
  // Navigation context - track if we're navigating from SavedChats or main threads
  const [navigationContext, setNavigationContext] = useState<'threads' | 'saved-chats'>('threads');
  const savedChatsOrderRef = useRef<string[]>([]);
  const currentSavedChatPositionRef = useRef<number>(-1);
  
  // Keep selectedConversationId ref synchronized
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);
  
  // Helper function to get current navigation state safely
  const getCurrentNavigationState = useCallback(() => {
    const currentSelectedId = selectedConversationIdRef.current;
    
    if (navigationContext === 'saved-chats') {
      // Use saved chats navigation
      const currentSavedOrder = savedChatsOrderRef.current;
      const currentPosition = currentSavedChatPositionRef.current;
      
      if (!currentSelectedId || currentSavedOrder.length === 0) {
        return {
          currentIndex: -1,
          threadOrder: currentSavedOrder,
          hasPrevious: false,
          hasNext: false
        };
      }
      
      // Use the tracked position instead of indexOf to handle duplicate conversation IDs
      let currentIndex = currentPosition;
      
      // Validate that the position is correct and within bounds
      if (currentIndex < 0 || currentIndex >= currentSavedOrder.length || 
          currentSavedOrder[currentIndex] !== currentSelectedId) {
        // Fallback to indexOf if position is invalid
        currentIndex = currentSavedOrder.indexOf(currentSelectedId);
        currentSavedChatPositionRef.current = currentIndex;
        console.log('⚠️ Saved chat position validation failed, falling back to indexOf:', currentIndex, 'for conversation:', currentSelectedId);
      } else {
        console.log('✅ Saved chat position validation passed:', currentIndex, 'for conversation:', currentSelectedId);
      }
      
      return {
        currentIndex,
        threadOrder: currentSavedOrder,
        hasPrevious: currentIndex > 0,
        hasNext: currentIndex >= 0 && currentIndex < currentSavedOrder.length - 1
      };
    } else {
      // Use regular threads navigation
      const currentThreadOrder = threadOrderRef.current;
      const currentPosition = currentThreadPositionRef.current;
      
      if (!currentSelectedId || currentThreadOrder.length === 0) {
        return {
          currentIndex: -1,
          threadOrder: currentThreadOrder,
          hasPrevious: false,
          hasNext: false
        };
      }
      
      // Use the tracked position instead of indexOf to handle duplicate conversation IDs
      let currentIndex = currentPosition;
      
      // Validate that the position is correct and within bounds
      if (currentIndex < 0 || currentIndex >= currentThreadOrder.length || 
          currentThreadOrder[currentIndex] !== currentSelectedId) {
        // Fallback to indexOf if position is invalid
        currentIndex = currentThreadOrder.indexOf(currentSelectedId);
        currentThreadPositionRef.current = currentIndex;
        console.log('⚠️ Thread position validation failed, falling back to indexOf:', currentIndex, 'for conversation:', currentSelectedId);
        console.log('⚠️ Thread order around that position:', currentThreadOrder.slice(Math.max(0, currentIndex - 2), currentIndex + 3));
      } else {
        console.log('✅ Thread position validation passed:', currentIndex, 'for conversation:', currentSelectedId);
      }
      
      return {
        currentIndex,
        threadOrder: currentThreadOrder,
        hasPrevious: currentIndex > 0,
        hasNext: currentIndex >= 0 && currentIndex < currentThreadOrder.length - 1
      };
    }
  }, [navigationContext]);

  // Handle environment change - load environment-specific data
  const handleEnvironmentChange = (newEnvironment: string) => {
    console.log('🌍 Environment changed to:', newEnvironment);
    
    // Save new environment to localStorage
    setEnvironment(newEnvironment);
    localStorage.setItem('chatbot-dashboard-environment', newEnvironment);
    
    // Load environment-specific data
    const newApiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key') || '';
    setApiKey(newApiKey);
    
    // Load environment-specific uploaded data
    try {
      const savedData = getEnvironmentSpecificItem('chatbot-dashboard-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setUploadedData(parsedData);
        
        // Enable global offline mode if we have any data
        const hasAnyData = (parsedData.conversations?.length || 0) > 0 || 
                          !!parsedData.threadsResponse || 
                          (parsedData.attributesResponses?.length || 0) > 0 || 
                          (parsedData.bulkAttributesResponses?.length || 0) > 0;
        setGlobalOfflineMode(hasAnyData);
      } else {
        setUploadedData({});
        setGlobalOfflineMode(false);
      }
    } catch (error) {
      console.error('Failed to load environment-specific data:', error);
      setUploadedData({});
      setGlobalOfflineMode(false);
    }
    
    // Load environment-specific saved chats
    try {
      const savedChatsData = getEnvironmentSpecificItem('chatbot-dashboard-saved-chats');
      const newSavedChats = savedChatsData ? new Set(JSON.parse(savedChatsData)) : new Set();
      setSavedChats(newSavedChats);
      console.log('💾 Loaded environment-specific saved chats:', newSavedChats.size, 'chats');
    } catch (error) {
      console.error('Failed to load environment-specific saved chats:', error);
      setSavedChats(new Set());
    }
    
    // Note: Saved chat notes are automatically environment-specific in SavedChats component
    // and will be loaded when the component re-initializes
    
    // Reset current selection state - ThreadsOverview will re-initialize due to key prop
    setSelectedConversationId(undefined);
    setSelectedThread(undefined);
    setConversationSearchId('');
    setSearchLoading(false);
    setSearchError(null);
    setAllConversations([]);
    setCurrentConversationIndex(-1);
    setFetchedConversationsMap(new Map());
    setThreadOrder([]);
    setShowConversationOverlay(false);
    setActiveTab('dashboard');
    setShowApiKey(false);
    
    console.log('✅ Switched to', newEnvironment, 'environment with preserved data');
  };

  // Save API key to environment-specific localStorage
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    setEnvironmentSpecificItem('chatbot-dashboard-api-key', newApiKey);
    console.log('🔑 API key saved to environment-specific localStorage from dashboard');
  };

  // Handle Enter key press to save API key
  const handleApiKeyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApiKeyChange(apiKey);
    }
  };

  // Handle conversation search
  const handleConversationSearch = async () => {
    if (!conversationSearchId.trim()) return;
    
    if (!apiKey.trim()) {
      setSearchError('Please enter an API key first');
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      // First, fetch the conversation
      const apiBaseUrl = getApiBaseUrl();
      const conversationResponse = await fetch(`${apiBaseUrl}/conversation/${conversationSearchId.trim()}`, {
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
      
      // Calculate date range for threads endpoint
      const messages = conversation.messages || [];
      let startTimestamp = conversation.createdAt;
      let endTimestamp = conversation.lastMessageAt || conversation.createdAt;
      
      // If we have messages, use their timestamps for more accurate range
      if (messages.length > 0) {
        const messageTimes = messages.map(m => new Date(m.sentAt).getTime());
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
          console.log('📡 Fetched threads data for system messages:', threadsData);
        } else {
          console.warn('⚠️ Failed to fetch threads data, continuing without system messages');
        }
      } catch (threadsError) {
        console.warn('⚠️ Error fetching threads data:', threadsError);
      }
      
      // Find the specific thread for this conversation
      const matchingThread = threadsData?.threads?.find(t => 
        t.thread.conversationId === conversation.id
      )?.thread;
      
      if (matchingThread) {
        setSelectedThread(matchingThread);
        console.log('🔗 Found matching thread with system messages:', matchingThread);
      }
      
      // Set the fetched conversation and show it
      setSelectedConversationId(conversation.id);
      setShowConversationOverlay(true);
      
      // Clear search input
      setConversationSearchId('');
      
    } catch (error: any) {
      console.error('❌ Search error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Failed to fetch conversation';
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to API. Check your internet connection and CORS settings.';
      }
      
      setSearchError(errorMessage);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle Enter key press for conversation search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConversationSearch();
    }
  };

  // Handle app closure
  const handleServerShutdown = async () => {
    try {
      // Show confirmation dialog
      if (!window.confirm('Are you sure you want to close the application?')) {
        return;
      }

      // Call the shutdown endpoint
      await fetch('/api/shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Show brief message before the app closes
      alert('Closing application...');
      
      // Attempt to close the browser tab/window
      // Note: This may not work in all browsers due to security restrictions
      try {
        window.close();
      } catch (closeError) {
        console.log('Could not close tab automatically - please close manually');
        // If window.close() fails, show a message to close manually
        alert('Please close this browser tab manually to complete the shutdown.');
      }
    } catch (error) {
      // This is expected as the server will terminate
      console.log('Application closure initiated');
      
      // Still attempt to close the tab even if server shutdown fails
      try {
        window.close();
      } catch (closeError) {
        console.log('Could not close tab automatically - please close manually');
      }
    }
  };

  // Handle fetched conversations from ThreadsOverview
  const handleFetchedConversationsChange = (conversations: Map<string, any>) => {
    setFetchedConversationsMap(conversations);
    console.log('📚 Received fetched conversations:', conversations.size, 'total');
  };

  // Handle individual conversation fetched from ConversationDetail
  const handleConversationFetched = (conversation: any) => {
    console.log('📚 Individual conversation fetched:', conversation.id);
    setFetchedConversationsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(conversation.id, conversation);
      return newMap;
    });
    
    // If this is the currently selected conversation but it's not in allConversations yet,
    // trigger an update to include it in the navigation
    if (conversation.id === selectedConversationId) {
      console.log('🔄 Current conversation fetched, will update navigation list');
    }
  };

  // Handle thread order from ThreadsOverview
  const handleThreadOrderChange = useCallback((order: string[]) => {
    console.log('📋 Thread order received in App.tsx:', order.length, 'conversations');
    console.log('📋 First 3 IDs:', order.slice(0, 3));
    setThreadOrder(order);
    // Keep ref synchronized for navigation
    threadOrderRef.current = order;
    
    // Reset position tracking when thread order changes
    const currentSelectedId = selectedConversationIdRef.current;
    const oldPosition = currentThreadPositionRef.current;
    
    if (currentSelectedId && order.includes(currentSelectedId)) {
      // Try to maintain the same relative position if possible
      // This helps when filters change but the conversation is still in the list
      let newPosition = order.indexOf(currentSelectedId);
      
      // If we had a valid old position and there are multiple occurrences,
      // try to find the one that matches the old position or is closest to it
      if (oldPosition >= 0 && oldPosition < order.length) {
        const allPositions = order.map((id, index) => id === currentSelectedId ? index : -1).filter(i => i !== -1);
        if (allPositions.length > 1) {
          // Find the position closest to the old position
          newPosition = allPositions.reduce((closest, current) => 
            Math.abs(current - oldPosition) < Math.abs(closest - oldPosition) ? current : closest
          );
          console.log('📍 Multiple occurrences found, using closest to old position:', oldPosition, '→', newPosition);
        }
      }
      
      currentThreadPositionRef.current = newPosition;
      console.log('📍 Reset position tracking after thread order change:', newPosition, 'for conversation:', currentSelectedId);
    } else {
      currentThreadPositionRef.current = -1;
      console.log('📍 Reset position tracking to -1 (conversation not in new order)');
    }
  }, []);

  // Handle threads change from ThreadsOverview (for navigation with system messages)
  const handleThreadsChange = useCallback((threads: Thread[]) => {
    setCurrentThreads(threads);
  }, []);

  // Handle conversation viewed from ThreadsOverview or navigation
  const handleConversationViewed = (conversationId: string) => {
    console.log('📋 Conversation marked as viewed:', conversationId);
    
    // Update environment-specific localStorage to mark conversation as viewed
    try {
      const existingViewed = getEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations');
      const viewedSet = existingViewed ? new Set(JSON.parse(existingViewed)) : new Set();
      viewedSet.add(conversationId);
      setEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations', JSON.stringify(Array.from(viewedSet)));
      console.log('✅ Updated environment-specific localStorage with viewed conversation:', conversationId);
      
      // Dispatch custom event to notify ThreadsOverview to refresh
      window.dispatchEvent(new CustomEvent('conversationViewed', { detail: { conversationId } }));
    } catch (error) {
      console.error('Failed to save viewed conversation:', error);
    }
  };

  // Mark conversation as viewed (for navigation)
  const markConversationAsViewed = (conversationId: string) => {
    try {
      const existingViewed = getEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations');
      const viewedSet = existingViewed ? new Set(JSON.parse(existingViewed)) : new Set();
      viewedSet.add(conversationId);
      setEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations', JSON.stringify(Array.from(viewedSet)));
      console.log('📋 Navigation: Marked conversation as viewed:', conversationId);
    } catch (error) {
      console.error('Failed to mark conversation as viewed:', error);
    }
  };

  // Find and set thread data for a conversation (for navigation with system messages)
  const findAndSetThreadForConversation = (conversationId: string) => {
    // First try uploaded threads (for uploaded data scenario)
    const uploadedThreads = uploadedData.threadsResponse?.threads || [];
    const uploadedThread = uploadedThreads.find(threadData => threadData.thread.conversationId === conversationId);
    
    if (uploadedThread) {
      console.log('🔍 Found associated thread in uploaded data for navigation:', uploadedThread.thread.id, 'for conversation:', conversationId);
      setSelectedThread(uploadedThread.thread);
      return;
    }
    
    // Then try current threads from ThreadsOverview (for search results scenario)
    const currentThread = currentThreads.find(thread => thread.conversationId === conversationId);
    
    if (currentThread) {
      console.log('🔍 Found associated thread in search results for navigation:', currentThread.id, 'for conversation:', conversationId);
      setSelectedThread(currentThread);
      return;
    }
    
    console.log('❌ No thread found for conversation:', conversationId, 'Available sources:', {
      uploadedThreads: uploadedThreads.length,
      currentThreads: currentThreads.length,
      searchedInUploaded: uploadedThreads.map(t => t.thread.conversationId),
      searchedInCurrent: currentThreads.map(t => t.conversationId)
    });
    setSelectedThread(undefined);
  };

  // Synchronize threadOrder with ref and maintain legacy state for compatibility
  useEffect(() => {
    // Always keep the ref up to date with threadOrder state
    threadOrderRef.current = threadOrder;
    
    if (threadOrder.length > 0) {
      setAllConversations(threadOrder.map(id => ({ id, title: 'Loading...', messages: [] })));
      
      if (selectedConversationId && threadOrder.includes(selectedConversationId)) {
        const index = threadOrder.indexOf(selectedConversationId);
        setCurrentConversationIndex(index);
        console.log('🎯 Navigation sync: conversation', selectedConversationId, 'at index', index, 'of', threadOrder.length);
      } else {
        setCurrentConversationIndex(-1);
        console.log('❌ Navigation sync: conversation not found in threadOrder');
      }
    } else if (uploadedData.conversations && uploadedData.conversations.length > 0) {
      // Fallback to uploaded conversations
      setAllConversations(uploadedData.conversations);
      // Update ref with uploaded conversation IDs
      const uploadedIds = uploadedData.conversations.map(c => c.id);
      threadOrderRef.current = uploadedIds;
      
      if (selectedConversationId) {
        const index = uploadedData.conversations.findIndex(conv => conv.id === selectedConversationId);
        setCurrentConversationIndex(index);
        console.log('🎯 Fallback navigation sync: using uploaded conversations, index:', index);
      } else {
        setCurrentConversationIndex(-1);
      }
    } else {
      setAllConversations([]);
      setCurrentConversationIndex(-1);
      threadOrderRef.current = [];
      console.log('📚 No conversations available for navigation');
    }
  }, [threadOrder, selectedConversationId, uploadedData.conversations]);

  // Navigation handlers
  const handlePreviousConversation = useCallback(() => {
    const navState = getCurrentNavigationState();
    
    console.log('🔄 Previous conversation clicked', { 
      currentIndex: navState.currentIndex,
      threadOrderLength: navState.threadOrder.length,
      hasPrevious: navState.hasPrevious,
      selectedId: selectedConversationIdRef.current,
      currentPosition: currentThreadPositionRef.current,
      threadOrderIds: navState.threadOrder.slice(0, 5) // First 5 for debugging
    });
    
    if (navState.hasPrevious && navState.threadOrder.length > 0) {
      const newIndex = navState.currentIndex - 1;
      const conversationId = navState.threadOrder[newIndex];
      console.log('🔄 Navigating to previous conversation:', conversationId, 'at index', newIndex);
      
      // Update position tracking before setting the conversation
      if (navigationContext === 'saved-chats') {
        currentSavedChatPositionRef.current = newIndex;
      } else {
        currentThreadPositionRef.current = newIndex;
      }
      
      // Check if we're navigating to the same conversation ID (duplicate)
      const currentSelectedId = selectedConversationIdRef.current;
      const isSameConversationId = currentSelectedId === conversationId;
      
      if (isSameConversationId) {
        console.log('🔄 Navigating to same conversation ID at different position:', conversationId, 'from', navState.currentIndex, 'to', newIndex);
        // Show brief feedback for duplicate conversation navigation
        showBriefNavigationFeedback();
      } else {
        // Different conversation ID - show full overlay
        setShowConversationOverlay(true);
      }
      
      // Force update even if conversation ID is the same (for duplicates)
      setSelectedConversationId(conversationId);
      
      // Force position update in case conversation ID didn't change (duplicates)
      selectedConversationIdRef.current = conversationId;
      
      console.log('🎯 Position updated to:', newIndex, 'for conversation:', conversationId);
      
      // Mark conversation as viewed through ThreadsOverview callback
      handleConversationViewed(conversationId);
      
      // Find and set the associated thread for system messages
      findAndSetThreadForConversation(conversationId);
    } else {
      console.log('❌ Cannot navigate to previous - no previous conversation available', {
        hasPrevious: navState.hasPrevious,
        threadOrderLength: navState.threadOrder.length,
        currentIndex: navState.currentIndex
      });
    }
  }, [getCurrentNavigationState, handleConversationViewed]);

  const handleNextConversation = useCallback(() => {
    const navState = getCurrentNavigationState();
    
    console.log('🔄 Next conversation clicked', { 
      currentIndex: navState.currentIndex,
      threadOrderLength: navState.threadOrder.length,
      hasNext: navState.hasNext,
      selectedId: selectedConversationIdRef.current,
      currentPosition: currentThreadPositionRef.current,
      threadOrderIds: navState.threadOrder.slice(0, 5) // First 5 for debugging
    });
    
    if (navState.hasNext && navState.threadOrder.length > 0) {
      const newIndex = navState.currentIndex + 1;
      const conversationId = navState.threadOrder[newIndex];
      console.log('🔄 Navigating to next conversation:', conversationId, 'at index', newIndex);
      
      // Update position tracking before setting the conversation
      if (navigationContext === 'saved-chats') {
        currentSavedChatPositionRef.current = newIndex;
      } else {
        currentThreadPositionRef.current = newIndex;
      }
      
      // Check if we're navigating to the same conversation ID (duplicate)
      const currentSelectedId = selectedConversationIdRef.current;
      const isSameConversationId = currentSelectedId === conversationId;
      
      if (isSameConversationId) {
        console.log('🔄 Navigating to same conversation ID at different position:', conversationId, 'from', navState.currentIndex, 'to', newIndex);
        // Show brief feedback for duplicate conversation navigation
        showBriefNavigationFeedback();
      } else {
        // Different conversation ID - show full overlay
        setShowConversationOverlay(true);
      }
      
      // Force update even if conversation ID is the same (for duplicates)
      setSelectedConversationId(conversationId);
      
      // Force position update in case conversation ID didn't change (duplicates)
      selectedConversationIdRef.current = conversationId;
      
      console.log('🎯 Position updated to:', newIndex, 'for conversation:', conversationId);
      
      // Mark conversation as viewed through ThreadsOverview callback
      handleConversationViewed(conversationId);
      
      // Find and set the associated thread for system messages
      findAndSetThreadForConversation(conversationId);
    } else {
      console.log('❌ Cannot navigate to next - no next conversation available', {
        hasNext: navState.hasNext,
        threadOrderLength: navState.threadOrder.length,
        currentIndex: navState.currentIndex
      });
    }
  }, [getCurrentNavigationState, handleConversationViewed]);

  // Check if navigation is available using current state
  const navigationState = getCurrentNavigationState();
  const hasPreviousConversation = navigationState.hasPrevious;
  const hasNextConversation = navigationState.hasNext;
  
  // Debug navigation state with improved logging
  console.log('🔍 Navigation state:', { 
    legacyCurrentIndex: currentConversationIndex, 
    newCurrentIndex: navigationState.currentIndex,
    currentPosition: currentThreadPositionRef.current,
    allConversationsCount: allConversations.length,
    hasPreviousConversation, 
    hasNextConversation,
    selectedConversationId,
    threadOrderLength: threadOrder.length,
    threadOrderRefLength: threadOrderRef.current.length,
    fetchedConversationsMapSize: fetchedConversationsMap.size,
    uploadedConversationsCount: uploadedData.conversations?.length || 0,
    threadOrderMatches: threadOrder.length === threadOrderRef.current.length,
    threadOrderSample: threadOrderRef.current.slice(0, 10),
    duplicateConversations: threadOrderRef.current.filter((id, index, arr) => arr.indexOf(id) !== index)
  });

  // Load environment-specific data from localStorage on component mount
  useEffect(() => {
    try {
      const savedData = getEnvironmentSpecificItem('chatbot-dashboard-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setUploadedData(parsedData);
        
        // Enable global offline mode if we have any data
        const hasAnyData = (parsedData.conversations?.length || 0) > 0 || 
                          !!parsedData.threadsResponse || 
                          (parsedData.attributesResponses?.length || 0) > 0 || 
                          (parsedData.bulkAttributesResponses?.length || 0) > 0;
        setGlobalOfflineMode(hasAnyData);
      }
    } catch (error) {
      console.error('Failed to load environment-specific saved data:', error);
    }
  }, []);
  const [showConversationOverlay, setShowConversationOverlay] = useState(false);
  const [showNavigationFeedback, setShowNavigationFeedback] = useState(false);
  
  // Saved chats state
  const [savedChats, setSavedChats] = useState<Set<string>>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-saved-chats');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.error('Failed to load saved chats:', error);
      return new Set();
    }
  });
  
  // Helper function to show brief navigation feedback
  const showBriefNavigationFeedback = useCallback(() => {
    setShowNavigationFeedback(true);
    setTimeout(() => {
      setShowNavigationFeedback(false);
    }, 300); // Very brief 300ms feedback
  }, []);

  // Save/unsave chat functions
  const handleSaveChat = useCallback((conversationId: string) => {
    const newSavedChats = new Set(savedChats);
    newSavedChats.add(conversationId);
    setSavedChats(newSavedChats);
    
    // Persist to localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-saved-chats', JSON.stringify([...newSavedChats]));
      console.log('💾 Chat saved:', conversationId);
    } catch (error) {
      console.error('Failed to save chat to localStorage:', error);
    }
  }, [savedChats]);

  const handleUnsaveChat = useCallback((conversationId: string) => {
    const newSavedChats = new Set(savedChats);
    newSavedChats.delete(conversationId);
    setSavedChats(newSavedChats);
    
    // Persist to localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-saved-chats', JSON.stringify([...newSavedChats]));
      console.log('🗑️ Chat unsaved:', conversationId);
    } catch (error) {
      console.error('Failed to unsave chat from localStorage:', error);
    }
  }, [savedChats]);

  const toggleSaveChat = useCallback((conversationId: string) => {
    if (savedChats.has(conversationId)) {
      handleUnsaveChat(conversationId);
    } else {
      handleSaveChat(conversationId);
    }
  }, [savedChats, handleSaveChat, handleUnsaveChat]);

  const handleClearAllSaved = useCallback(() => {
    setSavedChats(new Set());
    
    // Persist to localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-saved-chats', JSON.stringify([]));
      console.log('🗑️ All saved chats cleared');
    } catch (error) {
      console.error('Failed to clear all saved chats from localStorage:', error);
    }
  }, []);

  // Notes management - shared between ConversationDetail and SavedChats
  const handleNotesChange = useCallback((conversationId: string, notes: string) => {
    try {
      // Load existing notes
      const savedNotes = getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes') || '{}';
      const notesData = JSON.parse(savedNotes);
      
      // Update notes for this conversation
      if (notes.trim()) {
        notesData[conversationId] = notes;
      } else {
        delete notesData[conversationId];
      }
      
      // Save back to localStorage
      setEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes', JSON.stringify(notesData));
      console.log('📝 Notes updated for conversation:', conversationId, 'Notes length:', notes.length);
    } catch (error) {
      console.error('Failed to save notes for conversation:', error);
    }
  }, []);

  // Get current notes for a conversation
  const getCurrentNotes = useCallback((conversationId: string): string => {
    try {
      const savedNotes = getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes');
      if (savedNotes) {
        const notesData = JSON.parse(savedNotes);
        return notesData[conversationId] || '';
      }
    } catch (error) {
      console.error('Failed to load notes for conversation:', error);
    }
    return '';
  }, []);

  const handleDataUploaded = (data: UploadedData) => {
    setUploadedData(prevData => {
      // Merge new data with existing data
      const merged: UploadedData = {
        conversations: [
          ...(prevData.conversations || []),
          ...(data.conversations || [])
        ],
        threadsResponse: data.threadsResponse ? {
          threads: [
            ...(prevData.threadsResponse?.threads || []),
            ...(data.threadsResponse.threads || [])
          ]
        } : prevData.threadsResponse,
        attributesResponses: [
          ...(prevData.attributesResponses || []),
          ...(data.attributesResponses || [])
        ],
        bulkAttributesResponses: [
          ...(prevData.bulkAttributesResponses || []),
          ...(data.bulkAttributesResponses || [])
        ]
      };
      
      // Remove empty arrays to keep data clean
      if (merged.conversations?.length === 0) delete merged.conversations;
      if (merged.attributesResponses?.length === 0) delete merged.attributesResponses;
      if (merged.bulkAttributesResponses?.length === 0) delete merged.bulkAttributesResponses;
      
      // Enable global offline mode if we have any data
      const hasAnyData = (merged.conversations?.length || 0) > 0 || 
                        !!merged.threadsResponse || 
                        (merged.attributesResponses?.length || 0) > 0 || 
                        (merged.bulkAttributesResponses?.length || 0) > 0;
      setGlobalOfflineMode(hasAnyData);
      
      // Save to environment-specific localStorage
      try {
        setEnvironmentSpecificItem('chatbot-dashboard-data', JSON.stringify(merged));
      } catch (error) {
        console.error('Failed to save data to environment-specific localStorage:', error);
      }
      
      return merged;
    });
    
    // Auto-switch to appropriate tab based on data type
    if (data.threadsResponse?.threads?.length) {
      setActiveTab('dashboard');
    } else if (data.conversations?.length) {
      // Stay on dashboard tab to show conversation overview
      setActiveTab('dashboard');
      setSelectedConversationId(data.conversations[0].id);
    } else if (data.attributesResponses?.length || data.bulkAttributesResponses?.length) {
      setActiveTab('dashboard');
    }
  };

  const handleDataCleared = () => {
    setUploadedData({});
    setSelectedConversationId(undefined);
    setSelectedThread(undefined);
    // Disable global offline mode when data is cleared
    setGlobalOfflineMode(false);
    
    // Clear from environment-specific localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-data', '{}');
    } catch (error) {
      console.error('Failed to clear data from environment-specific localStorage:', error);
    }
  };



  const handleThreadSelect = (thread: Thread) => {
    setSelectedThread(thread);
    setSelectedConversationId(thread.conversationId);
    
    // Check if we have the actual conversation data for this thread
    const hasConversationData = uploadedData.conversations?.some(c => c.id === thread.conversationId);
    
    if (hasConversationData) {
      // Show conversation details if we have the data
      setShowConversationOverlay(true);
    } else {
      // If we only have thread data, show thread details
      // For now, still show the conversation overlay but it will show a helpful message
      setShowConversationOverlay(true);
    }
  };

  const handleConversationSelect = (conversationId: string, position?: number) => {
    setSelectedConversationId(conversationId);
    setShowConversationOverlay(true);
    setNavigationContext('threads'); // Set context to threads navigation
    
    // Update position tracking when conversation is selected from overview
    if (position !== undefined) {
      // Use the provided position (handles duplicate conversation IDs correctly)
      currentThreadPositionRef.current = position;
      console.log('📍 Set conversation position from threads overview (provided):', position, 'for conversation:', conversationId);
    } else {
      // Fallback to indexOf for backward compatibility
      const currentThreadOrder = threadOrderRef.current;
      const foundPosition = currentThreadOrder.indexOf(conversationId);
      if (foundPosition !== -1) {
        currentThreadPositionRef.current = foundPosition;
        console.log('📍 Set conversation position from threads overview (indexOf):', foundPosition, 'for conversation:', conversationId);
      } else {
        console.log('⚠️ Conversation not found in thread order when selected from threads overview:', conversationId);
        currentThreadPositionRef.current = -1;
      }
    }
  };

  const handleSavedChatSelect = (conversationId: string, position?: number, sortedOrder?: string[]) => {
    setSelectedConversationId(conversationId);
    setShowConversationOverlay(true);
    setNavigationContext('saved-chats'); // Set context to saved chats navigation
    
    // Update saved chats order and position tracking
    // Use sorted order if provided, otherwise fallback to original order
    const savedChatsArray = sortedOrder || [...savedChats];
    savedChatsOrderRef.current = savedChatsArray;
    
    if (position !== undefined) {
      // Use the provided position
      currentSavedChatPositionRef.current = position;
      console.log('📍 Set saved chat position (provided):', position, 'for conversation:', conversationId, 'in sorted order');
    } else {
      // Fallback to indexOf in the sorted order
      const foundPosition = savedChatsArray.indexOf(conversationId);
      if (foundPosition !== -1) {
        currentSavedChatPositionRef.current = foundPosition;
        console.log('📍 Set saved chat position (indexOf):', foundPosition, 'for conversation:', conversationId, 'in sorted order');
      } else {
        console.log('⚠️ Conversation not found in saved chats when selected:', conversationId);
        currentSavedChatPositionRef.current = -1;
      }
    }
  };

  // Extract threads from uploaded data
  const uploadedThreads = uploadedData.threadsResponse?.threads.map(t => t.thread) || [];
  
  // Find conversation from uploaded data
  const uploadedConversation = selectedConversationId && uploadedData.conversations?.find(
    c => c.id === selectedConversationId
  );
  
  // Check if we have any uploaded conversations (for offline mode detection)
  const hasAnyUploadedConversations = (uploadedData.conversations?.length || 0) > 0;

  // Update global offline mode whenever uploaded data changes
  useEffect(() => {
    const hasAnyData = (uploadedData.conversations?.length || 0) > 0 || 
                      !!uploadedData.threadsResponse || 
                      (uploadedData.attributesResponses?.length || 0) > 0 || 
                      (uploadedData.bulkAttributesResponses?.length || 0) > 0;
    setGlobalOfflineMode(hasAnyData);
  }, [uploadedData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                🤖
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#191970' }}>CHECK24 Bot Dashboard</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Environment Dropdown */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Environment:</Label>
                <Select value={environment} onValueChange={handleEnvironmentChange}>
                  <SelectTrigger className="w-32" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* API Key Input */}
              <div className="flex items-center gap-2">
                <Label htmlFor="dashboard-api-key" className="text-sm font-medium">API Key:</Label>
                <div className="relative">
                  <Input
                    id="dashboard-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onBlur={() => handleApiKeyChange(apiKey)}
                    onKeyDown={handleApiKeyKeyDown}
                    placeholder="Enter API key"
                    className="w-48 text-sm"
                    style={{ paddingRight: '40px' }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-0 h-full w-8 hover:bg-transparent flex items-center justify-center"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {apiKey && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Key className="h-3 w-3" />
                    <span>Saved</span>
                  </div>
                )}
              </div>
              
              {(uploadedThreads.length > 0 || uploadedData.conversations?.length || uploadedData.attributesResponses?.length || uploadedData.bulkAttributesResponses?.length) && (
                <>
                  <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800">
                    📴 Offline Mode Active
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDataCleared}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Data
                  </Button>
                </>
              )}
              
              {/* Close App Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleServerShutdown}
                className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600"
                title="Close the application"
              >
                <Power className="h-4 w-4" />
                Close App
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('conversation-search')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'conversation-search'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={{ marginLeft: '24px' }}
            >
              Conversation Search
            </button>
            <button
              onClick={() => setActiveTab('saved-chats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'saved-chats'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={{ marginLeft: '24px' }}
            >
              Saved Chats
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <ThreadsOverview
              key={environment} // Force re-initialization when environment changes
              uploadedThreads={uploadedThreads}
              uploadedConversations={uploadedData.conversations || []}
              onThreadSelect={handleThreadSelect}
              onConversationSelect={handleConversationSelect}
              onFetchedConversationsChange={handleFetchedConversationsChange}
              onThreadOrderChange={handleThreadOrderChange}
              onConversationViewed={handleConversationViewed}
              onThreadsChange={handleThreadsChange}
              savedConversationIds={savedChats}
            />
          )}
          
          {activeTab === 'conversation-search' && (
            <div className="max-w-2xl mx-auto">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">Conversation Search</h2>
                      <p className="text-slate-600">Enter a conversation ID to fetch and view the conversation details</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="conversation-search" className="text-base font-medium">Conversation ID</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            id="conversation-search"
                            type="text"
                            value={conversationSearchId}
                            onChange={(e) => setConversationSearchId(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Paste your conversation ID here..."
                            className="flex-1 text-center text-lg py-3"
                            disabled={searchLoading}
                          />
                          <Button
                            onClick={handleConversationSearch}
                            disabled={searchLoading || !conversationSearchId.trim() || !apiKey.trim()}
                            size="lg"
                            variant="outline"
                            className="px-4 py-3"
                            title="Search"
                          >
                            {searchLoading ? (
                              <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                              <Search className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleConversationSearch}
                        disabled={searchLoading || !conversationSearchId.trim() || !apiKey.trim()}
                        size="lg"
                        className="w-full bg-black hover:bg-black/90 text-white py-3 text-base font-medium"
                      >
                        {searchLoading ? (
                          <>
                            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          'Fetch Conversation'
                        )}
                      </Button>
                      
                      {!apiKey.trim() && (
                        <p className="text-sm text-amber-600">
                          Please set your API key in the header first
                        </p>
                      )}
                      
                      {searchError && (
                        <Alert variant="destructive" className="text-left">
                          <AlertDescription>
                            {searchError}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'saved-chats' && (
            <SavedChats
              savedConversationIds={[...savedChats]}
              uploadedConversations={uploadedData.conversations || []}
              uploadedThreads={uploadedThreads}
              fetchedConversationsMap={fetchedConversationsMap}
              onConversationSelect={handleSavedChatSelect}
              onUnsaveChat={handleUnsaveChat}
              onClearAllSaved={handleClearAllSaved}
              onNotesChange={handleNotesChange}
              onConversationFetched={handleConversationFetched}
            />
          )}
        </div>
      </main>

      {/* Conversation Detail Overlay */}
      {showConversationOverlay && (
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowConversationOverlay(false)}
                className="flex items-center gap-2"
              >
                ← Back to Dashboard
              </Button>
            </div>
            
            <ConversationDetail
              conversationId={selectedConversationId}
              uploadedConversation={uploadedConversation}
              hasAnyUploadedConversations={hasAnyUploadedConversations}
              selectedThread={selectedThread}
              onThreadSelect={(threadId) => {
                const thread = uploadedThreads.find(t => t.id === threadId);
                if (thread) {
                  setSelectedThread(thread);
                  // Could switch to a thread detail view if implemented
                }
              }}
              onPreviousConversation={handlePreviousConversation}
              onNextConversation={handleNextConversation}
              hasPreviousConversation={hasPreviousConversation}
              hasNextConversation={hasNextConversation}
              onConversationFetched={handleConversationFetched}
              isSaved={selectedConversationId ? savedChats.has(selectedConversationId) : false}
              onToggleSave={toggleSaveChat}
              initialNotes={selectedConversationId ? getCurrentNotes(selectedConversationId) : ''}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      )}

      {/* Brief Navigation Feedback for Duplicate Conversation IDs */}
      {showNavigationFeedback && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-current rounded-full animate-ping"></div>
              <span className="text-sm font-medium">Navigating...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}