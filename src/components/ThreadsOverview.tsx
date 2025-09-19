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
import { 
  api, 
  ApiError, 
  getApiBaseUrl, 
  getEnvironmentSpecificItem, 
  setEnvironmentSpecificItem 
} from '../lib/api';
import { parseThreadId, calculateThreadAnalytics, formatTimestamp, debounce } from '../lib/utils';

interface ThreadsOverviewProps {
  uploadedThreads?: Thread[];
  uploadedConversations?: any[];
  onThreadSelect?: (thread: Thread) => void;
  onConversationSelect?: (conversationId: string) => void;
  onFetchedConversationsChange?: (conversations: Map<string, any>) => void;
  onThreadOrderChange?: (threadOrder: string[]) => void;
  onConversationViewed?: (conversationId: string) => void;
}

export function ThreadsOverview({ 
  uploadedThreads, 
  uploadedConversations = [],
  onThreadSelect, 
  onConversationSelect,
  onFetchedConversationsChange,
  onThreadOrderChange,
  onConversationViewed
}: ThreadsOverviewProps) {
  const [threads, setThreads] = useState<Thread[]>(() => {
    // If we have uploaded threads, use them and clear any saved search results
    if (uploadedThreads && uploadedThreads.length > 0) {
      try {
        setEnvironmentSpecificItem('chatbot-dashboard-search-results', '[]');
        setEnvironmentSpecificItem('chatbot-dashboard-search-params', '{}');
      } catch (error) {
        console.error('Failed to clear saved search data:', error);
      }
      return uploadedThreads;
    }
    
    // Try to load environment-specific saved search results
    try {
      const savedThreads = getEnvironmentSpecificItem('chatbot-dashboard-search-results');
      if (savedThreads) {
        const parsed = JSON.parse(savedThreads);
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load environment-specific saved search results:', error);
    }
    
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  
  // Viewed threads tracking
  const [viewedThreads, setViewedThreads] = useState<Set<string>>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-viewed-threads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.error('Failed to load environment-specific viewed threads:', error);
      return new Set();
    }
  });
  
  // Viewed conversations tracking
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.error('Failed to load environment-specific viewed conversations:', error);
      return new Set();
    }
  });

  // Effect to re-read viewed conversations from localStorage when onConversationViewed is called
  useEffect(() => {
    const handleConversationViewed = (event: CustomEvent) => {
      try {
        const saved = getEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations');
        const newViewedConversations = saved ? new Set(JSON.parse(saved)) : new Set();
        setViewedConversations(newViewedConversations);
        console.log('🔄 Refreshed viewed conversations from environment-specific localStorage after navigation:', newViewedConversations.size);
      } catch (error) {
        console.error('Failed to refresh viewed conversations:', error);
      }
    };

    // Listen for custom conversationViewed events
    window.addEventListener('conversationViewed', handleConversationViewed as EventListener);

    return () => {
      window.removeEventListener('conversationViewed', handleConversationViewed as EventListener);
    };
  }, []);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [hasUiFilter, setHasUiFilter] = useState(false);
  const [hasLinkoutFilter, setHasLinkoutFilter] = useState(false);
  
  // Message search functionality
  const [messageSearchEnabled, setMessageSearchEnabled] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [fetchedConversations, setFetchedConversations] = useState<Map<string, any>>(new Map());
  const [conversationsFetching, setConversationsFetching] = useState(false);
  const [conversationsFetched, setConversationsFetched] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Quick time range filter functions
  const setTimeRange = (hours: number) => {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm) using local timezone
    const formatDateTimeLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setStartDate(formatDateTimeLocal(startTime));
    setEndDate(formatDateTimeLocal(now));
  };

  const setDefaultTimeRange = () => setTimeRange(1); // Default: last 1 hour

  const quickFilters = [
    { label: 'Last Hour', hours: 1 },
    { label: 'Last 24 Hours', hours: 24 },
    { label: 'Last 3 Days', hours: 72 },
    { label: 'Last 7 Days', hours: 168 },
  ];

  // Check if current time range matches a quick filter
  const getCurrentQuickFilter = () => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    // Check if end time is close to now (within 5 minutes) using local time
    const now = new Date();
    const isEndTimeNow = Math.abs(end.getTime() - now.getTime()) < 5 * 60 * 1000;
    
    if (isEndTimeNow) {
      return quickFilters.find(filter => filter.hours === diffHours)?.hours || null;
    }
    
    return null;
  };

  const activeQuickFilter = getCurrentQuickFilter();

  useEffect(() => {
    // Try to load saved search parameters first
    try {
      const savedParams = getEnvironmentSpecificItem('chatbot-dashboard-search-params');
      if (savedParams) {
        const parsed = JSON.parse(savedParams);
        setStartDate(parsed.startDate);
        setEndDate(parsed.endDate);
        return;
      }
    } catch (error) {
      console.error('Failed to load saved search parameters:', error);
    }
    
    // Set smart defaults based on current system time
    setDefaultTimeRange();
  }, []);

  // Update threads when uploaded data changes
  useEffect(() => {
    // Only act if we have actual uploaded threads (not empty array)
    if (uploadedThreads && uploadedThreads.length > 0) {
      setThreads(uploadedThreads);
      setError(null);
      
      // Clear saved search results when using uploaded data
      try {
        setEnvironmentSpecificItem('chatbot-dashboard-search-results', '[]');
        setEnvironmentSpecificItem('chatbot-dashboard-search-params', '{}');
      } catch (error) {
        console.error('Failed to clear saved search data:', error);
      }
    }
  }, [uploadedThreads]);

  // Batch fetch conversations for message search
  const fetchConversationsForThreads = async (threadsToFetch: Thread[]) => {
    setConversationsFetching(true);
    setError(null);
    
    try {
      const apiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key');
      if (!apiKey) {
        throw new Error('API key not found. Please set it in the dashboard header.');
      }

      console.log('🔍 Fetching conversations for message search:', threadsToFetch.length, 'threads');
      
      // Batch fetch conversations with concurrent requests (limit to avoid overwhelming the API)
      const batchSize = 5;
      const newConversations = new Map(fetchedConversations);
      
      for (let i = 0; i < threadsToFetch.length; i += batchSize) {
        const batch = threadsToFetch.slice(i, i + batchSize);
        
        const promises = batch.map(async (thread) => {
          // Skip if already fetched
          if (newConversations.has(thread.conversationId)) {
            return null;
          }
          
          try {
            const apiBaseUrl = getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/conversation/${thread.conversationId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            });
            
            if (!response.ok) {
              console.warn(`Failed to fetch conversation ${thread.conversationId}: ${response.status}`);
              return null;
            }
            
            const conversation = await response.json();
            return { conversationId: thread.conversationId, conversation };
          } catch (error) {
            console.warn(`Error fetching conversation ${thread.conversationId}:`, error);
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach(result => {
          if (result) {
            newConversations.set(result.conversationId, result.conversation);
          }
        });
        
        // Update state after each batch to show progress
        setFetchedConversations(new Map(newConversations));
        
        // Small delay between batches to be nice to the API
        if (i + batchSize < threadsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      setConversationsFetched(true);
      console.log('✅ Fetched conversations for message search:', newConversations.size, 'conversations');
      
      // Notify parent component about fetched conversations
      onFetchedConversationsChange?.(newConversations);
      
    } catch (error: any) {
      console.error('❌ Error fetching conversations:', error);
      setError(`Failed to fetch conversations: ${error.message}`);
    } finally {
      setConversationsFetching(false);
    }
  };

  const fetchThreads = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    // Get API key from environment-specific localStorage
    const apiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key');
    if (!apiKey?.trim()) {
      setError('API key is required. Please set it in the dashboard header.');
      return;
    }

    setLoading(true);
    setError(null);
    setThreads([]); // Clear existing threads

    try {
      // Format timestamps for the API
      const startTimestamp = new Date(startDate).toISOString();
      const endTimestamp = new Date(endDate).toISOString();

      // Make API call via proxy to avoid CORS issues
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          startTimestamp,
          endTimestamp,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Extract threads from the response structure
      const fetchedThreads = data.threads?.map((item: any) => item.thread) || [];
      setThreads(fetchedThreads);
      
      // Save search results and parameters to environment-specific localStorage for persistence
      try {
        setEnvironmentSpecificItem('chatbot-dashboard-search-results', JSON.stringify(fetchedThreads));
        setEnvironmentSpecificItem('chatbot-dashboard-search-params', JSON.stringify({
          startDate,
          endDate
        }));
      } catch (error) {
        console.error('Failed to save environment-specific search data:', error);
      }
      
      if (fetchedThreads.length === 0) {
        setError('No threads found for the selected time range.');
      }
    } catch (err) {
      let errorMessage = 'Failed to fetch threads';
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Network error: Unable to connect to API. Check your internet connection and CORS settings.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
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
          !thread.conversationId.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Message content search filter
      if (messageSearchEnabled && messageSearchTerm) {
        const conversation = fetchedConversations.get(thread.conversationId);
        if (!conversation) {
          // If conversations haven't been fetched yet, don't filter out
          return !conversationsFetched;
        }
        
        const searchLower = messageSearchTerm.toLowerCase();
        const hasMatchingMessage = conversation.messages?.some((message: any) => {
          // Search in message content
          if (message.content) {
            return message.content.some((content: any) => {
              if (content.text && content.text.toLowerCase().includes(searchLower)) {
                return true;
              }
              if (content.content && content.content.toLowerCase().includes(searchLower)) {
                return true;
              }
              return false;
            });
          }
          return false;
        });
        
        if (!hasMatchingMessage) return false;
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

      return true;
    }).sort((a, b) => {
      // Sort by createdAt timestamp with most recent first (descending order)
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [threads, searchTerm, hasUiFilter, hasLinkoutFilter, messageSearchEnabled, messageSearchTerm, fetchedConversations, conversationsFetched]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / itemsPerPage);
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredThreads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredThreads, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, hasUiFilter, hasLinkoutFilter]);

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

  // Handle thread viewing
  const handleThreadView = (thread: Thread) => {
    // Mark thread as viewed
    const newViewedThreads = new Set(viewedThreads);
    newViewedThreads.add(thread.id);
    setViewedThreads(newViewedThreads);
    
    // Persist to localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-viewed-threads', JSON.stringify(Array.from(newViewedThreads)));
    } catch (error) {
      console.error('Failed to save viewed threads:', error);
    }
    
    // Call the original onThreadSelect callback
    onThreadSelect?.(thread);
  };

  // Mark conversation as viewed (can be called externally)
  const markConversationAsViewed = (conversationId: string) => {
    const newViewedConversations = new Set(viewedConversations);
    newViewedConversations.add(conversationId);
    setViewedConversations(newViewedConversations);
    
    // Persist to localStorage
    try {
      setEnvironmentSpecificItem('chatbot-dashboard-viewed-conversations', JSON.stringify(Array.from(newViewedConversations)));
      console.log('📋 Marked conversation as viewed:', conversationId);
    } catch (error) {
      console.error('Failed to save viewed conversations:', error);
    }
    
    // Notify parent component
    onConversationViewed?.(conversationId);
  };

  // Handle conversation viewing
  const handleConversationView = (conversationId: string) => {
    console.log('👆 handleConversationView called with:', conversationId);
    console.log('👆 filteredThreads length:', filteredThreads.length);
    console.log('👆 onThreadOrderChange available?', !!onThreadOrderChange);
    
    // Mark conversation as viewed
    markConversationAsViewed(conversationId);
    
    // Find the thread associated with this conversation to pass system messages
    const associatedThread = filteredThreads.find(thread => thread.conversationId === conversationId);
    if (associatedThread && onThreadSelect) {
      // If we have the thread data, pass it so system messages are available
      onThreadSelect(associatedThread);
    }
    
    // Notify parent about the thread order for navigation FIRST
    const threadOrder = filteredThreads.map(thread => thread.conversationId);
    console.log('📋 Thread order for navigation:', threadOrder.length, 'total threads');
    console.log('📋 First 5 thread IDs:', threadOrder.slice(0, 5));
    console.log('📋 Clicked conversation in thread order?', threadOrder.includes(conversationId));
    onThreadOrderChange?.(threadOrder);
    
    // Fetch more conversations for better navigation experience
    const currentIndex = filteredThreads.findIndex(thread => thread.conversationId === conversationId);
    if (currentIndex !== -1) {
      const conversationsToFetch = [];
      
      // Fetch a wider range around the current conversation (5 before, current, 5 after)
      const rangeSize = 5;
      const startIndex = Math.max(0, currentIndex - rangeSize);
      const endIndex = Math.min(filteredThreads.length - 1, currentIndex + rangeSize);
      
      for (let i = startIndex; i <= endIndex; i++) {
        conversationsToFetch.push(filteredThreads[i]);
      }
      
      console.log(`📚 Fetching ${conversationsToFetch.length} conversations around index ${currentIndex} (range: ${startIndex}-${endIndex})`);
      
      // Fetch these conversations in the background
      fetchConversationsForThreads(conversationsToFetch);
    }
    
    // Call the original onConversationSelect callback
    onConversationSelect?.(conversationId);
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1>🤖 CHECK24 Bot Dashboard</h1>
          <p className="text-muted-foreground">
            {uploadedConversations.length > 0 && threads.length > 0 
              ? "Analyze conversations, threads, and chatbot interactions"
              : uploadedConversations.length > 0 
              ? "Analyze uploaded conversations and their message content"
              : "Analyze chatbot conversations and threads over time"
            }
          </p>
        </div>
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



      {/* API Search Section - always show for direct API calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Threads via API
          </CardTitle>
          <CardDescription>
            Search threads directly from the API using date/time filters. This will populate the threads table below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Filter Buttons */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.hours}
                  variant={activeQuickFilter === filter.hours ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange(filter.hours)}
                  className="text-xs"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Date/Time Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date & Time</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date & Time</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Button 
                  id="searchButton"
                  onClick={fetchThreads} 
                  disabled={loading || !startDate || !endDate}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Threads
                    </>
                  )}
                </Button>
                {threads.length > 0 && !uploadedThreads?.length && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setThreads([]);
                    setError(null);
                    setFetchedConversations(new Map());
                    setConversationsFetched(false);
                    setMessageSearchEnabled(false);
                    setMessageSearchTerm('');
                    try {
                      setEnvironmentSpecificItem('chatbot-dashboard-search-results', '[]');
                      setEnvironmentSpecificItem('chatbot-dashboard-search-params', '{}');
                    } catch (error) {
                      console.error('Failed to clear saved search data:', error);
                    }
                  }}
                  className="flex-shrink-0"
                >
                  Clear
                </Button>
                )}
              </div>
            </div>
          </div>

          {/* Message Search - only show after thread search results */}
          {threads.length > 0 && !uploadedThreads?.length && (
            <div className="border-t pt-4 space-y-3 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="messageSearch"
                  checked={messageSearchEnabled}
                  onCheckedChange={setMessageSearchEnabled}
                />
                <Label htmlFor="messageSearch" className="text-sm font-medium">
                  Search within conversation messages
                </Label>
              </div>
              
              {messageSearchEnabled && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search message content..."
                      value={messageSearchTerm}
                      onChange={(e) => setMessageSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => fetchConversationsForThreads(threads.slice(0, 500))}
                      disabled={conversationsFetching || !messageSearchTerm.trim()}
                      variant="outline"
                    >
                      {conversationsFetching ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search Messages
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Limit warning */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Limit:</strong> Only the first 500 conversations will be searched to ensure reasonable response times. 
                      {threads.length > 500 && (
                        <span className="text-amber-600"> Found {threads.length} threads, searching first 500.</span>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  {conversationsFetching && (
                    <div className="text-sm text-muted-foreground">
                      Fetching conversations for message search... ({fetchedConversations.size}/{Math.min(threads.length, 500)})
                    </div>
                  )}
                  
                  {conversationsFetched && messageSearchTerm && (
                    <div className="text-sm text-green-600 font-medium">
                      ✓ Found {filteredThreads.length} threads containing "{messageSearchTerm}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                  onClick={() => handleConversationView(conversation.id)}
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <CardTitle>Threads ({filteredThreads.length})</CardTitle>
                {startDate && endDate && !uploadedThreads?.length && (
                  <div className="text-sm text-muted-foreground bg-slate-50 px-3 py-1 rounded-md border">
                    <span className="font-medium">Search period:</span> {new Date(startDate).toLocaleString()} - {new Date(endDate).toLocaleString()}
                  </div>
                )}
              </div>
              
              {/* Search & Filters integrated into threads container */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by thread ID or conversation ID"
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
                </div>
              </div>
            </div>
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

                  const isThreadViewed = viewedThreads.has(thread.id);
                  const isConversationViewed = viewedConversations.has(thread.conversationId);
                  const isAnyViewed = isThreadViewed || isConversationViewed;
                  
                  return (
                    <TableRow key={thread.id} className={`cursor-pointer hover:bg-muted/50 ${isAnyViewed ? 'bg-gray-50' : ''} h-16`}>
                      <TableCell onClick={(e) => e.stopPropagation()} className="py-4">
                        <Checkbox
                          checked={selectedThreads.has(thread.id)}
                          onCheckedChange={() => toggleThreadSelection(thread.id)}
                        />
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId)} className="py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className={`${!isAnyViewed ? 'font-bold' : ''} text-foreground`}>{parsed.id}</div>
                          </div>
                          {isAnyViewed && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                              Viewed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell 
                        onClick={() => handleConversationView(thread.conversationId)}
                        className="cursor-pointer py-4"
                        title={hasConversationData ? "Click to view conversation details" : "Conversation data not available - referenced from thread only"}
                      >
                        <div className="flex items-center gap-2">
                          <div>
                            <div className={`${hasConversationData ? "text-blue-600 hover:underline" : "text-foreground"}`}>
                              {thread.conversationId}
                            </div>
                          </div>
                          {!hasConversationData && uploadedConversations.length > 0 && (
                            <Badge variant="outline" className="text-xs text-gray-500">
                              ref only
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId)} className="py-4">
                        {formatTimestamp(thread.createdAt)}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId)} className="py-4">
                        {uiCount > 0 ? (
                          <Badge variant="outline">{uiCount}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId)} className="py-4">
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