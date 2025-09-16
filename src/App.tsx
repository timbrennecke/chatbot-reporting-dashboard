import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Alert, AlertDescription } from './components/ui/alert';
import { 
  BarChart3, 
  MessageSquare, 
  Settings, 
  Upload,
  Info,
  Trash2
} from 'lucide-react';
import { Badge } from './components/ui/badge';

import { ThreadsOverview } from './components/ThreadsOverview';
import { ConversationDetail } from './components/ConversationDetail';
import { AttributesView } from './components/AttributesView';
import { JsonUpload } from './components/JsonUpload';
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
  const [showConversationOverlay, setShowConversationOverlay] = useState(false);

  const handleDataUploaded = (data: UploadedData) => {
    setUploadedData(prevData => {
      // Merge new data with existing data
      const merged: UploadedData = {
        conversations: [
          ...(prevData.conversations || []),
          ...(data.conversations || [])
        ],
        threadsResponse: data.threadsResponse || prevData.threadsResponse,
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
  };



  const handleThreadSelect = (thread: Thread) => {
    setSelectedThread(thread);
    setActiveTab('conversation');
    setSelectedConversationId(thread.conversationId);
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
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">CHECK24 Chatbot Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Analyze conversations, threads, and attributes
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation */}
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="threads" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
              {(uploadedThreads.length > 0 || uploadedData.conversations?.length > 0) && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {uploadedThreads.length + (uploadedData.conversations?.length || 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attributes" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Attributes
              {(uploadedData.attributesResponses?.length > 0 || uploadedData.bulkAttributesResponses?.length > 0) && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {(uploadedData.attributesResponses?.length || 0) + (uploadedData.bulkAttributesResponses?.length || 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Data
            </TabsTrigger>
          </TabsList>



          {/* Tab Content */}
          <TabsContent value="threads" className="space-y-6">
            <ThreadsOverview
              uploadedThreads={uploadedThreads}
              uploadedConversations={uploadedData.conversations || []}
              onThreadSelect={handleThreadSelect}
              onConversationSelect={handleConversationSelect}
            />
          </TabsContent>



          <TabsContent value="attributes" className="space-y-6">
            <AttributesView
              uploadedAttributes={uploadedData.attributesResponses}
              uploadedBulkAttributes={uploadedData.bulkAttributesResponses}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <JsonUpload 
              onDataUploaded={handleDataUploaded} 
              onDataCleared={handleDataCleared}
            />
            
            {/* Usage Instructions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Data Source Modes</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-600">Live API Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      Use the forms in each tab to fetch data directly from the CHECK24 API endpoints.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-600">Offline JSON Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload JSON files or paste JSON content that matches the exact API response schemas. 
                      The dashboard will validate and process the data identically to live API responses.
                    </p>
                  </div>


                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Supported JSON File Types:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Conversation:</strong> GET /conversation/:conversationId response</li>
                    <li>• <strong>Threads:</strong> POST /thread response</li>
                    <li>• <strong>Attributes:</strong> POST /attributes response</li>
                    <li>• <strong>Bulk Attributes:</strong> POST /attributes/bulk response</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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