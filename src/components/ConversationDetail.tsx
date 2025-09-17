import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  User, 
  Bot, 
  Clock, 
  MessageSquare, 
  Zap, 
  ExternalLink, 
  AlertCircle, 
  BarChart3,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  Key
} from 'lucide-react';
import { Conversation, Thread, Message, MessageContent } from '../lib/types';
import { formatTimestamp, parseThreadId } from '../lib/utils';

interface ConversationDetailProps {
  conversation?: Conversation;
  conversationId?: string;
  uploadedConversation?: Conversation; // Add this to match App.tsx
  selectedThread?: Thread;
  onThreadSelect?: (threadId: string) => void;
  error?: string;
  isOfflineMode?: boolean;
  hasAnyUploadedConversations?: boolean; // Add this to match App.tsx
}

interface ConversationAnalytics {
  totalMessages: number;
  totalUiEvents: number;
  totalLinkouts: number;
  avgMessageLength: number;
}

// Helper function to count messages excluding UI components
function countMessagesExcludingUI(messages: Message[]): number {
  return messages.filter(message => {
    if (message.role === 'system') return false;
    const hasUiComponent = message.content.some(content => content.kind === 'ui');
    return !hasUiComponent;
  }).length;
}

function cleanText(text: string): string {
  // More conservative approach - only fix obvious fragmentation patterns
  let cleaned = text
    // Fix single character fragments with spaces (like "K ar ls" -> "Karls")
    // Only join single characters or very short fragments that are clearly part of a word
    .replace(/\b(\w{1,2})\s+(\w{1,3})\b/g, (match, part1, part2, offset, string) => {
      // Check if this looks like a fragmented word by looking at context
      const before = string.substring(Math.max(0, offset - 10), offset);
      const after = string.substring(offset + match.length, offset + match.length + 10);
      
      // If surrounded by other short fragments, likely part of fragmentation
      if (before.match(/\w\s+\w\s*$/) || after.match(/^\s*\w\s+\w/)) {
        return part1 + part2;
      }
      
      // Keep as separate words if it doesn't look like fragmentation
      return match;
    })
    // Fix obvious cases where single letters are separated (like "a n d" -> "and")
    .replace(/\b(\w)\s+(\w)\s+(\w)\b/g, (match, c1, c2, c3) => {
      // Only join if all are single characters (likely fragmented short word)
      if (c1.length === 1 && c2.length === 1 && c3.length === 1) {
        return c1 + c2 + c3;
      }
      return match;
    })
    // Clean up excessive spaces (3+ spaces become 1)
    .replace(/\s{3,}/g, ' ')
    // Fix spaces around punctuation
    .replace(/\s+([.,!?;:\-*])/g, '$1')
    .replace(/([.,!?;:\-*])\s+/g, '$1 ')
    .trim();
  
  return cleaned;
}

function processMessageText(content: MessageContent[]): string {
  const textContents = content.filter(c => c.kind === 'text');
  
  if (textContents.length === 0) return '';
  
  // Enhanced logging to understand the structure
  console.log('📝 Text content analysis:', {
    totalTextItems: textContents.length,
    textItems: textContents.map((item, i) => ({
      index: i,
      hasText: !!item.text,
      hasContent: !!item.content,
      textLength: item.text?.length || 0,
      contentLength: item.content?.length || 0,
      textPreview: (item.text || item.content || '').substring(0, 50),
      fullItem: item
    }))
  });
  
  // Try different approaches based on the content structure
  if (textContents.length === 1) {
    // Single text item - use it directly
    const text = textContents[0].text || textContents[0].content || '';
    console.log('📝 Single text item:', { length: text.length, preview: text.substring(0, 100) });
    return text;
  } else {
    // Multiple text items - they might be fragments that need to be joined properly
    const combinedText = textContents
      .map(item => item.text || item.content || '')
      .filter(text => text.length > 0)
      .join(''); // Try joining without spaces first
      
    console.log('📝 Multiple text items combined:', { 
      itemCount: textContents.length,
      combinedLength: combinedText.length, 
      preview: combinedText.substring(0, 100) 
    });
    
    return combinedText;
  }
}

