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
  EyeOff
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
  const [activeTab, setActiveTab] = useState('threads');
  const [uploadedData, setUploadedData] = useState<UploadedData>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from localStorage on app start
    return localStorage.getItem('chatbot-dashboard-api-key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);

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
      setActiveTab('threads');
    } else if (data.conversations?.length) {
      // Stay on threads (dashboard) tab to show conversation overview
      setActiveTab('threads');
      setSelectedConversationId(data.conversations[0].id);
    } else if (data.attributesResponses?.length || data.bulkAttributesResponses?.length) {
      setActiveTab('attributes');
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <ThreadsOverview
            uploadedThreads={uploadedThreads}
            uploadedConversations={uploadedData.conversations || []}
            onThreadSelect={handleThreadSelect}
            onConversationSelect={handleConversationSelect}
          />
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
            />
          </div>
        </div>
      )}
    </div>
  );
}