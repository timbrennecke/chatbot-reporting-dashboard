import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
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
  Check,
  Bookmark,
  BookmarkX,
  X,
  FileText
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
  // Bookmark props
  isSaved?: boolean;
  onToggleSave?: (conversationId: string) => void;
  // Notes props
  initialNotes?: string;
  onNotesChange?: (conversationId: string, notes: string) => void;
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

// Function to check if a system/status message contains errors
function systemMessageHasErrors(message: any): boolean {
  if (message.role !== 'system' && message.role !== 'status') return false;
  
  return message.content.some((content: any) => {
    if (content.text || content.content) {
      const text = content.text || content.content || '';
      
      // Check for error patterns
      const errorPatterns = [
        /Agent execution error/gi,
        /Error:/gi,
        /Failed:/gi,
        /Exception:/gi,
        /Timeout/gi,
        /Connection error/gi,
        /Invalid/gi,
        /Not found/gi,
        /Unauthorized/gi,
        /Forbidden/gi
      ];
      
      return errorPatterns.some(pattern => pattern.test(text));
    }
    return false;
  });
}

function formatJsonInText(text: string): { hasJson: boolean; formattedText: string } {
  let formattedText = text;
  let hasJson = false;
  
  // First, check if we already have formatted JSON blocks and skip them
  if (formattedText.includes('```json')) {
    return { hasJson: true, formattedText };
  }
  
  // Helper function to find matching braces
  function findJsonEnd(str: string, startIndex: number): number {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = startIndex; i < str.length; i++) {
      const char = str[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return i;
          }
        }
      }
    }
    
    return -1;
  }
  
  // Look for JSON starting with { and containing escaped quotes
  let searchIndex = 0;
  while (true) {
    const startIndex = formattedText.indexOf('{\\', searchIndex);
    if (startIndex === -1) break;
    
    const endIndex = findJsonEnd(formattedText, startIndex);
    if (endIndex === -1) {
      searchIndex = startIndex + 1;
      continue;
    }
    
    const jsonString = formattedText.substring(startIndex, endIndex + 1);
    
    // Only process if it looks like a substantial JSON object
    if (jsonString.length > 50 && jsonString.includes('\\"')) {
      try {
        // Try to unescape the JSON string
        const unescapedJson = jsonString
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r');
        
        // Try to parse the unescaped JSON
        const parsedJson = JSON.parse(unescapedJson);
        // Format it nicely with 2-space indentation
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        // Replace the original match with the formatted version
        formattedText = formattedText.replace(jsonString, '\n\n```json\n' + formattedJson + '\n```\n\n');
        hasJson = true;
        // Continue searching after the replacement
        searchIndex = startIndex + formattedJson.length;
      } catch (error) {
        // If parsing fails, still try to format as a code block for better readability
        console.warn('Failed to parse JSON, formatting as code block:', error.message);
        const unescapedJson = jsonString
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t');
        formattedText = formattedText.replace(jsonString, '\n\n```json\n' + unescapedJson + '\n```\n\n');
        hasJson = true;
        searchIndex = startIndex + unescapedJson.length;
      }
    } else {
      searchIndex = startIndex + 1;
    }
  }
  
  return { hasJson, formattedText };
}

function processMessageText(content: MessageContent[]): string {
  const textContents = content.filter(c => c.kind === 'text');
  
  if (textContents.length === 0) return '';
  
  // Process text content
  
  // Try different approaches based on the content structure
  if (textContents.length === 1) {
    // Single text item - use it directly
    const text = textContents[0].text || textContents[0].content || '';
    return text;
  } else {
    // Multiple text items - they might be fragments that need to be joined properly
    const combinedText = textContents
      .map(item => item.text || item.content || '')
      .filter(text => text.length > 0)
      .join(''); // Try joining without spaces first
    
    return combinedText;
  }
}

