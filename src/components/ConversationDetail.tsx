import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  MessageSquare, 
  User, 
  Bot, 
  ExternalLink, 
  Zap, 
  Clock,
  Search,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Conversation, MessageContent, Thread } from '../lib/types';
import { api, ApiError } from '../lib/api';
import { formatTimestamp, parseThreadId } from '../lib/utils';

interface ConversationDetailProps {
  conversationId?: string;
  uploadedConversation?: Conversation;
  hasAnyUploadedConversations?: boolean;
  selectedThread?: Thread;
  onThreadSelect?: (threadId: string) => void;
}

export function ConversationDetail({ 
  conversationId, 
  uploadedConversation, 
  hasAnyUploadedConversations = false,
  selectedThread,
  onThreadSelect 
}: ConversationDetailProps) {
  // Initialize state with uploaded conversation if available
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [showSystemMessages, setShowSystemMessages] = useState(false);

  // Determine if we're in offline mode (any uploaded conversation data exists)
  const isOfflineMode = hasAnyUploadedConversations;

  const fetchConversation = useCallback(async (id?: string) => {
    // ABSOLUTE BLOCK: Never attempt API calls if we have any uploaded data
    if (isOfflineMode || hasAnyUploadedConversations || uploadedConversation) {
      setError('🚫 API calls are disabled when uploaded conversation data is present. Please use the conversations from the dashboard or clear all data to use API mode.');
      setLoading(false);
      return;
    }

    const targetId = id || searchId;
    if (!targetId) {
      setError('Please enter a conversation ID');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await api.getConversation(targetId);
      setConversation(response);
    } catch (err) {
      if (err instanceof ApiError) {
        // Check if this is an offline mode block (which is expected behavior)
        if (err.message.includes('uploaded data is present')) {
          setError('🔒 Currently in offline mode. Please use the conversations from the uploaded data or clear all data to enable API mode.');
        } else {
          setError(`API Error (${err.endpoint}): ${err.message}${err.requestId ? ` [${err.requestId}]` : ''}`);
        }
      } else {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [isOfflineMode, hasAnyUploadedConversations, uploadedConversation, searchId]);

  // Update conversation when props change
  useEffect(() => {
    // FIRST CHECK: If we have a selected thread, check if we have conversation data for it
    if (selectedThread) {
      setSearchId(selectedThread.conversationId);
      
      // Check if we have the actual conversation data for this thread
      if (uploadedConversation) {
        // We have the conversation data - show it!
        setConversation(uploadedConversation);
        setError(null);
      } else {
        // We only have thread data - create a conversation-like object from thread data
        const threadAsConversation: Conversation = {
          id: selectedThread.conversationId,
          title: `Thread ${selectedThread.id}`,
          createdAt: selectedThread.createdAt,
          lastMessageAt: selectedThread.messages[selectedThread.messages.length - 1]?.sentAt || selectedThread.createdAt,
          messages: selectedThread.messages,
          threadIds: [selectedThread.id]
        };
        setConversation(threadAsConversation);
        setError(null);
      }
      setLoading(false);
      return; // EXIT - Show thread details, no API call
    }

    // SECOND CHECK: If there's ANY uploaded conversation data, we're in offline mode
    if (hasAnyUploadedConversations) {
      if (uploadedConversation) {
        setConversation(uploadedConversation);
        setSearchId(uploadedConversation.id);
        setError(null);
      } else if (conversationId) {
        setConversation(null);
        setSearchId(conversationId);
        const errorMsg = `Conversation "${conversationId}" not found in uploaded data. This conversation ID was referenced from thread data, but the actual conversation data was not uploaded. To view this conversation, please upload the conversation data or clear all data to use API mode.`;
        setError(errorMsg);
      } else {
        setConversation(null);
        setSearchId('');
        setError(null);
      }
      setLoading(false);
      return; // EXIT - No API operations allowed
    }

    // ONLY REACH HERE IF NO UPLOADED DATA EXISTS
    if (conversationId) {
      setSearchId(conversationId);
      // Safe to call API - no uploaded data exists
      fetchConversation(conversationId);
    } else {
      setConversation(null);
      setSearchId('');
      setError(null);
      setLoading(false);
    }
  }, [conversationId, uploadedConversation, hasAnyUploadedConversations, selectedThread, fetchConversation]);

  const analytics = useMemo(() => {
    if (!conversation) return null;

    const uiAnalytics: Record<string, number> = {};
    const namespaceAnalytics: Record<string, number> = {};
    const identifierAnalytics: Record<string, number> = {};
    const linkoutDomains: Record<string, { count: number; urls: Array<{ url: string; text: string }> }> = {};
    
    let interactiveCount = 0;
    let finalCount = 0;
    let totalUiEvents = 0;
    let totalLinkouts = 0;

    conversation.messages.forEach(message => {
      message.content.forEach(content => {
        if (content.kind === 'ui' && content.ui) {
          totalUiEvents++;
          uiAnalytics[content.ui.kind] = (uiAnalytics[content.ui.kind] || 0) + 1;
          namespaceAnalytics[content.ui.namespace] = (namespaceAnalytics[content.ui.namespace] || 0) + 1;
          identifierAnalytics[content.ui.identifier] = (identifierAnalytics[content.ui.identifier] || 0) + 1;
          
          if (content.ui.interactive) interactiveCount++;
          if (content.ui.final) finalCount++;
        } else if (content.kind === 'linkout' && content.url) {
          totalLinkouts++;
          try {
            const domain = new URL(content.url).hostname;
            if (!linkoutDomains[domain]) {
              linkoutDomains[domain] = { count: 0, urls: [] };
            }
            linkoutDomains[domain].count++;
            linkoutDomains[domain].urls.push({
              url: content.url,
              text: content.text || content.url,
            });
          } catch {
            const domain = 'invalid-url';
            if (!linkoutDomains[domain]) {
              linkoutDomains[domain] = { count: 0, urls: [] };
            }
            linkoutDomains[domain].count++;
            linkoutDomains[domain].urls.push({
              url: content.url,
              text: content.text || content.url,
            });
          }
        }
      });
    });

    return {
      uiAnalytics,
      namespaceAnalytics,
      identifierAnalytics,
      linkoutDomains,
      interactiveCount,
      finalCount,
      totalUiEvents,
      totalLinkouts,
    };
  }, [conversation]);

  const uiKindData = useMemo(() => {
    if (!analytics) return [];
    return Object.entries(analytics.uiAnalytics).map(([kind, count]) => ({
      kind,
      count,
    }));
  }, [analytics]);

  const namespaceData = useMemo(() => {
    if (!analytics) return [];
    return Object.entries(analytics.namespaceAnalytics).map(([namespace, count]) => ({
      namespace,
      count,
    }));
  }, [analytics]);

  // Consolidate all text content into one string and separate other content
  const consolidateMessageContent = (contents: MessageContent[]) => {
    const textContents: string[] = [];
    const otherContents: MessageContent[] = [];

    contents.forEach((content) => {
      if (content.kind === 'text' && content.content) {
        textContents.push(content.content);
      } else {
        otherContents.push(content);
      }
    });

    return {
      consolidatedText: textContents.join(''),
      otherContents
    };
  };

  // Filter messages based on system message visibility
  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    
    if (showSystemMessages) {
      return conversation.messages;
    }
    
    return conversation.messages.filter(message => message.role !== 'system');
  }, [conversation, showSystemMessages]);

  const renderMessageContent = (content: MessageContent, index: number) => {
    switch (content.kind) {
      case 'ui':
        return (
          <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <Badge className="bg-blue-100 text-blue-800">UI Component</Badge>
              {content.ui?.identifier && (
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  {content.ui.identifier}
                </Badge>
              )}
              {content.ui?.interactive && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Interactive
                </Badge>
              )}
              {content.ui?.final && (
                <Badge variant="outline" className="text-purple-600 border-purple-600">
                  Final
                </Badge>
              )}
            </div>
            {content.ui && (
              <div className="space-y-1 text-sm">
                <div><strong>Kind:</strong> {content.ui.kind}</div>
                <div><strong>Namespace:</strong> {content.ui.namespace}</div>
                <div><strong>Identifier:</strong> {content.ui.identifier}</div>
                <div><strong>Instance ID:</strong> {content.ui.customUiInstanceId}</div>
              </div>
            )}
          </div>
        );

      case 'linkout':
        return (
          <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-green-600" />
              <Badge className="bg-green-100 text-green-800">Linkout</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm">
                <strong>Text:</strong> {content.text || 'No text provided'}
              </div>
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm break-all"
              >
                {content.url}
              </a>
            </div>
          </div>
        );

      default:
        return (
          <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Badge variant="outline">Unknown Content Type</Badge>
          </div>
        );
    }
  };


  // Loading state while processing
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Conversation Detail</h1>
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1>Conversation Detail</h1>
          <p className="text-muted-foreground">
            Analyze individual conversations and their message content
          </p>
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




      {error && !selectedThread && (
        <Alert variant="destructive" className="border-2 border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <div className="font-semibold mb-2">Conversation Not Available</div>
            {error}
            {error.includes('referenced from thread data') && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                <strong>💡 How to Fix This:</strong> You have uploaded thread data that references this conversation ID, but the actual conversation data is not available. 
                To view the full conversation details, you can:
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Upload the conversation data using the Upload Data tab</li>
                  <li>Clear all uploaded data to fetch conversations via API</li>
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Show thread details when conversation data isn't available but thread data is */}
      {error && selectedThread && error.includes('referenced from thread data') && (
        <div className="space-y-6">
          <Alert className="border-2 border-blue-500 bg-blue-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <div className="font-semibold mb-2">Thread Details Available</div>
              The conversation data for this thread isn't uploaded, but here are the thread details from your uploaded data:
            </AlertDescription>
          </Alert>

          {/* Thread Details Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Thread Details</CardTitle>
                  <CardDescription>ID: {selectedThread.id}</CardDescription>
                </div>
                <Badge variant="outline">
                  {selectedThread.messages.filter(m => m.role !== 'system').length} messages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label>Conversation ID</Label>
                  <p className="text-sm font-mono">{selectedThread.conversationId}</p>
                </div>
                <div>
                  <Label>Created At</Label>
                  <p className="text-sm">{formatTimestamp(selectedThread.createdAt)}</p>
                </div>
              </div>

              {/* Thread Messages */}
              <div>
                <h4 className="font-medium mb-4">Messages ({selectedThread.messages.filter(m => m.role !== 'system').length})</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedThread.messages.filter(message => showSystemMessages || message.role !== 'system').map((message, index) => {
                    const { consolidatedText, otherContents } = consolidateMessageContent(message.content);
                    
                    return (
                      <div key={index} className={`border rounded-lg p-4 ${
                        message.role === 'system' ? 'border-orange-200 bg-orange-50' : ''
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {message.role === 'user' ? (
                            <User className="h-4 w-4 text-blue-600" />
                          ) : message.role === 'system' ? (
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Bot className="h-4 w-4 text-green-600" />
                          )}
                          <Badge variant={
                            message.role === 'user' ? 'default' : 
                            message.role === 'system' ? 'destructive' : 'secondary'
                          }>
                            {message.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {/* Consolidated text content */}
                          {consolidatedText && (
                            <div className="text-sm">
                              <Badge variant="outline" className="text-xs mr-2">
                                message
                              </Badge>
                              <span>{consolidatedText}</span>
                            </div>
                          )}
                          
                          {/* Other content types */}
                          {otherContents.map((content, contentIndex) => (
                            <div key={contentIndex} className="text-sm">
                              <Badge variant="outline" className="text-xs mr-2">
                                {content.kind}
                              </Badge>
                              {content.kind === 'ui' && (
                                <span className="text-blue-600">
                                  <Zap className="h-3 w-3 inline mr-1" />
                                  UI Component {content.ui?.identifier && `(${content.ui.identifier})`}
                                </span>
                              )}
                              {content.kind === 'linkout' && (
                                <span className="text-purple-600">
                                  <ExternalLink className="h-3 w-3 inline mr-1" />
                                  External Link
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Offline Mode Info - show when in offline mode but no conversation loaded and no error */}
      {isOfflineMode && !conversation && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Offline Mode Active:</strong> Select a conversation from the uploaded data in the Dashboard tab to view its details. 
            Conversation IDs that show "ref only" in the threads table don't have their full conversation data available - 
            only references from thread data.
          </AlertDescription>
        </Alert>
      )}





      {conversation && (
        <>
          {/* Conversation Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{conversation.title}</CardTitle>
                  <CardDescription>ID: {conversation.id}</CardDescription>
                </div>
                <Badge variant="outline">
                  {conversation.messages.filter(m => m.role !== 'system').length} messages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{formatTimestamp(conversation.createdAt)}</p>
                </div>
                <div>
                  <Label>Last Message</Label>
                  <p className="text-sm">{formatTimestamp(conversation.lastMessageAt)}</p>
                </div>
                <div>
                  <Label>Linked Threads</Label>
                  <div className="space-y-1">
                    {conversation.threadIds.map(threadId => {
                      const parsed = parseThreadId(threadId);
                      return (
                        <div key={threadId}>
                          <button
                            onClick={() => onThreadSelect?.(threadId)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {parsed.namespace}/{parsed.id}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">UI Events</p>
                        <p className="text-2xl font-bold">{analytics.totalUiEvents}</p>
                      </div>
                      <Zap className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Interactive UI</p>
                        <p className="text-2xl font-bold">{analytics.interactiveCount}</p>
                      </div>
                      <Badge className="h-8 w-8 rounded-full bg-green-100 text-green-800 text-xs flex items-center justify-center">
                        I
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Final UI</p>
                        <p className="text-2xl font-bold">{analytics.finalCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          UI components marked as "final state"
                        </p>
                      </div>
                      <Badge className="h-8 w-8 rounded-full bg-purple-100 text-purple-800 text-xs flex items-center justify-center">
                        F
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Linkouts</p>
                        <p className="text-2xl font-bold">{analytics.totalLinkouts}</p>
                      </div>
                      <ExternalLink className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>


              {/* Linkouts */}
              {Object.keys(analytics.linkoutDomains).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Linkouts by Domain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(analytics.linkoutDomains).map(([domain, data]) => (
                        <div key={domain} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold">{domain}</h4>
                            <Badge variant="outline">{data.count} link(s)</Badge>
                          </div>
                          <div className="space-y-1">
                            {data.urls.map((linkData, index) => (
                              <div key={index}>
                                <a
                                  href={linkData.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {linkData.text}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Message Timeline */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Message Timeline</CardTitle>
                  <CardDescription>
                    Chronological view of all messages in this conversation
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
            <CardContent>
              <div className="space-y-4">
                {filteredMessages.map((message, index) => {
                  const { consolidatedText, otherContents } = consolidateMessageContent(message.content);
                  
                  return (
                    <div key={message.id} className={`border-l-4 pl-4 py-2 ${
                      message.role === 'system' ? 'border-l-orange-500 bg-orange-50/30' :
                      message.role === 'assistant' ? 'border-l-blue-500' : 'border-l-green-500'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        {message.role === 'assistant' ? (
                          <Bot className="h-5 w-5 text-blue-600" />
                        ) : message.role === 'system' ? (
                          <AlertCircle className="h-5 w-5 text-orange-600" />
                        ) : (
                          <User className="h-5 w-5 text-green-600" />
                        )}
                        <Badge variant={
                          message.role === 'assistant' ? 'default' : 
                          message.role === 'system' ? 'destructive' : 'secondary'
                        }>
                          {message.role}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(message.sentAt)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {message.content.length} content item(s)
                        </Badge>
                      </div>
                      
                      <div className="space-y-3 ml-7">
                        {/* Consolidated text content */}
                        {consolidatedText && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4" />
                              <Badge variant="secondary">Message</Badge>
                            </div>
                            <p className="whitespace-pre-wrap">{consolidatedText}</p>
                          </div>
                        )}
                        
                        {/* Other content types (UI, linkouts, etc.) */}
                        {otherContents.map((content, contentIndex) => 
                          renderMessageContent(content, contentIndex)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}