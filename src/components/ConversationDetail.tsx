import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  Copy,
  Check
} from 'lucide-react';
import { Conversation, Thread, Message, MessageContent } from '../lib/types';
import { getApiBaseUrl, getEnvironmentSpecificItem } from '../lib/api';
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
  // Navigation props
  onPreviousConversation?: () => void;
  onNextConversation?: () => void;
  hasPreviousConversation?: boolean;
  hasNextConversation?: boolean;
  // Callback to notify parent when a conversation is fetched
  onConversationFetched?: (conversation: any) => void;
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

// Function to merge ONLY thread system messages with conversation messages chronologically
function mergeMessagesChronologically(conversationMessages: Message[], threadMessages: Message[]): Message[] {
  // Get only system messages from thread endpoint
  const threadSystemMessages = threadMessages.filter(msg => msg.role === 'system');
  
  // Combine conversation messages (user/assistant) with thread system messages
  const allMessages = [...conversationMessages, ...threadSystemMessages];

  // Sort by sentAt timestamp chronologically
  return allMessages.sort((a, b) => {
    const timeA = new Date(a.sentAt).getTime();
    const timeB = new Date(b.sentAt).getTime();
    return timeA - timeB;
  });
}

export function ConversationDetail({ 
  conversation, 
  conversationId, 
  uploadedConversation,
  selectedThread, 
  onThreadSelect, 
  error,
  isOfflineMode = false,
  hasAnyUploadedConversations = false,
  onPreviousConversation,
  onNextConversation,
  hasPreviousConversation = false,
  hasNextConversation = false,
  onConversationFetched
}: ConversationDetailProps) {
  
  
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [paginationConversationId, setPaginationConversationId] = useState(() => {
    const id = conversationId || conversation?.id || selectedThread?.conversationId || '';
    return id;
  });
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResponse, setFetchResponse] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');
  const [fetchedConversation, setFetchedConversation] = useState<any>(null);
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from environment-specific localStorage on component mount
    return getEnvironmentSpecificItem('chatbot-dashboard-api-key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Determine which conversation data to use
  const activeConversation = useMemo(() => {
    return conversation || uploadedConversation || fetchedConversation;
  }, [conversation, uploadedConversation, fetchedConversation]);

  // Auto-fetch conversation when component mounts or conversation ID changes
  useEffect(() => {
    const shouldAutoFetch = 
      paginationConversationId.trim() && // Has conversation ID
      apiKey.trim() && // Has API key
      !uploadedConversation && // No uploaded conversation data
      !fetchedConversation && // Not already fetched
      !fetchLoading; // Not currently loading

    if (shouldAutoFetch) {
      handleFetchConversation();
    }
  }, [paginationConversationId, apiKey, uploadedConversation, fetchedConversation, fetchLoading]);

  // Clear fetched conversation when conversation ID changes (for navigation)
  useEffect(() => {
    const newId = conversationId || conversation?.id || selectedThread?.conversationId || '';
    if (newId && newId !== paginationConversationId && fetchedConversation) {
      console.log('🔄 Conversation ID changed, clearing fetched data and refetching:', newId);
      setFetchedConversation(null);
      setPaginationConversationId(newId);
    }
  }, [conversationId, conversation?.id, selectedThread?.conversationId, paginationConversationId, fetchedConversation]);

  const analytics = useMemo((): ConversationAnalytics | null => {
    if (!activeConversation) return null;
    
    let totalUiEvents = 0;
    let totalLinkouts = 0;
    let totalCharacters = 0;
    let messageCount = 0;
    
    activeConversation.messages.forEach(message => {
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
      totalMessages: countMessagesExcludingUI(activeConversation.messages),
      totalUiEvents,
      totalLinkouts,
      avgMessageLength: messageCount > 0 ? totalCharacters / messageCount : 0
    };
  }, [activeConversation]);

  const filteredMessages = useMemo(() => {
    if (!activeConversation) return [];
    return activeConversation.messages.filter(message => showSystemMessages || message.role !== 'system');
  }, [activeConversation, showSystemMessages]);

  const handleFetchConversation = async () => {
    if (!paginationConversationId.trim()) return;
    
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
      const response = await fetch(`${apiBaseUrl}/conversation/${paginationConversationId.trim()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
      });
      const responseText = await response.text();
      setFetchResponse(responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
      setFetchedConversation(data);
      
      // Notify parent component about the fetched conversation
      onConversationFetched?.(data);
      
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
          <div key={key} className="p-4 bg-purple-50/70 rounded-xl border border-purple-100 shadow-sm">
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
          <div key={key} className="p-4 bg-blue-50/70 rounded-xl border border-blue-100 shadow-sm">
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
          <div key={key} className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 shadow-sm">
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

  
  if (!activeConversation && !selectedThread && !error && !isOfflineMode && !fetchLoading) {
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h1>Conversation Detail</h1>
        </div>
      </div>

      {/* Uploaded Conversation Display */}
      {uploadedConversation && (
        <div className="space-y-6">
          {/* Conversation Header */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-slate-800">{uploadedConversation.title || 'Uploaded Conversation'}</CardTitle>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-2">
                      <CardDescription className="text-slate-600">Conversation ID: {uploadedConversation.id}</CardDescription>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(uploadedConversation.id, 'uploaded-conversation')}
                        className="h-6 w-6 p-0 hover:bg-slate-100"
                        title="Copy Conversation ID"
                      >
                        {copiedId === 'uploaded-conversation' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-500" />
                        )}
                      </Button>
                    </div>
                    {selectedThread?.id && (
                      <div className="flex items-center gap-2">
                        <CardDescription className="text-slate-600">Thread ID: {selectedThread.id}</CardDescription>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedThread.id, 'uploaded-thread')}
                          className="h-6 w-6 p-0 hover:bg-slate-100"
                          title="Copy Thread ID"
                        >
                          {copiedId === 'uploaded-thread' ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-500" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Navigation Arrows */}
                <div className="flex items-center gap-3 mr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log('🔄 Previous button clicked!', { hasPreviousConversation, onPreviousConversation });
                      onPreviousConversation?.();
                    }}
                    disabled={!hasPreviousConversation}
                    className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasPreviousConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Previous Chat"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">Previous Chat</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log('🔄 Next button clicked!', { hasNextConversation, onNextConversation });
                      onNextConversation?.();
                    }}
                    disabled={!hasNextConversation}
                    className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasNextConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Next Chat"
                  >
                    <span className="text-sm font-medium">Next Chat</span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                  {countMessagesExcludingUI(uploadedConversation.messages || [])} messages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{formatTimestamp(uploadedConversation.createdAt)}</p>
                </div>
                <div>
                  <Label>Last Message</Label>
                  <p className="text-sm">{formatTimestamp(uploadedConversation.lastMessageAt)}</p>
                </div>
                <div>
                  <Label>Thread Count</Label>
                  <p className="text-sm">{uploadedConversation.threadIds?.length || 0} threads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Timeline */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-slate-800">💬 Message Timeline</CardTitle>
                  <CardDescription className="text-slate-600">
                    Chronological view of conversation messages
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemMessages(!showSystemMessages)}
                  className="flex items-center gap-2"
                >
                  {showSystemMessages ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide System
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show System
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg">
              <div className="max-h-[70vh] overflow-y-auto px-6 py-8 space-y-4">
                {(() => {
                  // Merge uploaded conversation messages with thread system messages chronologically
                  const conversationMessages = uploadedConversation.messages || [];
                  const threadMessages = selectedThread?.messages || [];
                  const mergedMessages = mergeMessagesChronologically(conversationMessages, threadMessages);
                  
                  const filteredMessages = mergedMessages
                    .filter(message => {
                      // Always show user and assistant messages
                      if (message.role === 'user' || message.role === 'assistant') return true;
                      // Show system messages based on toggle
                      if (message.role === 'system') return showSystemMessages;
                      return true;
                    });
                  
                  return filteredMessages.map((message, index) => {
                  const { consolidatedText, otherContents } = consolidateMessageContent(message.content || []);
                  
                  return (
                    <div key={message.id} className={`flex gap-4 mb-8 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      {/* Avatar - only for assistant and system messages (left side) */}
                      {message.role !== 'user' && (
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
                          message.role === 'assistant' ? 'bg-slate-100 border-slate-200' :
                          message.role === 'system' ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
                        }`}>
                          {message.role === 'assistant' ? (
                            <Bot className="h-5 w-5 text-slate-600" />
                          ) : message.role === 'system' ? (
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          ) : (
                            <User className="h-5 w-5 text-slate-600" />
                          )}
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div className={`max-w-[70%] ${message.role === 'system' ? 'max-w-[90%]' : ''}`}>
                        {/* Message header with role and timestamp */}
                        <div className={`flex items-center gap-2 mb-2 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            message.role === 'user' ? 'bg-blue-50 text-blue-700' :
                            message.role === 'assistant' ? 'bg-green-50 text-green-700' :
                            message.role === 'system' ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(message.sentAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(consolidatedText, `message-${message.id}`)}
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                            title="Copy message content"
                          >
                            {copiedId === `message-${message.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-slate-500" />
                            )}
                          </Button>
                        </div>
                        
                        {/* Message content bubble */}
                        <div 
                          className={`!rounded-2xl !px-6 !py-6 shadow-sm !border ${
                            message.role === 'user' 
                              ? 'bg-blue-50 text-slate-800 ml-auto border-blue-200' 
                              : message.role === 'assistant'
                              ? 'bg-slate-50 text-slate-800 border-green-200 shadow-sm'
                              : message.role === 'system'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-slate-50 text-slate-800 border-slate-200'
                          }`}
                          style={{
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            border: '1px solid',
                            borderColor: message.role === 'user' ? '#bfdbfe' : message.role === 'system' ? '#fde68a' : message.role === 'assistant' ? '#bbf7d0' : '#e2e8f0',
                            ...(message.role === 'system' && {
                              maxHeight: '320px',
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              wordWrap: 'break-word',
                              wordBreak: 'break-word'
                            })
                          }}
                        >
                          {/* Text content */}
                          {consolidatedText && (
                            <div className="prose prose-sm max-w-none">
                              <p className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
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
                        </div>
                      </div>
                      
                      {/* Avatar for user messages (right side) */}
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-green-100 to-green-200 flex items-center justify-center shadow-md border-2 border-green-300">
                          <User className="h-5 w-5 text-green-700" />
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fetch Section */}
      {!fetchedConversation && !uploadedConversation && (
        <div className="max-w-md mx-auto mt-16">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {fetchLoading ? 'Fetching Conversation...' : 'Fetch Conversation'}
                  </CardTitle>
                  <CardDescription>
                    {fetchLoading 
                      ? `Loading conversation data for ${paginationConversationId}...`
                      : 'Enter your API key and conversation ID to fetch data directly from the API'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fetchLoading ? (
                    // Auto-fetch loading state
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Fetching conversation data...
                      </p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-slate-800">{fetchedConversation.title || 'Fetched Conversation'}</CardTitle>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-2">
                          <CardDescription className="text-slate-600">Conversation ID: {fetchedConversation.id}</CardDescription>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(fetchedConversation.id, 'fetched-conversation')}
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                            title="Copy Conversation ID"
                          >
                            {copiedId === 'fetched-conversation' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-slate-500" />
                            )}
                          </Button>
                        </div>
                        {selectedThread?.id && (
                          <div className="flex items-center gap-2">
                            <CardDescription className="text-slate-600">Thread ID: {selectedThread.id}</CardDescription>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(selectedThread.id, 'fetched-thread')}
                              className="h-6 w-6 p-0 hover:bg-slate-100"
                              title="Copy Thread ID"
                            >
                              {copiedId === 'fetched-thread' ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-500" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Navigation Arrows */}
                    <div className="flex items-center gap-3 mr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log('🔄 Previous button clicked (fetched)!', { hasPreviousConversation, onPreviousConversation });
                          onPreviousConversation?.();
                        }}
                        disabled={!hasPreviousConversation}
                        className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasPreviousConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                        title="Previous Chat"
                      >
                        <ChevronLeft className="h-5 w-5" />
                        <span className="text-sm font-medium">Previous Chat</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log('🔄 Next button clicked (fetched)!', { hasNextConversation, onNextConversation });
                          onNextConversation?.();
                        }}
                        disabled={!hasNextConversation}
                        className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasNextConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                        title="Next Chat"
                      >
                        <span className="text-sm font-medium">Next Chat</span>
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
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
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-slate-800">💬 Message Timeline</CardTitle>
                      <CardDescription className="text-slate-600">
                        Chronological view of conversation messages with system messages from thread data
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSystemMessages(!showSystemMessages)}
                      className="flex items-center gap-2"
                    >
                      {showSystemMessages ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          Hide System
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Show System
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg">
                  <div className="max-h-[70vh] overflow-y-auto px-6 py-8 space-y-4">
                    {(() => {
                      // Merge conversation messages with thread system messages chronologically
                      const conversationMessages = fetchedConversation.messages || [];
                      const threadMessages = selectedThread?.messages || [];
                      const mergedMessages = mergeMessagesChronologically(conversationMessages, threadMessages);
                      
                      
                      return mergedMessages
                        ?.filter(message => {
                          // Always show user and assistant messages
                          if (message.role === 'user' || message.role === 'assistant') return true;
                          // Show system messages based on toggle
                          if (message.role === 'system') return showSystemMessages;
                          return true;
                        })
                        ?.map((message, index) => {
                        const { consolidatedText, otherContents } = consolidateMessageContent(message.content || []);
                        
                        
                        return (
                        <div key={message.id} className={`flex gap-4 mb-8 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          {/* Avatar - only for assistant and system messages (left side) */}
                          {message.role !== 'user' && (
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
                              message.role === 'assistant' ? 'bg-slate-100 border-slate-200' :
                              message.role === 'system' ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
                            }`}>
                              {message.role === 'assistant' ? (
                                <Bot className="h-5 w-5 text-slate-600" />
                              ) : message.role === 'system' ? (
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                              ) : (
                                <User className="h-5 w-5 text-slate-600" />
                              )}
                            </div>
                          )}
                          
                          {/* Message bubble */}
                          <div className={`max-w-[70%] ${message.role === 'system' ? 'max-w-[90%]' : ''}`}>
                            {/* Message header with role and timestamp */}
                            <div className={`flex items-center gap-2 mb-2 ${
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}>
                              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                message.role === 'user' ? 'bg-blue-50 text-blue-700' :
                                message.role === 'assistant' ? 'bg-green-50 text-green-700' :
                                message.role === 'system' ? 'bg-red-50 text-red-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(message.sentAt)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(consolidatedText, `message-${message.id}`)}
                                className="h-6 w-6 p-0 hover:bg-slate-100"
                                title="Copy message content"
                              >
                                {copiedId === `message-${message.id}` ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-slate-500" />
                                )}
                              </Button>
                            </div>
                            
                            {/* Message content bubble */}
                            <div 
                              className={`!rounded-2xl !px-6 !py-6 shadow-sm !border ${
                                message.role === 'user' 
                                  ? 'bg-blue-50 text-slate-800 ml-auto border-blue-200' 
                                  : message.role === 'assistant'
                                  ? 'bg-slate-50 text-slate-800 border-green-200 shadow-sm'
                                  : message.role === 'system'
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-slate-50 text-slate-800 border-slate-200'
                              }`}
                              style={{
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                border: '1px solid',
                                borderColor: message.role === 'user' ? '#bfdbfe' : message.role === 'system' ? '#fde68a' : message.role === 'assistant' ? '#bbf7d0' : '#e2e8f0',
                                ...(message.role === 'system' && {
                                  maxHeight: '320px',
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  wordWrap: 'break-word',
                                  wordBreak: 'break-word'
                                })
                              }}
                            >
                              {/* FORCE RENDER: Always show something for user messages */}
                              {message.role === 'user' ? (
                                <div className="text-slate-800 font-medium">
                                  {/* Try consolidated text first */}
                                  {consolidatedText ? (
                                    <p className="whitespace-pre-wrap leading-relaxed m-0 text-slate-800 text-base">
                                      {consolidatedText}
                                    </p>
                                  ) : (
                                    /* Fallback: try to extract text from any content item */
                                    <div>
                                      {(message.content || []).length > 0 ? (
                                        <div>
                                          {(message.content || []).map((content, idx) => (
                                            <div key={idx} className="mb-2">
                                              {content.text && (
                                                <p className="whitespace-pre-wrap m-0 text-slate-800">{content.text}</p>
                                              )}
                                              {content.content && typeof content.content === 'string' && (
                                                <p className="whitespace-pre-wrap m-0 text-slate-800">{content.content}</p>
                                              )}
                                              {!content.text && !content.content && (
                                                <p className="opacity-75 text-xs text-slate-600">
                                                  [{content.kind}] {JSON.stringify(content).substring(0, 200)}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="opacity-75 italic text-slate-600">No message content found</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* Non-user messages use the original logic */
                                <>
                                  {/* Main text content */}
                                  {consolidatedText && (
                                    <div className="prose prose-sm max-w-none">
                                      <p className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                                        {consolidatedText}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Debug: Show if there's no consolidated text but there is content */}
                                  {!consolidatedText && (message.content || []).length > 0 && (
                                    <div className="text-sm text-gray-800">
                                      <p>Content items: {(message.content || []).map((c, i) => `${i}: ${c.kind}`).join(', ')}</p>
                                      {(message.content || []).map((content, idx) => (
                                        <div key={idx} className="mt-1">
                                          <strong>{content.kind}:</strong> {content.text || content.content || JSON.stringify(content).substring(0, 100)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Other content types (UI components, linkouts, etc.) */}
                              {otherContents.length > 0 && (
                                <div className="space-y-2 mt-3">
                                  {otherContents.map((content, contentIndex) => 
                                    renderMessageContent(content, contentIndex)
                                  )}
                                </div>
                              )}
                              
                              {/* Show all content if nothing else is displayed */}
                              {!consolidatedText && otherContents.length === 0 && (message.content || []).length > 0 && (
                                <div className={`text-sm ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                                  <p className="font-medium mb-2">Raw message content:</p>
                                  {(message.content || []).map((content, idx) => (
                                    <div key={idx} className="mb-2 p-2 rounded bg-black/10">
                                      <div className="font-medium">{content.kind}:</div>
                                      <div className="mt-1">
                                        {content.text || content.content || JSON.stringify(content, null, 2)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Avatar for user messages (right side) */}
                          {message.role === 'user' && (
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-green-100 to-green-200 flex items-center justify-center shadow-md border-2 border-green-300">
                              <User className="h-5 w-5 text-green-700" />
                            </div>
                          )}
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
    </div>
  );
}