function consolidateMessageContent(content: MessageContent[]) {
  const textContents = content.filter(c => c.kind === 'text');
  const otherContents = content.filter(c => c.kind !== 'text');
  
  let consolidatedText = processMessageText(content);
  
  // Apply JSON formatting if the text contains JSON
  const { formattedText } = formatJsonInText(consolidatedText);
  consolidatedText = formattedText;
    
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
  hasAnyUploadedConversations = false,
  onPreviousConversation,
  onNextConversation,
  hasPreviousConversation = false,
  hasNextConversation = false,
  onConversationFetched,
  isSaved = false,
  onToggleSave,
  initialNotes = '',
  onNotesChange
}: ConversationDetailProps) {
  
  
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  
  // Debug: Log the state (removed to prevent infinite logs)
  // console.log('🔍 ConversationDetail showSystemMessages state:', showSystemMessages);
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
  
  // Notes state
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [notes, setNotes] = useState(initialNotes);

  // Context state
  const [contextData, setContextData] = useState<any>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string>('');
  const [showContextPopup, setShowContextPopup] = useState(false);

  // Handle notes changes
  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    if (paginationConversationId && onNotesChange) {
      onNotesChange(paginationConversationId, newNotes);
    }
  };

  // Handle save with notes
  const handleSaveWithNotes = () => {
    if (paginationConversationId && onToggleSave) {
      if (!isSaved) {
        // If not saved yet, save it and show small notes popup
        onToggleSave(paginationConversationId);
        setShowNotesPanel(true);
      } else {
        // If already saved, just toggle the save state
        onToggleSave(paginationConversationId);
        setShowNotesPanel(false);
      }
    }
  };

  // Save notes and close popup
  const handleSaveNotes = () => {
    setShowNotesPanel(false);
  };

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

  // Fetch context data function
  const fetchContextData = async (threadId: string) => {
    if (!threadId || !apiKey.trim()) {
      setContextError('Thread ID and API key are required');
      return;
    }

    setContextLoading(true);
    setContextError('');

    try {
      const baseUrl = getApiBaseUrl();
      
      const response = await fetch(`${baseUrl}/attributes/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          threads: [{ threadId }]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setContextData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setContextError(`Failed to fetch context: ${errorMessage}`);
      console.error('Context fetch error:', err);
    } finally {
      setContextLoading(false);
    }
  };

  // Determine which conversation data to use - prioritize selectedThread since it now contains all messages
  const activeConversation = useMemo(() => {
    // If we have a selectedThread with messages, use it as the primary source
    if (selectedThread && selectedThread.messages && selectedThread.messages.length > 0) {
      // Create a conversation-like object from the thread data
      const threadAsConversation = {
        id: selectedThread.conversationId,
        title: `Thread ${selectedThread.id}`,
        createdAt: selectedThread.createdAt,
        lastMessageAt: selectedThread.messages[selectedThread.messages.length - 1]?.sentAt || selectedThread.createdAt,
        messages: selectedThread.messages,
        threadIds: [selectedThread.id]
      };
      // Using selectedThread as primary data source
      return threadAsConversation;
    }
    
    // Fallback to traditional conversation sources
    const result = conversation || uploadedConversation || fetchedConversation;
    // Fallback to conversation sources
    return result;
  }, [conversation, uploadedConversation, fetchedConversation, selectedThread]);


  // Auto-fetch conversation when component mounts or conversation ID changes
  // BUT NOT when we have selectedThread data (since threads now contain all messages)
  useEffect(() => {
    const shouldAutoFetch = 
      paginationConversationId.trim() && // Has conversation ID
      apiKey.trim() && // Has API key
      !uploadedConversation && // No uploaded conversation data
      !fetchedConversation && // Not already fetched
      !fetchLoading && // Not currently loading
      !(selectedThread && selectedThread.messages && selectedThread.messages.length > 0); // Don't auto-fetch if we have thread data

    if (shouldAutoFetch) {
      console.log('🔄 Auto-fetching conversation (no thread data available)');
      handleFetchConversation();
    } else if (selectedThread && selectedThread.messages && selectedThread.messages.length > 0) {
      console.log('✅ Skipping auto-fetch: using selectedThread data instead');
    }
  }, [paginationConversationId, apiKey, uploadedConversation, fetchedConversation, fetchLoading, selectedThread]);

  // Clear fetched conversation when conversation ID changes (for navigation)
  useEffect(() => {
    const newId = conversationId || conversation?.id || selectedThread?.conversationId || '';
    if (newId && newId !== paginationConversationId) {
      console.log('🔄 Conversation ID changed, updating pagination ID:', paginationConversationId, '->', newId);
      setPaginationConversationId(newId);
      if (fetchedConversation && newId !== (fetchedConversation.id || '')) {
        console.log('🔄 Clearing fetched data for new conversation');
        setFetchedConversation(null);
      }
    }
  }, [conversationId, conversation?.id, selectedThread?.conversationId, paginationConversationId, fetchedConversation]);

  // Mark conversation as viewed when conversation ID changes or component mounts
  useEffect(() => {
    const currentConversationId = conversationId || conversation?.id || selectedThread?.conversationId || paginationConversationId;
    if (currentConversationId) {
      // Dispatch a custom event to mark this conversation as viewed
      const event = new CustomEvent('conversationViewed', { detail: { conversationId: currentConversationId } });
      window.dispatchEvent(event);
      console.log('👁️ Marked conversation as viewed:', currentConversationId);
    }
  }, [conversationId, conversation?.id, selectedThread?.conversationId, paginationConversationId]);

  // Auto-fetch context data when thread changes
  useEffect(() => {
    const threadId = selectedThread?.id;
    if (threadId && apiKey.trim()) {
      console.log('🔄 Auto-fetching context data for thread:', threadId);
      fetchContextData(threadId);
    }
  }, [selectedThread?.id, apiKey]);


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
      const conversationId = paginationConversationId.trim();
      
      // No more cache checking - fetch directly from API
      console.log('🌐 Fetching conversation from API');
      console.log('🔍 API Call Debug:', {
        conversationId,
        paginationConversationId,
        selectedThreadConversationId: selectedThread?.conversationId,
        apiCallUrl: `${getApiBaseUrl()}/conversation/${conversationId}`
      });
      
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/conversation/${conversationId}`, {
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
      
      // No more caching - just use the data directly
      
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


      {/* Thread-based Conversation Display - when activeConversation is created from selectedThread */}
      {(() => {
        const shouldShowThreadDisplay = activeConversation && !uploadedConversation && !fetchedConversation;
        // Display section logic
        return shouldShowThreadDisplay;
      })() && (
        <div className="space-y-6">
          {/* Conversation Header */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-slate-800">{activeConversation.title || `Thread ${selectedThread?.id}`}</CardTitle>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-2">
                      <CardDescription className="text-slate-600">Conversation ID: {activeConversation.id}</CardDescription>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(activeConversation.id, 'thread-conversation')}
                        className="h-6 w-6 p-0 hover:bg-slate-100"
                        title="Copy Conversation ID"
                      >
                        {copiedId === 'thread-conversation' ? (
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
                          onClick={() => copyToClipboard(selectedThread.id, 'thread-id')}
                          className="h-6 w-6 p-0 hover:bg-slate-100"
                          title="Copy Thread ID"
                        >
                          {copiedId === 'thread-id' ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-500" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Navigation Arrows and Bookmark */}
                <div className="flex items-center gap-3 mr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
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
                      onNextConversation?.();
                    }}
                    disabled={!hasNextConversation}
                    className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasNextConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Next Chat"
                  >
                    <span className="text-sm font-medium">Next Chat</span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>

                  {/* Bookmark Button */}
                  {paginationConversationId && (
                    <div className="relative flex flex-col items-start gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveWithNotes}
                        className={`flex items-center gap-2 px-3 py-2 h-auto transition-all duration-200 rounded-md ${
                          isSaved 
                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 bg-blue-50/50' 
                            : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                        title={isSaved ? "Remove from saved chats" : "Save chat with notes"}
                      >
                        {isSaved ? (
                          <>
                            <BookmarkX className="h-4 w-4" />
                            <span className="text-sm font-medium">Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-4 w-4" />
                            <span className="text-sm font-medium">Save</span>
                          </>
                        )}
                      </Button>

                      {/* Small Notes Button - only show when saved */}
                      {isSaved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNotesPanel(true)}
                          className="flex items-center gap-1 px-2 py-1 h-auto text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-md"
                          title="View/edit notes"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Notes</span>
                        </Button>
                      )}

                      {/* Small Notes Popup */}
                      {showNotesPanel && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                          <div className="p-3 bg-white">
                            <div className="flex items-center gap-2 mb-2 bg-white">
                              <FileText className="w-4 h-4 text-gray-700" />
                              <span className="text-sm font-semibold text-gray-800">{notes.trim() ? 'Edit Notes' : 'Add Notes'}</span>
                            </div>
                            
                            <Textarea
                              placeholder="Add notes about this conversation..."
                              value={notes}
                              onChange={(e) => handleNotesChange(e.target.value)}
                              className="text-sm resize-none bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 w-full"
                              rows={4}
                              style={{ backgroundColor: '#ffffff', opacity: 1 }}
                            />
                          </div>
                          
                          {/* Button Footer */}
                          <div className="flex justify-end gap-2 px-3 py-2 bg-gray-100 border-t-2 border-gray-300">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowNotesPanel(false)}
                              className="text-xs bg-white border-gray-400 hover:bg-gray-50 px-2 py-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleSaveNotes}
                              className="text-xs px-2 py-1"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                </div>
                
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                  {countMessagesExcludingUI(activeConversation.messages || [])} messages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{formatTimestamp(activeConversation.createdAt)}</p>
                </div>
                <div>
                  <Label>Last Message</Label>
                  <p className="text-sm">{formatTimestamp(activeConversation.lastMessageAt)}</p>
                </div>
                <div>
                  <Label>Thread Count</Label>
                  <p className="text-sm">{activeConversation.threadIds?.length || 0} threads</p>
                </div>
                <div>
                  <Label>Duration</Label>
                  <p className="text-sm">
                    {(() => {
                      const messages = activeConversation.messages || [];
                      if (messages.length < 2) return 'N/A';
                      
                      const timestamps = messages
                        .map(m => new Date(m.created_at || m.createdAt || m.sentAt))
                        .filter(date => !isNaN(date.getTime()))
                        .sort((a, b) => a.getTime() - b.getTime());
                      
                      if (timestamps.length < 2) return 'N/A';
                      
                      const duration = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
                      const minutes = Math.round(duration / (1000 * 60));
                      const seconds = Math.round(duration / 1000);
                      return minutes > 0 ? `${minutes}m` : seconds > 0 ? `${seconds}s` : '<1s';
                    })()}
                  </p>
                </div>
                <div>
                  <Label>Response Time</Label>
                  <p className="text-sm">
                    {(() => {
                      const messages = activeConversation.messages || [];
                      const userMessages = messages.filter(m => m.role === 'user');
                      const assistantMessages = messages.filter(m => m.role === 'assistant');
                      
                      if (userMessages.length === 0 || assistantMessages.length === 0) return 'N/A';
                      
                      const firstUser = userMessages
                        .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
                        .filter(m => !isNaN(m.timestamp.getTime()))
                        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
                      
                      const firstAssistant = assistantMessages
                        .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
                        .filter(m => !isNaN(m.timestamp.getTime()))
                        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
                      
                      if (!firstUser || !firstAssistant || firstAssistant.timestamp <= firstUser.timestamp) return 'N/A';
                      
                      const responseTime = firstAssistant.timestamp.getTime() - firstUser.timestamp.getTime();
                      const seconds = Math.round(responseTime / 1000);
                      return seconds > 0 ? `${seconds}s` : '<1s';
                    })()}
                  </p>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newValue = !showSystemMessages;
                      console.log('🔍 Show System Button Clicked (Thread):', {
                        currentValue: showSystemMessages,
                        newValue,
                        hasSelectedThread: !!selectedThread,
                        selectedThreadId: selectedThread?.id,
                        threadMessagesCount: selectedThread?.messages?.length || 0,
                        systemMessagesInThread: selectedThread?.messages?.filter(msg => msg.role === 'system').length || 0
                      });
                      setShowSystemMessages(newValue);
                    }}
                    className={`flex items-center gap-2 ${showSystemMessages ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    style={{
                      backgroundColor: showSystemMessages ? '#dbeafe' : '#ffffff',
                      borderColor: showSystemMessages ? '#93c5fd' : '#d1d5db',
                      color: showSystemMessages ? '#1d4ed8' : '#374151'
                    }}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContextPopup(true)}
                    disabled={!selectedThread?.id || contextLoading}
                    className="flex items-center gap-2"
                  >
                    {contextLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Show Context
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg">
              <div className="max-h-[70vh] overflow-y-auto px-6 py-8 space-y-4">
                      {(() => {
                        // Use activeConversation messages directly
                        const allMessages = activeConversation?.messages || [];
                        
                        // Debug: Check message data
                        // Debug: Check message data (only log once per conversation)
                        if (allMessages.length > 0 && !window.debugLoggedFor) {
                          console.log('🔍 Thread section - Processing messages:', {
                            totalMessages: allMessages.length,
                            messageRoles: allMessages.map(m => m.role),
                            systemMessageCount: allMessages.filter(m => m.role === 'system').length,
                            statusMessageCount: allMessages.filter(m => m.role === 'status').length,
                            showSystemMessages
                          });
                          window.debugLoggedFor = true;
                        }
                        
                        const filteredMessages = allMessages
                          .filter(message => {
                            // Always show user and assistant messages
                            if (message.role === 'user' || message.role === 'assistant') return true;
                            // Show system/status messages based on toggle (your data uses 'status' not 'system')
                            if (message.role === 'system' || message.role === 'status') {
                              return showSystemMessages;
                            }
                            return true;
                          });
                        
                        // Debug: Show message breakdown
                        const messageBreakdown = allMessages.reduce((acc, msg) => {
                          acc[msg.role] = (acc[msg.role] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        
                        if (filteredMessages.length === 0) {
                          return (
                            <div className="text-center py-8 text-slate-500">
                              <p>No messages to display</p>
                              <p className="text-sm mt-2">
                                {allMessages.length > 0 
                                  ? `${allMessages.length} messages found, but filtered out. Try toggling "Show System" if messages are system messages.`
                                  : 'No messages found in this thread.'
                                }
                              </p>
                            </div>
                          );
                        }
                        
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
                          (message.role === 'system' || message.role === 'status') ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
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
                            backgroundColor: message.role === 'user' ? '#eff6ff' : 
                                           (message.role === 'system' || message.role === 'status') ? '#fefce8' : 
                                           message.role === 'assistant' ? '#f0fdf4' : '#f8fafc',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            border: '1px solid',
                            borderColor: message.role === 'user' ? '#bfdbfe' : (message.role === 'system' || message.role === 'status') ? '#fde68a' : message.role === 'assistant' ? '#bbf7d0' : '#e2e8f0',
                            ...((message.role === 'system' || message.role === 'status') && {
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
                                  {consolidatedText.includes('```json') ? (
                                    // Render formatted JSON with code highlighting
                                    <div className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                                      {consolidatedText.split(/(```json[\s\S]*?```)/g).map((part, index) => {
                                        if (part.startsWith('```json') && part.endsWith('```')) {
                                          const jsonContent = part.replace(/```json\n?/, '').replace(/\n?```$/, '');
                                          return (
                                            <div key={index} className="my-4">
                                              <div className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                                                <pre className="text-sm font-mono whitespace-pre-wrap">
                                                  <code>{jsonContent}</code>
                                                </pre>
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          return <span key={index}>{part}</span>;
                                        }
                                      })}
                                    </div>
                                  ) : (
                                    // Regular text content
                                    <div className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                                      {consolidatedText}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Other content (UI, linkouts, etc.) */}
                              {otherContents.length > 0 && (
                                <div className="mt-4 space-y-3">
                                  {otherContents.map((content, idx) => renderMessageContent(content, idx))}
                                </div>
                              )}
                        </div>
                      </div>
                      
                      {/* Avatar - only for user messages (right side) */}
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                          <User className="h-5 w-5 text-blue-600" />
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
                
                {/* Navigation Arrows and Bookmark */}
                <div className="flex items-center gap-3 mr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
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
                      onNextConversation?.();
                    }}
                    disabled={!hasNextConversation}
                    className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasNextConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Next Chat"
                  >
                    <span className="text-sm font-medium">Next Chat</span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>

                  {/* Bookmark Button */}
                  {paginationConversationId && (
                    <div className="relative flex flex-col items-start gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveWithNotes}
                        className={`flex items-center gap-2 px-3 py-2 h-auto transition-all duration-200 rounded-md ${
                          isSaved 
                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 bg-blue-50/50' 
                            : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                        title={isSaved ? "Remove from saved chats" : "Save chat with notes"}
                      >
                        {isSaved ? (
                          <>
                            <BookmarkX className="h-4 w-4" />
                            <span className="text-sm font-medium">Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-4 w-4" />
                            <span className="text-sm font-medium">Save</span>
                          </>
                        )}
                      </Button>

                      {/* Small Notes Button - only show when saved */}
                      {isSaved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNotesPanel(true)}
                          className="flex items-center gap-1 px-2 py-1 h-auto text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-md"
                          title="View/edit notes"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Notes</span>
                        </Button>
                      )}

                      {/* Small Notes Popup */}
                      {showNotesPanel && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                          <div className="p-3 bg-white">
                            <div className="flex items-center gap-2 mb-2 bg-white">
                              <FileText className="w-4 h-4 text-gray-700" />
                              <span className="text-sm font-semibold text-gray-800">{notes.trim() ? 'Edit Notes' : 'Add Notes'}</span>
                            </div>
                            
                            <Textarea
                              placeholder="Add notes about this conversation..."
                              value={notes}
                              onChange={(e) => handleNotesChange(e.target.value)}
                              className="text-sm resize-none bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 w-full"
                              rows={4}
                              style={{ backgroundColor: '#ffffff', opacity: 1 }}
                            />
                          </div>
                          
                          {/* Button Footer */}
                          <div className="flex justify-end gap-2 px-3 py-2 bg-gray-100 border-t-2 border-gray-300">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowNotesPanel(false)}
                              className="text-xs bg-white border-gray-400 hover:bg-gray-50 px-2 py-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleSaveNotes}
                              className="text-xs px-2 py-1"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newValue = !showSystemMessages;
                      console.log('🔍 Show System Button Clicked:', {
                        currentValue: showSystemMessages,
                        newValue,
                        hasSelectedThread: !!selectedThread,
                        selectedThreadId: selectedThread?.id,
                        threadMessagesCount: selectedThread?.messages?.length || 0,
                        systemMessagesInThread: selectedThread?.messages?.filter(msg => msg.role === 'system').length || 0
                      });
                      setShowSystemMessages(newValue);
                    }}
                    className={`flex items-center gap-2 ${showSystemMessages ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    style={{
                      backgroundColor: showSystemMessages ? '#dbeafe' : '#ffffff',
                      borderColor: showSystemMessages ? '#93c5fd' : '#d1d5db',
                      color: showSystemMessages ? '#1d4ed8' : '#374151'
                    }}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContextPopup(true)}
                    disabled={!selectedThread?.id || contextLoading}
                    className="flex items-center gap-2"
                  >
                    {contextLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Show Context
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg">
              <div className="max-h-[70vh] overflow-y-auto px-6 py-8 space-y-4">
                {(() => {
                  // Since activeConversation now contains all messages from thread, use it directly
                  const allMessages = uploadedConversation?.messages || activeConversation?.messages || [];
                  
                  const filteredMessages = allMessages
                    .filter(message => {
                      // Always show user and assistant messages
                      if (message.role === 'user' || message.role === 'assistant') return true;
                            // Show system/status messages based on toggle
                            if (message.role === 'system' || message.role === 'status') {
                              return showSystemMessages;
                            }
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
                          (message.role === 'system' || message.role === 'status') ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
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
                            backgroundColor: message.role === 'user' ? '#eff6ff' : 
                                           (message.role === 'system' || message.role === 'status') ? '#fefce8' : 
                                           message.role === 'assistant' ? '#f0fdf4' : '#f8fafc',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            border: '1px solid',
                            borderColor: message.role === 'user' ? '#bfdbfe' : (message.role === 'system' || message.role === 'status') ? '#fde68a' : message.role === 'assistant' ? '#bbf7d0' : '#e2e8f0',
                            ...((message.role === 'system' || message.role === 'status') && {
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
                                  {consolidatedText.includes('```json') ? (
                                    // Render formatted JSON with code highlighting
                                    <div className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                                      {consolidatedText.split(/(```json[\s\S]*?```)/g).map((part, index) => {
                                        if (part.startsWith('```json') && part.endsWith('```')) {
                                          const jsonContent = part.replace(/```json\n?/, '').replace(/\n?```$/, '');
                                          return (
                                            <div key={index} className="my-4">
                                              <div className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                                                <pre className="text-sm font-mono whitespace-pre-wrap">
                                                  <code>{jsonContent}</code>
                                                </pre>
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          return part ? (
                                            <span key={index}>{part}</span>
                                          ) : null;
                                        }
                                      })}
                                    </div>
                                  ) : (
                                    // Regular text rendering
                                    <p className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                                      {consolidatedText}
                                    </p>
                                  )}
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

      {/* Fetch Section - only show if we don't have any conversation data */}
      {!fetchedConversation && !uploadedConversation && !activeConversation && (
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
                          onNextConversation?.();
                        }}
                        disabled={!hasNextConversation}
                        className={`flex items-center gap-1 px-3 py-2 h-auto ${!hasNextConversation ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                        title="Next Chat"
                      >
                        <span className="text-sm font-medium">Next Chat</span>
                        <ChevronRight className="h-5 w-5" />
                      </Button>

                      {/* Bookmark Button */}
                      {paginationConversationId && (
                        <div className="relative flex flex-col items-start gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveWithNotes}
                            className={`flex items-center gap-2 px-3 py-2 h-auto transition-all duration-200 rounded-md ${
                              isSaved 
                                ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 bg-blue-50/50' 
                                : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                            title={isSaved ? "Remove from saved chats" : "Save chat with notes"}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkX className="h-4 w-4" />
                                <span className="text-sm font-medium">Saved</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-4 w-4" />
                                <span className="text-sm font-medium">Save</span>
                              </>
                            )}
                          </Button>

                          {/* Small Notes Button - only show when saved */}
                          {isSaved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowNotesPanel(true)}
                              className="flex items-center gap-1 px-2 py-1 h-auto text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-md"
                              title="View/edit notes"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Notes</span>
                            </Button>
                          )}

                          {/* Small Notes Popup */}
                          {showNotesPanel && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
                              <div className="p-3 bg-white">
                                <div className="flex items-center gap-2 mb-2 bg-white">
                                  <FileText className="w-4 h-4 text-gray-700" />
                                  <span className="text-sm font-semibold text-gray-800">{notes.trim() ? 'Edit Notes' : 'Add Notes'}</span>
                                </div>
                                
                                <Textarea
                                  placeholder="Add notes about this conversation..."
                                  value={notes}
                                  onChange={(e) => handleNotesChange(e.target.value)}
                                  className="text-sm resize-none bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 w-full"
                                  rows={4}
                                  style={{ backgroundColor: '#ffffff', opacity: 1 }}
                                />
                              </div>
                              
                              {/* Button Footer */}
                              <div className="flex justify-end gap-2 px-3 py-2 bg-gray-100 border-t-2 border-gray-300">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowNotesPanel(false)}
                                  className="text-xs bg-white border-gray-400 hover:bg-gray-50 px-2 py-1"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={handleSaveNotes}
                                  className="text-xs px-2 py-1"
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newValue = !showSystemMessages;
                          console.log('🔍 Show System Button Clicked (Fetched):', {
                            currentValue: showSystemMessages,
                            newValue,
                            hasSelectedThread: !!selectedThread,
                            selectedThreadId: selectedThread?.id,
                            threadMessagesCount: selectedThread?.messages?.length || 0,
                            systemMessagesInThread: selectedThread?.messages?.filter(msg => msg.role === 'system').length || 0
                          });
                          setShowSystemMessages(newValue);
                        }}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContextPopup(true)}
                        disabled={!selectedThread?.id || contextLoading}
                        className="flex items-center gap-2"
                      >
                        {contextLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Show Context
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg">
                  <div className="max-h-[70vh] overflow-y-auto px-6 py-8 space-y-4">
                    {(() => {
                      // Since activeConversation now contains all messages from thread, use it directly
                      const allMessages = fetchedConversation?.messages || activeConversation?.messages || [];
                      
                      const filteredMessages = allMessages
                        ?.filter(message => {
                          // Always show user and assistant messages
                          if (message.role === 'user' || message.role === 'assistant') return true;
                          // Show system/status messages based on toggle
                          if (message.role === 'system' || message.role === 'status') {
                            return showSystemMessages;
                          }
                          return true;
                        });
                      
                      return filteredMessages
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
                              (message.role === 'system' || message.role === 'status') ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
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
                                  : (message.role === 'system' || message.role === 'status')
                                  ? systemMessageHasErrors(message)
                                    ? 'bg-red-200 text-red-950 border-red-400'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-slate-50 text-slate-800 border-slate-200'
                              }`}
                              style={{
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                border: '1px solid',
                                borderColor: message.role === 'user' 
                                  ? '#bfdbfe' 
                                  : (message.role === 'system' || message.role === 'status')
                                  ? systemMessageHasErrors(message) 
                                    ? '#f87171' 
                                    : '#fde68a'
                                  : message.role === 'assistant' 
                                  ? '#bbf7d0' 
                                  : '#e2e8f0',
                                ...((message.role === 'system' || message.role === 'status') && {
                                  maxHeight: '320px',
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  wordWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  backgroundColor: systemMessageHasErrors(message) ? '#fecaca' : '#fefce8'
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

      {/* Context Popup Overlay */}
      {showContextPopup && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(2px)'
          }}
          onClick={() => setShowContextPopup(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl flex flex-col"
            style={{ 
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              width: '600px',
              height: '500px',
              maxWidth: '90vw',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="flex justify-between items-center p-4 border-b flex-shrink-0"
              style={{ 
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
                Context Data
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContextPopup(false)}
                className="h-8 w-8 p-0"
                style={{ 
                  backgroundColor: 'transparent',
                  color: '#6b7280'
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Content */}
            <div 
              className="flex-1 p-4 overflow-hidden flex flex-col"
              style={{ backgroundColor: '#ffffff' }}
            >
              {contextError ? (
                <div 
                  className="p-4 rounded-lg border"
                  style={{ 
                    backgroundColor: '#fef2f2',
                    borderColor: '#fecaca',
                    color: '#991b1b'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{contextError}</span>
                  </div>
                </div>
              ) : contextData ? (
                <>
                  <div className="flex justify-between items-center mb-3 flex-shrink-0">
                    <h3 className="text-base font-medium" style={{ color: '#111827' }}>
                      JSON Response
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(contextData, null, 2), 'context-data')}
                      className="flex items-center gap-2"
                      style={{ 
                        backgroundColor: '#ffffff',
                        borderColor: '#d1d5db',
                        color: '#374151'
                      }}
                    >
                      {copiedId === 'context-data' ? (
                        <>
                          <Check className="h-4 w-4" style={{ color: '#059669' }} />
                          <span style={{ color: '#059669' }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy JSON
                        </>
                      )}
                    </Button>
                  </div>
                  <div 
                    className="flex-1 rounded-lg border overflow-hidden"
                    style={{ 
                      backgroundColor: '#f9fafb',
                      borderColor: '#e5e7eb',
                      minHeight: 0
                    }}
                  >
                    <div 
                      className="h-full overflow-auto p-3"
                      style={{ 
                        backgroundColor: '#ffffff',
                        maxHeight: '100%'
                      }}
                    >
                      <pre 
                        className="text-xs font-mono whitespace-pre-wrap break-words"
                        style={{ 
                          color: '#374151',
                          margin: 0,
                          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                          lineHeight: '1.4'
                        }}
                      >
                        {JSON.stringify(contextData, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p style={{ color: '#6b7280' }}>No context data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
