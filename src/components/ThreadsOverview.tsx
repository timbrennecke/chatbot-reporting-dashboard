import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from './ui/pagination';
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
  Calendar, 
  Search, 
  Download, 
  RefreshCw,
  AlertCircle,
  Users,
  MessageSquare,
  Activity,
  Clock,
  Zap,
  ExternalLink
} from 'lucide-react';
import { Thread, ThreadsRequest, BulkAttributesRequest } from '../lib/types';
import { api, ApiError } from '../lib/api';
import { parseThreadId, calculateThreadAnalytics, formatTimestamp, debounce } from '../lib/utils';

interface ThreadsOverviewProps {
  uploadedThreads?: Thread[];
  uploadedConversations?: any[];
  onThreadSelect?: (thread: Thread) => void;
  onConversationSelect?: (conversationId: string) => void;
}

export function ThreadsOverview({ 
  uploadedThreads, 
  uploadedConversations = [],
  onThreadSelect, 
  onConversationSelect 
}: ThreadsOverviewProps) {
  const [threads, setThreads] = useState<Thread[]>(uploadedThreads || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [hasUiFilter, setHasUiFilter] = useState(false);
  const [hasLinkoutFilter, setHasLinkoutFilter] = useState(false);
  const [assistantOnlyFilter, setAssistantOnlyFilter] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Set default date range to today
  useEffect(() => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    setStartDate(startOfDay.toISOString().slice(0, 16));
    setEndDate(endOfDay.toISOString().slice(0, 16));
  }, []);

  // Update threads when uploaded data changes
  useEffect(() => {
    if (uploadedThreads) {
      setThreads(uploadedThreads);
      setError(null);
    }
  }, [uploadedThreads]);

  const fetchThreads = async () => {
    console.log('🔍 ThreadsOverview.fetchThreads called - should only happen when no uploaded data');
    
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: ThreadsRequest = {
        startTimestamp: new Date(startDate).toISOString(),
        endTimestamp: new Date(endDate).toISOString(),
      };

      console.log('🌐 ThreadsOverview making API call to getThreads');
      const response = await api.getThreads(request);
      setThreads(response.threads.map(t => t.thread));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`API Error (${err.endpoint}): ${err.message}${err.requestId ? ` [${err.requestId}]` : ''}`);
      } else {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useMemo(
    () => debounce((term: string) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const parsed = parseThreadId(thread.id);
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !thread.id.toLowerCase().includes(searchLower) &&
          !thread.conversationId.toLowerCase().includes(searchLower) &&
          !parsed.namespace.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }



      // UI filter
      if (hasUiFilter) {
        const hasUi = thread.messages.some(m => 
          m.content.some(c => c.kind === 'ui')
        );
        if (!hasUi) return false;
      }

      // Linkout filter
      if (hasLinkoutFilter) {
        const hasLinkout = thread.messages.some(m => 
          m.content.some(c => c.kind === 'linkout')
        );
        if (!hasLinkout) return false;
      }

      // Assistant only filter
      if (assistantOnlyFilter) {
        const hasOnlyAssistant = thread.messages.every(m => m.role === 'assistant');
        if (!hasOnlyAssistant) return false;
      }

      return true;
    });
  }, [threads, searchTerm, hasUiFilter, hasLinkoutFilter, assistantOnlyFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / itemsPerPage);
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredThreads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredThreads, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, hasUiFilter, hasLinkoutFilter, assistantOnlyFilter]);

  const analytics = useMemo(() => calculateThreadAnalytics(filteredThreads), [filteredThreads]);

  // Calculate conversation analytics
  const conversationAnalytics = useMemo(() => {
    console.log('\n🔍 DATA CHECK:');
    console.log('Uploaded conversations:', uploadedConversations.length);
    console.log('Filtered threads:', filteredThreads.length);
    
    if (!uploadedConversations.length) {
      console.log('❌ No conversation data - conversation analytics will be null');
      return null;
    }
    
    console.log('✅ Using conversation data for analytics');

    let totalMessages = 0;
    let totalUiEvents = 0;
    let totalLinkouts = 0;
    let totalConversations = uploadedConversations.length;
    let totalExcludedMessages = 0;
    
    uploadedConversations.forEach((conversation, convIndex) => {
      console.log(`\n=== CONVERSATION ${convIndex} ===`);
      console.log('Conversation ID:', conversation.id);
      console.log('Total messages in conversation:', conversation.messages?.length || 0);
      
      const allNonSystemMessages = conversation.messages?.filter((message: any) => message.role !== 'system') || [];
      console.log('Non-system messages:', allNonSystemMessages.length);
      
      // Count only non-system messages that don't contain UI components
      const nonSystemMessages = conversation.messages?.filter((message: any) => {
        if (message.role === 'system') return false;
        
        // Debug each message
        console.log(`Message ${message.id} (${message.role}):`);
        console.log('  Content array length:', message.content?.length || 0);
        message.content?.forEach((content: any, i: number) => {
          console.log(`  Content[${i}]: kind="${content.kind}"`);
        });
        
        // Exclude messages that contain UI components
        const hasUiComponent = message.content?.some((content: any) => content.kind === 'ui');
        console.log(`  Has UI component: ${hasUiComponent}`);
        
        if (hasUiComponent) {
          totalExcludedMessages++;
          console.log('  -> EXCLUDED from count');
        } else {
          console.log('  -> INCLUDED in count');
        }
        
        return !hasUiComponent;
      }) || [];
      
      console.log(`Messages after filtering: ${nonSystemMessages.length}`);
      totalMessages += nonSystemMessages.length;
      
      conversation.messages?.forEach((message: any) => {
        message.content?.forEach((content: any) => {
          if (content.kind === 'ui') totalUiEvents++;
          if (content.kind === 'linkout') totalLinkouts++;
        });
      });
    });

    const avgMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

    console.log(`Conversation Analytics: ${totalMessages} messages (${totalExcludedMessages} excluded due to UI), ${totalUiEvents} UI events`);
    
    return {
      totalConversations,
      totalMessages,
      totalUiEvents,
      totalLinkouts,
      avgMessagesPerConversation,
      totalExcludedMessages
    };
  }, [uploadedConversations]);

  // Conversations per day data
  const conversationsPerDay = useMemo(() => {
    const conversationIds = new Set<string>();
    const dailyCounts: Record<string, Set<string>> = {};
    
    threads.forEach(thread => {
      if (!conversationIds.has(thread.conversationId)) {
        conversationIds.add(thread.conversationId);
        const date = new Date(thread.createdAt).toISOString().split('T')[0];
        if (!dailyCounts[date]) {
          dailyCounts[date] = new Set();
        }
        dailyCounts[date].add(thread.conversationId);
      }
    });

    return Object.entries(dailyCounts)
      .map(([date, conversations]) => ({
        date,
        conversations: conversations.size,
        formattedDate: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [threads]);

  const handleBulkAttributes = async () => {
    if (selectedThreads.size === 0) return;

    console.log('🔍 ThreadsOverview.handleBulkAttributes called');
    setBulkLoading(true);
    setError(null);

    try {
      const request: BulkAttributesRequest = {
        threads: Array.from(selectedThreads as Set<string>).map(threadId => ({ threadId })),
      };

      console.log('🌐 ThreadsOverview making API call to getBulkAttributes');
      const response = await api.getBulkAttributes(request);
      setBulkResults(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Bulk Attributes Error: ${err.message}`);
      } else {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleThreadSelection = (threadId: string) => {
    const newSelection = new Set(selectedThreads);
    if (newSelection.has(threadId)) {
      newSelection.delete(threadId);
    } else {
      newSelection.add(threadId);
    }
    setSelectedThreads(newSelection);
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1>Dashboard Overview</h1>
          <p className="text-muted-foreground">
            {uploadedConversations.length > 0 && threads.length > 0 
              ? "Analyze conversations, threads, and chatbot interactions"
              : uploadedConversations.length > 0 
              ? "Analyze uploaded conversations and their message content"
              : "Analyze chatbot conversations and threads over time"
            }
          </p>
        </div>
        {!uploadedThreads && !uploadedConversations.length && (
          <Button onClick={fetchThreads} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Fetch Threads
              </>
            )}
          </Button>
        )}
      </div>

      {/* Conversation KPIs (when uploaded) */}
      {conversationAnalytics && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h3 className="text-lg font-semibold text-blue-700">📊 CONVERSATION ANALYTICS</h3>
            <p className="text-sm text-blue-600">Showing data from uploaded conversation files</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Conversations</p>
                  <p className="text-lg font-bold">{conversationAnalytics.totalConversations.toLocaleString()}</p>
                </div>
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Messages</p>
                  <p className="text-lg font-bold">{conversationAnalytics.totalMessages.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-6 w-6 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">UI Events</p>
                  <p className="text-lg font-bold">{conversationAnalytics.totalUiEvents.toLocaleString()}</p>
                </div>
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Linkouts</p>
                  <p className="text-lg font-bold">{conversationAnalytics.totalLinkouts.toLocaleString()}</p>
                </div>
                <ExternalLink className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>
          </div>
        </>
      )}


      {/* Search & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by thread ID, conversation ID, or namespace"
                  className="pl-10 h-9"
                  onChange={(e) => debouncedSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasUi"
              checked={hasUiFilter}
              onCheckedChange={(checked) => setHasUiFilter(checked as boolean)}
            />
            <Label htmlFor="hasUi" className="text-sm">Has UI Components</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasLinkout"
              checked={hasLinkoutFilter}
              onCheckedChange={(checked) => setHasLinkoutFilter(checked as boolean)}
            />
            <Label htmlFor="hasLinkout" className="text-sm">Has Linkouts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="assistantOnly"
              checked={assistantOnlyFilter}
              onCheckedChange={(checked) => setAssistantOnlyFilter(checked as boolean)}
            />
            <Label htmlFor="assistantOnly" className="text-sm">Assistant Only</Label>
          </div>
        </div>
      </div>

      {/* Time Range Filter - only show when no uploaded data */}
      {!uploadedThreads && !uploadedConversations.length && (
        <Card>
          <CardHeader>
            <CardTitle>Time Range Filter</CardTitle>
            <CardDescription>
              Select the date range to analyze threads (required for API calls)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date & Time</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date & Time</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Uploaded Conversations */}
      {uploadedConversations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Uploaded Conversations
            </CardTitle>
            <CardDescription>
              Click on any conversation to view detailed analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedConversations.map((conversation) => (
                <div 
                  key={conversation.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onConversationSelect?.(conversation.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-600 hover:underline">
                        {conversation.title}
                      </h4>
                      <p className="text-sm text-muted-foreground font-mono">
                        ID: {conversation.id}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{conversation.messages?.filter((msg: any) => {
                          if (msg.role === 'system') return false;
                          const hasUiComponent = msg.content?.some((content: any) => content.kind === 'ui');
                          return !hasUiComponent;
                        }).length || 0} messages</span>
                        <span>{conversation.threadIds?.length || 0} threads</span>
                        <span>{formatTimestamp(conversation.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">
                        {conversation.messages?.reduce((acc: number, msg: any) => 
                          acc + (msg.content?.filter((c: any) => c.kind === 'ui').length || 0), 0
                        )} UI
                      </Badge>
                      <Badge variant="outline">
                        {conversation.messages?.reduce((acc: number, msg: any) => 
                          acc + (msg.content?.filter((c: any) => c.kind === 'linkout').length || 0), 0
                        )} Links
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}



      {/* Bulk Actions */}
      {selectedThreads.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
            <CardDescription>
              {selectedThreads.size} thread(s) selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBulkAttributes} 
              disabled={bulkLoading}
              className="mr-4"
            >
              {bulkLoading ? 'Processing...' : 'Process Attributes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedThreads(new Set())}
            >
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Results */}
      {bulkResults && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Attributes Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bulkResults.results.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">Successful:</h4>
                  {bulkResults.results.map((result: any, index: number) => (
                    <div key={index} className="p-2 bg-green-50 rounded flex justify-between">
                      <span>{result.threadId.threadId}</span>
                      <Badge variant="outline">
                        {result.meta.status} - {formatTimestamp(result.meta.scheduledFor)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              
              {bulkResults.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                  {bulkResults.errors.map((error: any, index: number) => (
                    <div key={index} className="p-2 bg-red-50 rounded">
                      <div className="flex justify-between">
                        <span>{error.threadId.threadId}</span>
                        <Badge variant="destructive">{error.code}</Badge>
                      </div>
                      <p className="text-sm text-red-600 mt-1">{error.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Threads Table (only show when threads are available) */}
      {threads.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Threads ({filteredThreads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedThreads.length > 0 && paginatedThreads.every(thread => selectedThreads.has(thread.id))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedThreads(new Set(paginatedThreads.map(t => t.id)));
                        } else {
                          setSelectedThreads(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Thread ID</TableHead>
                  <TableHead>Conversation ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>UI Events</TableHead>
                  <TableHead>Linkouts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedThreads.map((thread) => {
                  const parsed = parseThreadId(thread.id);
                  const uiCount = thread.messages.reduce(
                    (acc, msg) => acc + msg.content.filter(c => c.kind === 'ui').length, 
                    0
                  );
                  const linkoutCount = thread.messages.reduce(
                    (acc, msg) => acc + msg.content.filter(c => c.kind === 'linkout').length, 
                    0
                  );

                  // Check if this conversation ID exists in uploaded conversations
                  const hasConversationData = uploadedConversations.some(c => c.id === thread.conversationId);

                  return (
                    <TableRow key={thread.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedThreads.has(thread.id)}
                          onCheckedChange={() => toggleThreadSelection(thread.id)}
                        />
                      </TableCell>
                      <TableCell onClick={() => onThreadSelect?.(thread)}>
                        <div>
                          <div className="font-medium">{parsed.id}</div>
                          <Badge variant="secondary" className="text-xs">
                            {parsed.namespace}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell 
                        onClick={() => onConversationSelect?.(thread.conversationId)}
                        className={hasConversationData ? "text-blue-600 hover:underline" : "text-gray-500"}
                        title={hasConversationData ? "Click to view conversation details" : "Conversation data not available - referenced from thread only"}
                      >
                        <div className="flex items-center gap-2">
                          {thread.conversationId}
                          {!hasConversationData && uploadedConversations.length > 0 && (
                            <Badge variant="outline" className="text-xs text-gray-500">
                              ref only
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => onThreadSelect?.(thread)}>
                        {formatTimestamp(thread.createdAt)}
                      </TableCell>
                      <TableCell onClick={() => onThreadSelect?.(thread)}>
                        {thread.messages.filter(msg => {
                          if (msg.role === 'system') return false;
                          const hasUiComponent = msg.content.some(content => content.kind === 'ui');
                          return !hasUiComponent;
                        }).length}
                      </TableCell>
                      <TableCell onClick={() => onThreadSelect?.(thread)}>
                        {uiCount > 0 ? (
                          <Badge variant="outline">{uiCount}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell onClick={() => onThreadSelect?.(thread)}>
                        {linkoutCount > 0 ? (
                          <Badge variant="outline">{linkoutCount}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredThreads.length)} of {filteredThreads.length} threads
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      >
                        First
                      </PaginationLink>
                    </PaginationItem>
                    
                    {/* Show page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversations per Day Chart */}
      {conversationsPerDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversations per Day</CardTitle>
            <CardDescription>
              Daily conversation volume based on thread creation dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversationsPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value) => [`${value} conversations`, 'Conversations']}
                />
                <Bar dataKey="conversations" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}