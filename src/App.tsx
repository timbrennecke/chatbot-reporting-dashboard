import React, { useState, useEffect } from 'react';
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
  RefreshCw
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
  const handleThreadOrderChange = (order: string[]) => {
    console.log('📋 Thread order received in App.tsx:', order.length, 'conversations');
    console.log('📋 First 3 IDs:', order.slice(0, 3));
    setThreadOrder(order);
  };

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

  // Simple approach: just use threadOrder directly as the navigation list
  useEffect(() => {
    if (threadOrder.length > 0) {
      setAllConversations(threadOrder.map(id => ({ id, title: 'Loading...', messages: [] })));
      
      if (selectedConversationId && threadOrder.includes(selectedConversationId)) {
        const index = threadOrder.indexOf(selectedConversationId);
        setCurrentConversationIndex(index);
        console.log('🎯 Simple navigation: conversation', selectedConversationId, 'at index', index, 'of', threadOrder.length);
      } else {
        setCurrentConversationIndex(-1);
        console.log('❌ Simple navigation: conversation not found in threadOrder');
      }
    } else if (uploadedData.conversations && uploadedData.conversations.length > 0) {
      // Fallback to uploaded conversations
      setAllConversations(uploadedData.conversations);
      
      if (selectedConversationId) {
        const index = uploadedData.conversations.findIndex(conv => conv.id === selectedConversationId);
        setCurrentConversationIndex(index);
        console.log('🎯 Fallback navigation: using uploaded conversations, index:', index);
      } else {
        setCurrentConversationIndex(-1);
      }
    } else {
      setAllConversations([]);
      setCurrentConversationIndex(-1);
      console.log('📚 No conversations available for navigation');
    }
  }, [threadOrder, selectedConversationId, uploadedData.conversations]);

  // Navigation handlers
  const handlePreviousConversation = () => {
    console.log('🔄 Previous conversation clicked', { 
      currentConversationIndex, 
      allConversationsLength: allConversations.length,
      hasPrevious: currentConversationIndex > 0,
      allIds: allConversations.map(c => c.id)
    });
    
    if (currentConversationIndex > 0 && allConversations.length > 0) {
      const newIndex = currentConversationIndex - 1;
      const conversation = allConversations[newIndex];
      console.log('🔄 Navigating to previous conversation:', conversation.id, 'at index', newIndex);
      setSelectedConversationId(conversation.id);
      setShowConversationOverlay(true);
      
      // Mark conversation as viewed through ThreadsOverview callback
      handleConversationViewed(conversation.id);
      
      // Clear any previously selected thread
      setSelectedThread(undefined);
    } else {
      console.log('❌ Cannot navigate to previous - no previous conversation available');
    }
  };

  const handleNextConversation = () => {
    console.log('🔄 Next conversation clicked', { 
      currentConversationIndex, 
      allConversationsLength: allConversations.length,
      hasNext: currentConversationIndex >= 0 && currentConversationIndex < allConversations.length - 1,
      allIds: allConversations.map(c => c.id)
    });
    
    if (currentConversationIndex >= 0 && currentConversationIndex < allConversations.length - 1) {
      const newIndex = currentConversationIndex + 1;
      const conversation = allConversations[newIndex];
      console.log('🔄 Navigating to next conversation:', conversation.id, 'at index', newIndex);
      setSelectedConversationId(conversation.id);
      setShowConversationOverlay(true);
      
      // Mark conversation as viewed through ThreadsOverview callback
      handleConversationViewed(conversation.id);
      
      // Clear any previously selected thread
      setSelectedThread(undefined);
    } else {
      console.log('❌ Cannot navigate to next - no next conversation available');
    }
  };

  // Check if navigation is available
  const hasPreviousConversation = currentConversationIndex > 0;
  const hasNextConversation = currentConversationIndex >= 0 && currentConversationIndex < allConversations.length - 1;
  
  // Debug navigation state (remove this after fixing)
  console.log('🔍 Navigation state:', { 
    currentConversationIndex, 
    allConversationsCount: allConversations.length,
    hasPreviousConversation, 
    hasNextConversation,
    selectedConversationId,
    allConversationIds: allConversations.map(c => c.id),
    fetchedConversationsMapSize: fetchedConversationsMap.size,
    threadOrderLength: threadOrder.length,
    uploadedConversationsCount: uploadedData.conversations?.length || 0
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

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowConversationOverlay(true);
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
                <h1 className="text-xl font-bold">CHECK24 Bot Dashboard</h1>
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
                    className="w-48 pr-10 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
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
            />
          </div>
        </div>
      )}
    </div>
  );
}