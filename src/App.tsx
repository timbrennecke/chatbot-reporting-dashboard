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

import { ThreadsOverview } from './components/ThreadsOverview';
import { ConversationDetail } from './components/ConversationDetail';
import { UploadedData, Thread, Conversation } from './lib/types';
import { setGlobalOfflineMode } from './lib/api';
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
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from localStorage on app start
    return localStorage.getItem('chatbot-dashboard-api-key') || '';
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

  // Save API key to localStorage
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    localStorage.setItem('chatbot-dashboard-api-key', newApiKey);
    console.log('🔑 API key saved to localStorage from dashboard');
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
      const conversationResponse = await fetch(`/api-test/conversation/${conversationSearchId.trim()}`, {
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
        const threadsResponse = await fetch('/api-test/thread', {
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
  };

  // Update all conversations list when data changes
  useEffect(() => {
    const conversations: Conversation[] = [];
    
    // Add uploaded conversations
    if (uploadedData.conversations) {
      conversations.push(...uploadedData.conversations);
      console.log('📚 Added uploaded conversations:', uploadedData.conversations.length);
    }
    
    // Add fetched conversations from threads
    if (fetchedConversationsMap.size > 0) {
      const fetchedConversations = Array.from(fetchedConversationsMap.values());
      conversations.push(...fetchedConversations);
      console.log('📚 Added fetched conversations:', fetchedConversations.length);
    }
    
    // Sort by creation date (most recent first)
    conversations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setAllConversations(conversations);
    console.log('📚 All conversations updated:', conversations.length, 'total');
    console.log('📚 Conversations available:', conversations.map(c => c.id));
    
    // Update current conversation index when selectedConversationId changes
    if (selectedConversationId) {
      const index = conversations.findIndex(conv => conv.id === selectedConversationId);
      console.log('🔍 Finding conversation index for', selectedConversationId, '-> index:', index);
      setCurrentConversationIndex(index);
    } else {
      setCurrentConversationIndex(-1);
    }
  }, [uploadedData, fetchedConversationsMap, selectedConversationId]);

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
    allConversationIds: allConversations.map(c => c.id)
  });

  // Load data from localStorage on component mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('chatbot-dashboard-data');
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
      console.error('Failed to load saved data:', error);
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
      
      // Save to localStorage
      try {
        localStorage.setItem('chatbot-dashboard-data', JSON.stringify(merged));
      } catch (error) {
        console.error('Failed to save data to localStorage:', error);
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
    
    // Clear from localStorage
    try {
      localStorage.removeItem('chatbot-dashboard-data');
    } catch (error) {
      console.error('Failed to clear data from localStorage:', error);
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
              uploadedThreads={uploadedThreads}
              uploadedConversations={uploadedData.conversations || []}
              onThreadSelect={handleThreadSelect}
              onConversationSelect={handleConversationSelect}
              onFetchedConversationsChange={handleFetchedConversationsChange}
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