function consolidateMessageContent(content: MessageContent[]) {
  const textContents = content.filter(c => c.kind === 'text');
  const otherContents = content.filter(c => c.kind !== 'text');
  
  const consolidatedText = processMessageText(content);
    
  return { consolidatedText, otherContents };
}

export function ConversationDetail({ 
  conversation, 
  conversationId, 
  uploadedConversation,
  selectedThread, 
  onThreadSelect, 
  error,
  isOfflineMode = false,
  hasAnyUploadedConversations = false
}: ConversationDetailProps) {
  console.log('🔍 ConversationDetail rendered with props:', {
    hasConversation: !!conversation,
    conversationId,
    hasUploadedConversation: !!uploadedConversation,
    hasSelectedThread: !!selectedThread,
    selectedThreadId: selectedThread?.id,
    error,
    isOfflineMode,
    hasAnyUploadedConversations
  });
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [showPaginationPage, setShowPaginationPage] = useState(false);
  const [paginationConversationId, setPaginationConversationId] = useState(() => {
    const id = conversationId || conversation?.id || selectedThread?.conversationId || '';
    console.log('🆔 ConversationDetail Props:', {
      conversationId,
      conversationPropId: conversation?.id,
      uploadedConversationId: uploadedConversation?.id,
      uploadedConversationTitle: uploadedConversation?.title,
      selectedThreadConversationId: selectedThread?.conversationId,
      hasAnyUploadedConversations,
      finalId: id
    });
    return id;
  });
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResponse, setFetchResponse] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');
  const [fetchedConversation, setFetchedConversation] = useState<any>(null);
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from localStorage on component mount
    return localStorage.getItem('chatbot-dashboard-api-key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);

  const analytics = useMemo((): ConversationAnalytics | null => {
    if (!conversation) return null;
    
    let totalUiEvents = 0;
    let totalLinkouts = 0;
    let totalCharacters = 0;
    let messageCount = 0;
    
    conversation.messages.forEach(message => {
      const { consolidatedText } = consolidateMessageContent(message.content);
      if (consolidatedText) {
        totalCharacters += consolidatedText.length;
        messageCount++;
      }
      
      message.content.forEach(content => {
        if (content.kind === 'ui') totalUiEvents++;
        if (content.kind === 'linkout') totalLinkouts++;
      });
    });
    
    return {
      totalMessages: countMessagesExcludingUI(conversation.messages),
      totalUiEvents,
      totalLinkouts,
      avgMessageLength: messageCount > 0 ? totalCharacters / messageCount : 0
    };
  }, [conversation]);

  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    return conversation.messages.filter(message => showSystemMessages || message.role !== 'system');
  }, [conversation, showSystemMessages]);

  const handleFetchConversation = async () => {
    if (!paginationConversationId.trim()) return;
    
    if (!apiKey.trim()) {
      setFetchError('Please enter an API key first');
      return;
    }
    
    console.log('🔍 Fetching conversation:', paginationConversationId.trim());
    setFetchLoading(true);
    setFetchError('');
    setFetchedConversation(null);
    setFetchResponse('');
    
    try {
      const response = await fetch(`/api-test/conversation/${paginationConversationId.trim()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
      });
      const responseText = await response.text();
      console.log('📥 Raw response:', responseText.substring(0, 200) + '...');
      setFetchResponse(responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
      console.log('✅ Parsed conversation data:', {
        id: data.id,
        title: data.title,
        messagesCount: data.messages?.length || 0,
        fullStructure: data, // Log the complete structure
        firstMessage: data.messages?.[0], // Log complete first message
        messageRoles: data.messages?.map(m => ({ role: m.role, contentLength: m.content?.length })) || []
      });
      setFetchedConversation(data);
    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      
      // Provide more helpful error messages for common CORS/network issues
      let errorMessage = error.message || 'Failed to fetch conversation';
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to API. This might be due to CORS restrictions or network connectivity issues.';
      }
      
      setFetchError(errorMessage);
    } finally {
      setFetchLoading(false);
    }
  };

  const renderMessageContent = (content: MessageContent, index: number) => {
    const key = `${content.kind}-${index}`;
    
    switch (content.kind) {
      case 'ui':
        return (
          <div key={key} className="p-3 bg-purple-50/50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-purple-600" />
              <Badge variant="secondary">UI Component</Badge>
            </div>
            <div className="text-sm space-y-1">
              {content.ui?.namespace && (
                <div><strong>Namespace:</strong> {content.ui.namespace}</div>
              )}
              {content.ui?.identifier && (
                <div><strong>Identifier:</strong> {content.ui.identifier}</div>
              )}
              {content.ui?.props && (
                <div className="mt-2">
                  <strong>Props:</strong>
                  <pre className="text-xs bg-purple-100 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(content.ui.props, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'linkout':
        return (
          <div key={key} className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-blue-600" />
              <Badge variant="secondary">External Link</Badge>
            </div>
            <div className="text-sm">
              <strong>URL:</strong> 
              <a 
                href={content.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline ml-2"
              >
                {content.url}
              </a>
            </div>
          </div>
        );
      
      default:
        return (
          <div key={key} className="p-3 bg-gray-50/50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-gray-600" />
              <Badge variant="outline">{content.kind}</Badge>
            </div>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(content, null, 2)}
            </pre>
          </div>
        );
    }
  };

  if (!conversation && !selectedThread && !error && !isOfflineMode) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Conversation Detail</h1>
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Page - Fetch Conversation */}
      {!showPaginationPage && (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <h1>Conversation Detail</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPaginationPage(true);
                }}
                className="p-1 h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Fetch Section */}
          {!fetchedConversation && (
            <div className="max-w-md mx-auto mt-16">
              <Card>
                <CardHeader>
                  <CardTitle>Fetch Conversation</CardTitle>
                  <CardDescription>
                    Enter your API key and conversation ID to fetch data directly from the API
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* API Key Input - Prefilled and Disabled */}
                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative mt-1">
                      <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        readOnly
                        disabled
                        placeholder="Set API key in dashboard header"
                        className="pr-10 bg-muted text-muted-foreground cursor-not-allowed"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                        disabled={!apiKey}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {apiKey ? (
                        <>
                          <Key className="h-3 w-3 inline mr-1" />
                          API key configured in dashboard
                        </>
                      ) : (
                        <>
                          <Key className="h-3 w-3 inline mr-1" />
                          Please set API key in dashboard header first
                        </>
                      )}
                    </p>
                  </div>
                  
                  {/* Conversation ID Input */}
                  <div>
                    <Label htmlFor="conversation-id">Conversation ID</Label>
                    <Input
                      id="conversation-id"
                      value={paginationConversationId}
                      onChange={(e) => setPaginationConversationId(e.target.value)}
                      placeholder="Enter conversation ID"
                      className="mt-1"
                    />
                  </div>
                  
                  <Button 
                    variant="default"
                    className="w-full bg-black hover:bg-black/90 text-white border-black"
                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    onClick={handleFetchConversation}
                    disabled={fetchLoading || !paginationConversationId.trim() || !apiKey.trim()}
                  >
                    {fetchLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      'Fetch'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error Display */}
          {fetchError && (
            <div className="max-w-4xl mx-auto mt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fetchError}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Fetched Conversation Display - Page 1 uses ONLY fetched data */}
          {fetchedConversation && (
            <div className="space-y-6">
              {/* Conversation Header */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{fetchedConversation.title || 'Fetched Conversation'}</CardTitle>
                      <CardDescription>ID: {fetchedConversation.id}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      {countMessagesExcludingUI(fetchedConversation.messages || [])} messages
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Created</Label>
                      <p className="text-sm">{formatTimestamp(fetchedConversation.createdAt)}</p>
                    </div>
                    <div>
                      <Label>Last Message</Label>
                      <p className="text-sm">{formatTimestamp(fetchedConversation.lastMessageAt)}</p>
                    </div>
                    <div>
                      <Label>Thread Count</Label>
                      <p className="text-sm">{fetchedConversation.threadIds?.length || 0} threads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Message Timeline */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Message Timeline</CardTitle>
                    <CardDescription>
                      Chronological view of all messages from fetched conversation data
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      console.log('🔍 PAGE 1 - Rendering messages from FETCHED conversation:', {
                        totalMessages: fetchedConversation.messages?.length || 0,
                        showSystemMessages,
                        filteredMessages: fetchedConversation.messages?.filter(message => showSystemMessages || message.role !== 'system').length || 0,
                        firstMessage: fetchedConversation.messages?.[0]
                      });
                      return fetchedConversation.messages
                        ?.filter(message => showSystemMessages || message.role !== 'system')
                        ?.map((message, index) => {
                        const { consolidatedText, otherContents } = consolidateMessageContent(message.content || []);
                        
                        return (
                        <div key={message.id} className={`border-l-4 pl-6 py-4 ${
                          message.role === 'system' ? 'border-l-orange-500 bg-orange-50/30' :
                          message.role === 'assistant' ? 'border-l-blue-500 bg-blue-50/20' : 'border-l-green-500 bg-green-50/20'
                        } rounded-r-lg`}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-2">
                              {message.role === 'assistant' ? (
                                <Bot className="h-4 w-4 text-blue-600" />
                              ) : message.role === 'system' ? (
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                              ) : (
                                <User className="h-4 w-4 text-green-600" />
                              )}
                              <span className="font-medium text-sm capitalize">
                                {message.role}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(message.sentAt)}
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            {/* Main text content - natural styling */}
                            {consolidatedText && (
                              <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                                  {consolidatedText}
                                </p>
                              </div>
                            )}
                            
                            {/* Other content types (UI components, linkouts, etc.) */}
                            {otherContents.length > 0 && (
                              <div className="space-y-2 mt-3">
                                {otherContents.map((content, contentIndex) => 
                                  renderMessageContent(content, contentIndex)
                                )}
                              </div>
                            )}
                            
                            {/* Show debug info only if no content at all */}
                            {!consolidatedText && otherContents.length === 0 && (message.content || []).length > 0 && (
                              <div className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded border border-yellow-200">
                                <strong>Debug:</strong> No displayable content found. Content items: {(message.content || []).map((c, i) => `${i}: ${c.kind}`).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      }) || [];
                    })()}
                  </div>
                </CardContent>
              </Card>


              {/* Collapsible JSON Output */}
              {fetchResponse && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Raw JSON Response</CardTitle>
                        <CardDescription>
                          View the raw API response data
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowJsonOutput(!showJsonOutput)}
                        className="flex items-center gap-2"
                      >
                        {showJsonOutput ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Hide JSON
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4" />
                            Show JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {showJsonOutput && (
                    <CardContent>
                      <div className="relative">
                        <div 
                          className="bg-muted/50 rounded-lg border overflow-auto p-4"
                          style={{ height: '320px', maxHeight: '320px' }}
                        >
                          <pre className="text-sm text-muted-foreground font-mono whitespace-pre-wrap break-words">
                            {fetchResponse}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Pagination Page - Tool calls/Events */}
      {showPaginationPage && ((() => {
        console.log('🔍 DEBUGGING: Rendering second page with data:', {
          showPaginationPage,
          hasUploadedConversation: !!uploadedConversation,
          hasSelectedThread: !!selectedThread,
          uploadedConversationId: uploadedConversation?.id,
          selectedThreadId: selectedThread?.id,
          selectedThreadConversationId: selectedThread?.conversationId
        });
        return true;
      })() &&
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
          <div className="container mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => setShowPaginationPage(false)}
                className="flex items-center gap-2"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1>Tool calls/Events</h1>
                <p className="text-muted-foreground">
                  System messages, tool calls, and UI events from this conversation
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              {(() => {
                console.log('🔍 DEBUGGING: About to render content with:', {
                  hasUploadedConversation: !!uploadedConversation,
                  hasSelectedThread: !!selectedThread,
                  uploadedConversationMessagesLength: uploadedConversation?.messages?.length,
                  selectedThreadMessagesLength: selectedThread?.messages?.length
                });
                return null; // This just runs the console.log
              })()}
              
              {/* Page 2 uses uploaded conversation data OR thread data */}
              {(uploadedConversation || selectedThread) ? (
                <>
                  {/* Conversation/Thread Header */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>
                            {uploadedConversation?.title || `Thread ${selectedThread?.id}`}
                          </CardTitle>
                          <CardDescription>
                            ID: {uploadedConversation?.id || selectedThread?.conversationId}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {uploadedConversation 
                            ? countMessagesExcludingUI(uploadedConversation.messages)
                            : countMessagesExcludingUI(selectedThread?.messages || [])
                          } messages
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Created</Label>
                          <p className="text-sm">
                            {formatTimestamp(uploadedConversation?.createdAt || selectedThread?.createdAt || '')}
                          </p>
                        </div>
                        <div>
                          <Label>Data Source</Label>
                          <p className="text-sm">
                            {uploadedConversation ? 'Uploaded Conversation' : 'API Thread Data'}
                          </p>
                        </div>
                        <div>
                          <Label>Thread ID</Label>
                          <p className="text-sm font-mono text-xs">
                            {selectedThread?.id || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tool calls/Events */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>Tool calls/Events</CardTitle>
                          <CardDescription>
                            {showAllMessages 
                              ? `All messages from ${uploadedConversation ? 'uploaded conversation data' : 'API thread data'}`
                              : `System messages and UI components from ${uploadedConversation ? 'uploaded conversation data' : 'API thread data'}`
                            }
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllMessages(!showAllMessages)}
                          className="flex items-center gap-2"
                        >
                          {showAllMessages ? (
                            <>
                              <EyeOff className="h-4 w-4" />
                              Show Filtered
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              Show All
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(() => {
                          try {
                            // Use either uploaded conversation or thread data
                            const messages = uploadedConversation?.messages || selectedThread?.messages || [];
                            const dataSource = uploadedConversation ? 'UPLOADED' : 'THREAD';
                            
                            console.log(`🔧 PAGE 2 - Tool calls/Events - Using ${dataSource} data:`, {
                              totalMessages: messages.length,
                              systemMessages: messages.filter(m => m.role === 'system').length,
                              uiMessages: messages.filter(m => m.content?.some(c => c.kind === 'ui')).length,
                              firstSystemMessage: messages.find(m => m.role === 'system'),
                              dataSource,
                              threadId: selectedThread?.id,
                              conversationId: uploadedConversation?.id || selectedThread?.conversationId
                            });
                            
                            return messages
                              ?.filter(message => {
                                // If showing all messages, don't filter
                                if (showAllMessages) {
                                  return true;
                                }
                                
                                // Default: Show system messages or messages with UI components
                                const isSystem = message.role === 'system';
                                const hasUI = message.content?.some(content => content.kind === 'ui');
                                return isSystem || hasUI;
                              })
                              ?.map((message, index) => {
                                const { consolidatedText, otherContents } = consolidateMessageContent(message.content || []);
                                const isSystemMessage = message.role === 'system';

                                // Determine message styling based on role
                                const getBorderColor = () => {
                                  if (message.role === 'system') return 'border-l-orange-500 bg-orange-50/30';
                                  if (message.role === 'assistant') return 'border-l-blue-500 bg-blue-50/30';
                                  if (message.role === 'user') return 'border-l-green-500 bg-green-50/30';
                                  return 'border-l-gray-500 bg-gray-50/30';
                                };

                                const getIcon = () => {
                                  if (message.role === 'system') return <AlertCircle className="h-5 w-5 text-orange-600" />;
                                  if (message.role === 'assistant') return <Bot className="h-5 w-5 text-blue-600" />;
                                  if (message.role === 'user') return <User className="h-5 w-5 text-green-600" />;
                                  return <MessageSquare className="h-5 w-5 text-gray-600" />;
                                };

                                const getBadgeVariant = () => {
                                  if (message.role === 'system') return 'destructive';
                                  if (message.role === 'assistant') return 'default';
                                  if (message.role === 'user') return 'secondary';
                                  return 'outline';
                                };

                                const getLabel = () => {
                                  if (message.role === 'system') return 'System';
                                  if (message.role === 'assistant') return 'Assistant';
                                  if (message.role === 'user') return 'User';
                                  return message.role || 'Unknown';
                                };

                                return (
                                  <div key={message.id} className={`border-l-4 pl-4 py-2 ${getBorderColor()}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                      {getIcon()}
                                      <Badge variant={getBadgeVariant()}>
                                        {getLabel()}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTimestamp(message.sentAt)}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {message.content?.length || 0} content item(s)
                                      </Badge>
                                    </div>

                                    <div className="space-y-3 ml-7">
                                      {/* Show text content for all message types */}
                                      {consolidatedText && (
                                        <div className={`p-3 rounded-lg ${
                                          message.role === 'system' ? 'bg-orange-50/50' :
                                          message.role === 'assistant' ? 'bg-blue-50/50' :
                                          message.role === 'user' ? 'bg-green-50/50' :
                                          'bg-gray-50/50'
                                        }`}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare className="h-4 w-4" />
                                            <Badge variant="secondary">
                                              {message.role === 'system' ? 'System Message' :
                                               message.role === 'assistant' ? 'Assistant Response' :
                                               message.role === 'user' ? 'User Message' :
                                               'Message'}
                                            </Badge>
                                          </div>
                                          <p className="whitespace-pre-wrap">{consolidatedText}</p>
                                        </div>
                                      )}

                                      {/* Show UI components and other special content */}
                                      {otherContents.map((content, contentIndex) =>
                                        renderMessageContent(content, contentIndex)
                                      )}
                                    </div>
                                  </div>
                                );
                              }) || [];
                          } catch (error) {
                            console.error('🚨 ERROR rendering messages:', error);
                            return (
                              <div className="text-center py-8 text-red-500">
                                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                                <p>Error rendering messages. Check console for details.</p>
                              </div>
                            );
                          }
                        })()}
                        
                        {/* Show message if no messages found based on current filter */}
                        {(() => {
                          const messages = uploadedConversation?.messages || selectedThread?.messages || [];
                          
                          let filteredMessages;
                          if (showAllMessages) {
                            filteredMessages = messages;
                          } else {
                            filteredMessages = messages.filter(message => 
                              message.role === 'system' || message.content?.some(content => content.kind === 'ui')
                            );
                          }
                          
                          return filteredMessages.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                              <p>
                                {showAllMessages 
                                  ? `No messages found in ${uploadedConversation ? 'uploaded conversation data' : 'thread data'}.`
                                  : `No system messages or UI events found in ${uploadedConversation ? 'uploaded conversation data' : 'thread data'}. Click "Show All" to see all messages.`
                                }
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-16">
                  <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Conversation or Thread Data</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload conversation data or select a thread from the API search results to view tool calls and events here.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPaginationPage(false)}
                  >
                    ← Back to Dashboard
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}