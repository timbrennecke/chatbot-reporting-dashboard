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
  AlertCircle
} from 'lucide-react';
import { Conversation, MessageContent } from '../lib/types';
import { api, ApiError } from '../lib/api';
import { formatTimestamp, parseThreadId } from '../lib/utils';

interface ConversationDetailProps {
  conversationId?: string;
  uploadedConversation?: Conversation;
  hasAnyUploadedConversations?: boolean;
  onThreadSelect?: (threadId: string) => void;
}

export function ConversationDetail({ 
  conversationId, 
  uploadedConversation, 
  hasAnyUploadedConversations = false,
  onThreadSelect 
}: ConversationDetailProps) {
  // Initialize state with uploaded conversation if available
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');

  // Determine if we're in offline mode (any uploaded conversation data exists)
  const isOfflineMode = hasAnyUploadedConversations;

  // Update conversation when props change
  useEffect(() => {
    console.log('🔄 ConversationDetail useEffect triggered:', {
      conversationId,
      hasUploadedConversation: !!uploadedConversation,
      isOfflineMode,
      hasAnyUploadedConversations
    });

    // FIRST CHECK: If there's ANY uploaded conversation data, we're in offline mode
    if (hasAnyUploadedConversations) {
      console.log('🔒 OFFLINE MODE DETECTED - No API calls allowed');
      
      if (uploadedConversation) {
        console.log('✅ Using uploaded conversation data');
        setConversation(uploadedConversation);
        setSearchId(uploadedConversation.id);
        setError(null);
      } else if (conversationId) {
        console.log('❌ Conversation not found in uploaded data');
        setConversation(null);
        setSearchId(conversationId);
        setError(`Conversation "${conversationId}" not found in uploaded data. This conversation ID was referenced from thread data, but the actual conversation data was not uploaded. To view this conversation, please upload the conversation data or clear all data to use API mode.`);
      } else {
        console.log('🧹 Clearing state - no conversation selected');
        setConversation(null);
        setSearchId('');
        setError(null);
      }
      setLoading(false);
      return; // EXIT - No API operations allowed
    }

    // ONLY REACH HERE IF NO UPLOADED DATA EXISTS
    console.log('🌐 Online mode - API operations allowed');
    
    if (conversationId) {
      console.log('🌐 Attempting API fetch for:', conversationId);
      setSearchId(conversationId);
      // Safe to call API - no uploaded data exists
      fetchConversation(conversationId);
    } else {
      console.log('🧹 Clearing conversation state');
      setConversation(null);
      setSearchId('');
      setError(null);
      setLoading(false);
    }
  }, [conversationId, uploadedConversation, hasAnyUploadedConversations, fetchConversation]);

  const fetchConversation = useCallback(async (id?: string) => {
    console.log('🔍 fetchConversation called with:', {
      id,
      isOfflineMode,
      hasAnyUploadedConversations,
      hasUploadedConversation: !!uploadedConversation,
      searchId
    });

    // ABSOLUTE BLOCK: Never attempt API calls if we have any uploaded data
    if (isOfflineMode || hasAnyUploadedConversations || uploadedConversation) {
      console.error('🚫 BLOCKED: API call attempted while in offline mode!', {
        isOfflineMode,
        hasAnyUploadedConversations,
        hasUploadedConversation: !!uploadedConversation
      });
      setError('🚫 API calls are disabled when uploaded conversation data is present. Please use the conversations from the dashboard or clear all data to use API mode.');
      setLoading(false);
      return;
    }

    const targetId = id || searchId;
    if (!targetId) {
      setError('Please enter a conversation ID');
      return;
    }

    console.log('🌐 Making API call for conversation:', targetId);
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

  // Group consecutive text content items together
  const groupMessageContent = (contents: MessageContent[]) => {
    const grouped: Array<{ type: 'text'; content: string; startIndex: number } | { type: 'other'; content: MessageContent; index: number }> = [];
    let currentTextGroup = '';
    let textStartIndex = -1;

    contents.forEach((content, index) => {
      if (content.kind === 'text') {
        if (currentTextGroup === '') {
          textStartIndex = index;
        }
        currentTextGroup += content.content;
      } else {
        // If we have accumulated text, add it as a group
        if (currentTextGroup !== '') {
          grouped.push({ type: 'text', content: currentTextGroup, startIndex: textStartIndex });
          currentTextGroup = '';
        }
        // Add the non-text content
        grouped.push({ type: 'other', content, index });
      }
    });

    // Don't forget any remaining text at the end
    if (currentTextGroup !== '') {
      grouped.push({ type: 'text', content: currentTextGroup, startIndex: textStartIndex });
    }

    return grouped;
  };

  const renderMessageContent = (content: MessageContent, index: number) => {
    switch (content.kind) {
      case 'ui':
        return (
          <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <Badge className="bg-blue-100 text-blue-800">UI Component</Badge>
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

  const renderGroupedTextContent = (textContent: string, startIndex: number) => {
    return (
      <div key={`text-${startIndex}`} className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4" />
          <Badge variant="secondary">Text</Badge>
        </div>
        <p className="whitespace-pre-wrap">{textContent}</p>
      </div>
    );
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
      <div>
        <h1>Conversation Detail</h1>
        <p className="text-muted-foreground">
          Analyze individual conversations and their message content
        </p>
      </div>



      {/* Search - only show when not in offline mode */}
      {!isOfflineMode && (
        <Card>
          <CardHeader>
            <CardTitle>Load Conversation</CardTitle>
            <CardDescription>
              Enter a conversation ID to fetch and analyze its details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="conversationId">Conversation ID</Label>
                <Input
                  id="conversationId"
                  placeholder="01990f50-2c0a-76ff-8d8d-d13648d6bb15"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={() => fetchConversation()} 
                  disabled={loading || hasAnyUploadedConversations}
                >
                  {loading ? 'Loading...' : 'Fetch'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes('referenced from thread data') && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                <strong>Tip:</strong> You have uploaded thread data that references this conversation ID, but the actual conversation data is not available. 
                To view the full conversation details, you can:
                <ul className="mt-1 ml-4 list-disc">
                  <li>Upload the conversation data using the Upload Data tab</li>
                  <li>Clear all uploaded data to fetch conversations via API</li>
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
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
                  {conversation.messages.length} messages
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

              {/* Charts */}
              {(uiKindData.length > 0 || namespaceData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {uiKindData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>UI Components by Kind</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={uiKindData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="kind" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {namespaceData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>UI Components by Namespace</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={namespaceData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="namespace" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

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
              <CardTitle>Message Timeline</CardTitle>
              <CardDescription>
                Chronological view of all messages in this conversation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversation.messages.map((message, index) => (
                  <div key={message.id} className="border-l-4 border-l-primary pl-4 py-2">
                    <div className="flex items-center gap-2 mb-3">
                      {message.role === 'assistant' ? (
                        <Bot className="h-5 w-5 text-blue-600" />
                      ) : (
                        <User className="h-5 w-5 text-green-600" />
                      )}
                      <Badge variant={message.role === 'assistant' ? 'default' : 'secondary'}>
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
                      {groupMessageContent(message.content).map((group, groupIndex) => {
                        if (group.type === 'text') {
                          return renderGroupedTextContent(group.content, group.startIndex);
                        } else {
                          return renderMessageContent(group.content, group.index);
                        }
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}