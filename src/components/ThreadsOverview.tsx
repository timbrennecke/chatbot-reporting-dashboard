import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ExternalLink,
  Bookmark,
  ChevronDown,
  Filter
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
import { IntentAnalysis } from './IntentAnalysis';

interface ThreadsOverviewProps {
  uploadedThreads?: Thread[];
  uploadedConversations?: any[];
  onThreadSelect?: (thread: Thread) => void;
  onConversationSelect?: (conversationId: string, position?: number) => void;
  onFetchedConversationsChange?: (conversations: Map<string, any>) => void;
  onThreadOrderChange?: (threadOrder: string[]) => void;
  onConversationViewed?: (conversationId: string) => void;
  onThreadsChange?: (threads: Thread[]) => void; // New callback to pass current threads to parent
  savedConversationIds?: Set<string>;
}

export function ThreadsOverview({ 
  uploadedThreads, 
  uploadedConversations = [],
  onThreadSelect, 
  onConversationSelect,
  onFetchedConversationsChange,
  onThreadOrderChange,
  onConversationViewed,
  onThreadsChange,
  savedConversationIds = new Set()
}: ThreadsOverviewProps) {
  const [threads, setThreads] = useState<Thread[]>(() => {
    // If we have uploaded threads, use them
    if (uploadedThreads && uploadedThreads.length > 0) {
      return uploadedThreads;
    }
    
    // Start with empty array - no more caching
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, currentDate: '' });
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchDates, setLastSearchDates] = useState<{startDate: string, endDate: string} | null>(null);
  
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
        // Refreshed viewed conversations from localStorage
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
  
  // Filters with localStorage persistence
  const [startDate, setStartDate] = useState<string>(() => {
    try {
      const saved = getEnvironmentSpecificItem('threads-search-start-date');
      if (saved) {
        console.log('📋 Loaded saved start date:', saved);
        return saved;
      }
    } catch (error) {
      console.warn('Failed to load saved start date:', error);
    }
    // Default to 1 hour ago
    const date = new Date();
    date.setHours(date.getHours() - 1);
    const defaultValue = date.toISOString().slice(0, 16);
    console.log('📋 Using default start date:', defaultValue);
    return defaultValue; // Format for datetime-local input
  });
  const [endDate, setEndDate] = useState<string>(() => {
    try {
      const saved = getEnvironmentSpecificItem('threads-search-end-date');
      if (saved) return saved;
    } catch (error) {
      console.warn('Failed to load saved end date:', error);
    }
    // Default to current system time
    return new Date().toISOString().slice(0, 16); // Format for datetime-local input
  });
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      const saved = getEnvironmentSpecificItem('threads-search-term');
      return saved || '';
    } catch (error) {
      console.warn('Failed to load saved search term:', error);
      return '';
    }
  });

  const [hasUiFilter, setHasUiFilter] = useState(false);
  const [hasLinkoutFilter, setHasLinkoutFilter] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const toolDropdownRef = useRef<HTMLDivElement>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showTimeoutsOnly, setShowTimeoutsOnly] = useState(false);

  // Advanced filters
  const [minMessages, setMinMessages] = useState<number | ''>('');
  const [maxMessages, setMaxMessages] = useState<number | ''>('');
  const [minDuration, setMinDuration] = useState<number | ''>('');
  const [maxDuration, setMaxDuration] = useState<number | ''>('');
  const [minResponseTime, setMinResponseTime] = useState<number | ''>('');
  const [maxResponseTime, setMaxResponseTime] = useState<number | ''>('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolDropdownRef.current && !toolDropdownRef.current.contains(event.target as Node)) {
        setToolDropdownOpen(false);
      }
    }

    if (toolDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [toolDropdownOpen]);


  // Function to check if a thread has errors
  const threadHasErrors = useCallback((thread: any) => {
    return thread.messages.some((message: any) => {
      if (message.role === 'system' || message.role === 'status') {
        return message.content.some((content: any) => {
          if (content.text || content.content) {
            const text = content.text || content.content || '';
            // Check for any error patterns
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
      return false;
    });
  }, []);

  // Function to check if a thread has timeouts (30+ second gaps between consecutive messages)
  // Excludes user-initiated gaps (session restarts) where the gap is followed by a user message
  const threadHasTimeouts = useCallback((thread: any) => {
    if (!thread.messages || thread.messages.length < 2) return false;
    
    // Sort messages by timestamp
    const sortedMessages = [...thread.messages].sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || a.sentAt).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.sentAt).getTime();
      return timeA - timeB;
    });
    
    // Check for gaps of 30+ seconds between consecutive messages
    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMessage = sortedMessages[i - 1];
      const currentMessage = sortedMessages[i];
      
      const prevTime = new Date(prevMessage.created_at || prevMessage.createdAt || prevMessage.sentAt).getTime();
      const currentTime = new Date(currentMessage.created_at || currentMessage.createdAt || currentMessage.sentAt).getTime();
      
      // Check if there's a gap of 30 seconds or more (30,000 milliseconds)
      if (currentTime - prevTime >= 30000) {
        // Exception: If the gap is followed by a user message, treat it as a session restart, not a timeout
        if (currentMessage.role === 'user') {
          continue; // Skip this gap - it's a session restart
        }
        return true; // This is an actual timeout
      }
    }
    
    return false;
  }, []);

  // Calculate total threads with errors
  const totalThreadsWithErrors = useMemo(() => {
    return threads.filter(thread => threadHasErrors(thread)).length;
  }, [threads, threadHasErrors]);

  // Calculate total threads with timeouts
  const totalThreadsWithTimeouts = useMemo(() => {
    return threads.filter(thread => threadHasTimeouts(thread)).length;
  }, [threads, threadHasTimeouts]);
  
  // Message search functionality
  const [messageSearchEnabled, setMessageSearchEnabled] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  // Removed conversation fetching states since threads now contain all messages
  
  // Extract all available tools from system messages with counts (counting unique threads, not total occurrences)
  const availableToolsWithCounts = useMemo(() => {
    const toolThreadCounts = new Map<string, Set<string>>(); // Map tool name to set of thread IDs
    
    console.log('🔧 Extracting tools from threads:', {
      threadsCount: threads.length,
      sampleThread: threads[0] ? {
        id: threads[0].id,
        messagesCount: threads[0].messages?.length,
        hasSystemMessages: threads[0].messages?.some(m => m.role === 'system'),
        sampleMessageRoles: threads[0].messages?.slice(0, 5).map(m => m.role),
        sampleMessageIds: threads[0].messages?.slice(0, 3).map(m => m.id),
        isDummyMessages: threads[0].messages?.every(m => 
          m.id === 'placeholder' || 
          m.id.startsWith('ui-') || 
          m.id.startsWith('linkout-') || 
          m.id.startsWith('error-msg')
        )
      } : null
    });
    
    // Extracting tools from threads - count unique threads per tool
    threads.forEach(thread => {
      const threadTools = new Set<string>(); // Tools found in this specific thread
      
      thread.messages.forEach(message => {
        // Look for tools in system/status messages
        if (message.role === 'system' || message.role === 'status') {
          message.content.forEach(content => {
            if (content.text || content.content) {
              const text = content.text || content.content || '';
              
              // Look specifically for "**Tool Name:**" pattern in system messages
              const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
              const matches = text.matchAll(toolNamePattern);
              
              for (const match of matches) {
                const toolName = match[1];
                if (toolName && toolName.length > 1) {
                  threadTools.add(toolName);
                }
              }
            }
          });
        }
        
        // Also look for tools in assistant messages (tool usage)
        if (message.role === 'assistant') {
          message.content.forEach(content => {
            // Look for tool usage patterns in assistant messages
            if (content.tool_use) {
              const toolName = content.tool_use.name;
              if (toolName && toolName.length > 1) {
                threadTools.add(toolName);
              }
            }
            
            // Also check text content for tool mentions
            if (content.text || content.content) {
              const text = content.text || content.content || '';
              
              // Look for tool usage patterns like "I'll use the X tool"
              const toolUsagePatterns = [
                /I'll use the (\w+) tool/gi,
                /Using the (\w+) tool/gi,
                /I'll call the (\w+) function/gi,
                /Calling the (\w+) function/gi
              ];
              
              toolUsagePatterns.forEach(pattern => {
                const matches = text.matchAll(pattern);
                for (const match of matches) {
                  const toolName = match[1];
                  if (toolName && toolName.length > 1) {
                    threadTools.add(toolName);
                  }
                }
              });
            }
          });
        }
      });
      
      // Add this thread ID to each tool it contains
      threadTools.forEach(toolName => {
        if (!toolThreadCounts.has(toolName)) {
          toolThreadCounts.set(toolName, new Set());
        }
        toolThreadCounts.get(toolName)!.add(thread.id);
      });
    });

    
    // Convert to array and sort by name (count = number of unique threads)
    const toolsWithCounts = Array.from(toolThreadCounts.entries())
      .map(([name, threadSet]) => ({ name, count: threadSet.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('🔧 Available tools extracted:', {
      toolsCount: toolsWithCounts.length,
      tools: toolsWithCounts.map(t => `${t.name} (${t.count})`),
      threadsCount: threads.length,
      toolThreadCountsMap: Object.fromEntries(
        Array.from(toolThreadCounts.entries()).map(([name, threadSet]) => [name, Array.from(threadSet)])
      )
    });
    
    // Available tools extracted
    return toolsWithCounts;
  }, [threads]);

  // For backwards compatibility, extract just the tool names
  const availableTools = useMemo(() => {
    return availableToolsWithCounts.map(tool => tool.name);
  }, [availableToolsWithCounts]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Quick time range filter functions
  const setTimeRange = (hours: number) => {
    // Use current system time without rounding for precise time selection
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
    
    console.log(`⏰ Set time range: ${hours}h (${formatDateTimeLocal(startTime)} - ${formatDateTimeLocal(now)})`);
    // Don't reset hasSearched here - let it persist until user performs new search
  };

  const setDefaultTimeRange = () => {
    // Only set defaults if current values are empty
    if (!startDate || !endDate) {
      console.log('📋 Setting default time range (1 hour)');
      setTimeRange(1);
    } else {
      console.log('📋 Skipping default time range - values already set');
    }
  };

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
    
    // Check if end time is close to now (within 2 minutes) using local time
    const now = new Date();
    const isEndTimeNow = Math.abs(end.getTime() - now.getTime()) < 2 * 60 * 1000;
    
    if (isEndTimeNow) {
      return quickFilters.find(filter => filter.hours === diffHours)?.hours || null;
    }
    
    return null;
  };

  const activeQuickFilter = getCurrentQuickFilter();

  // Remove this useEffect - defaults are already set in useState initializers

  // Update threads when uploaded data changes
  useEffect(() => {
    console.log('🔄 Uploaded threads changed:', {
      uploadedThreadsCount: uploadedThreads?.length || 0,
      hasUploadedThreads: !!uploadedThreads?.length
    });
    
    // Only act if we have actual uploaded threads (not empty array)
    if (uploadedThreads && uploadedThreads.length > 0) {
      console.log('📤 Setting uploaded threads as active threads');
      setThreads(uploadedThreads);
      setError(null);
      setHasSearched(true); // Mark as searched since we have data
    }
  }, [uploadedThreads?.length]); // Only depend on length, not the array reference

  // Set hasSearched state when threads are loaded (including from cache) - but avoid loops
  useEffect(() => {
    if (threads.length > 0 && !uploadedThreads?.length && !hasSearched) {
      setHasSearched(true);
      console.log('📋 Threads loaded, marking as searched:', threads.length, 'threads');
    }
  }, [threads.length, uploadedThreads?.length, hasSearched]); // Use length instead of full arrays

  // Remove cache loading - no more caching

  // Notify parent component when threads change (for navigation with system messages) - but avoid loops
  const threadsRef = useRef<Thread[]>([]);
  useEffect(() => {
    // Only notify if threads actually changed (not just re-rendered)
    if (threads.length !== threadsRef.current.length || threads !== threadsRef.current) {
      threadsRef.current = threads;
      if (onThreadsChange) {
        console.log('🔄 Notifying parent of threads change:', threads.length, 'threads');
        onThreadsChange(threads);
      }
    }
  }, [threads, onThreadsChange]);

  // Save search state to localStorage when it changes
  useEffect(() => {
    try {
      if (startDate) {
        console.log('💾 Saving start date:', startDate);
        setEnvironmentSpecificItem('threads-search-start-date', startDate);
      }
    } catch (error) {
      console.warn('Failed to save start date:', error);
    }
  }, [startDate]);

  useEffect(() => {
    try {
      setEnvironmentSpecificItem('threads-search-end-date', endDate);
    } catch (error) {
      console.warn('Failed to save end date:', error);
    }
  }, [endDate]);

  useEffect(() => {
    try {
      setEnvironmentSpecificItem('threads-search-term', searchTerm);
    } catch (error) {
      console.warn('Failed to save search term:', error);
    }
  }, [searchTerm]);

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

    // Always show button click feedback
    setButtonClicked(true);
    setTimeout(() => setButtonClicked(false), 200);

    setLoading(true);
    setError(null);
    setThreads([]); // Clear existing threads
    setHasSearched(false); // Reset search state at start of new search

    try {
      // Format timestamps for the API
      const startTimestamp = new Date(startDate).toISOString();
      const endTimestamp = new Date(endDate).toISOString();

      // Proceed with full API fetch - no more cache checking
      console.log('🌐 Fetching from API...');
      
      const apiBaseUrl = getApiBaseUrl();
      
      // Calculate time difference - use 6-hour chunking for optimal balance
      const timeDiff = new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
      const hoursDiff = Math.ceil(timeDiff / (1000 * 60 * 60));
      const chunksDiff = Math.ceil(hoursDiff / 6);
      
      let allThreads: any[] = [];
      
      // Use 6-hour chunking to balance speed and reliability
      console.log(`📊 Processing ${hoursDiff} hours (${chunksDiff} chunks) with 6-hour chunking...`);
      
      const chunks: Array<{start: Date, end: Date, dateStr: string}> = [];
      
      // Create 6-hour chunks
      let currentDate = new Date(startTimestamp);
      const endDateObj = new Date(endTimestamp);
      while (currentDate < endDateObj) {
        let nextDate = new Date(currentDate);
        nextDate.setHours(nextDate.getHours() + 6);
        
        // Don't go past the end date
        if (nextDate > endDateObj) {
          nextDate = new Date(endDateObj);
        }
        
        const startHour = currentDate.getHours();
        const endHour = nextDate.getHours();
        chunks.push({
          start: new Date(currentDate),
          end: new Date(nextDate),
          dateStr: `${currentDate.toLocaleDateString()} ${startHour}:00-${endHour}:00`
        });
        
        currentDate.setHours(currentDate.getHours() + 6);
      }
      
      console.log(`📦 Processing ${chunks.length} 6-hour chunks`);
      setLoadingProgress({ current: 0, total: chunks.length, currentDate: '' });
      
      // Process chunks with progress tracking
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setLoadingProgress({ current: i + 1, total: chunks.length, currentDate: chunk.dateStr });
        
        console.log(`📅 Chunk ${i + 1}/${chunks.length}: ${chunk.dateStr}`);
        
        try {
          const response = await fetch(`${apiBaseUrl}/thread`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify({
              startTimestamp: chunk.start.toISOString(),
              endTimestamp: chunk.end.toISOString(),
            }),
          });

          if (!response.ok) {
            console.warn(`⚠️ Chunk ${i + 1} (${chunk.dateStr}) failed: HTTP ${response.status}`);
            continue; // Skip failed chunks but continue with others
          }

          const chunkData = await response.json();
          const chunkThreads = chunkData.threads?.map((item: any) => item.thread) || [];
          
          allThreads.push(...chunkThreads);
          console.log(`✅ Chunk ${i + 1}/${chunks.length} (${chunk.dateStr}): +${chunkThreads.length} threads (total: ${allThreads.length})`);
          
          // Small delay to be nice to the server
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          console.warn(`⚠️ Chunk ${i + 1} (${chunk.dateStr}) error:`, chunkError);
          // Continue with other chunks
        }
      }
      
      console.log(`🎉 6-hour chunking complete: ${allThreads.length} total threads from ${chunks.length} chunks`);
      setLoadingProgress({ current: 0, total: 0, currentDate: '' });
      
      // No more caching - just set the threads directly
      
      setThreads(allThreads);
      setCurrentPage(1); // Reset pagination when new data is loaded
      setHasSearched(true); // Mark that a search has been completed
      setLastSearchDates({ startDate, endDate }); // Store the actual search dates
      
      // Note: Removed old localStorage backup to prevent quota issues
      // The lightweight cache handles all caching now
      
      if (allThreads.length === 0) {
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

      // Message content search filter - now using thread messages directly
      if (messageSearchEnabled && messageSearchTerm) {
        const searchLower = messageSearchTerm.toLowerCase();
        
        // Search through thread messages directly (threads now contain all messages)
        // EXCLUDE system messages - only search user and assistant messages
        const hasMatchingMessage = thread.messages?.some((message: any) => {
          try {
            // Skip system/status messages - only search user and assistant messages
            if (message.role === 'system' || message.role === 'status') {
              return false;
            }
            
            // Search in message content
            if (message.content && Array.isArray(message.content)) {
              const matchFound = message.content.some((content: any) => {
                try {
                  if (content.text && typeof content.text === 'string' && content.text.toLowerCase().includes(searchLower)) {
                    return true;
                  }
                  if (content.content && typeof content.content === 'string' && content.content.toLowerCase().includes(searchLower)) {
                    return true;
                  }
                } catch (e) {
                  console.warn('Error processing content item:', e);
                }
                return false;
              });
              return matchFound;
            }
          } catch (e) {
            console.warn('Error processing message:', e);
          }
          return false;
        }) || false;
        
        if (!hasMatchingMessage) return false;
      }

      // UI filter
      if (hasUiFilter) {
        const hasUi = thread.messages.some(m => 
          m.content.some(c => c.kind === 'ui')
        );
        if (!hasUi) return false;
      }

      // Tool filter - using same logic as tool counting for consistency
      if (selectedTools.size > 0) {
        const threadTools = new Set<string>();
        
        // Extract tools from this thread using the same patterns as availableToolsWithCounts
        thread.messages.forEach(message => {
          // Check system/status messages
          if ((message.role === 'system' || message.role === 'status') && message.content) {
            message.content.forEach((content: any) => {
              if (content.text || content.content) {
                const text = content.text || content.content || '';
                
                const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
                const matches = text.matchAll(toolNamePattern);
                
                for (const match of matches) {
                  const toolName = match[1];
                  if (toolName && toolName.length > 1) {
                    threadTools.add(toolName);
                  }
                }
              }
            });
          }
          
          // Check assistant messages for tool usage (same as counting logic)
          if (message.role === 'assistant' && message.content) {
            message.content.forEach((content: any) => {
              if (content.tool_use) {
                const toolName = content.tool_use.name;
                if (toolName && toolName.length > 1) {
                  threadTools.add(toolName);
                }
              }
              
              if (content.text || content.content) {
                const text = content.text || content.content || '';
                
                const toolUsagePatterns = [
                  /I'll use the (\w+) tool/gi,
                  /Using the (\w+) tool/gi,
                  /I'll call the (\w+) function/gi,
                  /Calling the (\w+) function/gi
                ];
                
                toolUsagePatterns.forEach(pattern => {
                  const matches = text.matchAll(pattern);
                  for (const match of matches) {
                    const toolName = match[1];
                    if (toolName && toolName.length > 1) {
                      threadTools.add(toolName);
                    }
                  }
                });
              }
            });
          }
        });
        
        // Check if thread has any of the selected tools
        const hasSelectedTool = Array.from(selectedTools).some(tool => threadTools.has(tool));
        if (!hasSelectedTool) return false;
      }

      // Simple error filter - show only threads with errors if checkbox is checked
      if (showErrorsOnly) {
        if (!threadHasErrors(thread)) return false;
      }

      // Timeout filter - show only threads with timeouts if checkbox is checked
      if (showTimeoutsOnly) {
        if (!threadHasTimeouts(thread)) return false;
      }

      // Advanced filters - calculate metrics for this thread
      const messageCount = thread.messages.filter(
        msg => msg.role === 'user' || msg.role === 'assistant'
      ).length;

      // Calculate conversation duration (first to last message)
      const allTimestamps = thread.messages
        .map((m: any) => new Date(m.created_at || m.createdAt || m.sentAt))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      
      const conversationDuration = allTimestamps.length > 1 
        ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
        : 0;
      const durationSeconds = Math.round(conversationDuration / 1000);

      // Calculate time to first assistant response
      const userMessages = thread.messages.filter((m: any) => m.role === 'user');
      const assistantMessages = thread.messages.filter((m: any) => m.role === 'assistant');
      
      let timeToFirstResponse = 0;
      if (userMessages.length > 0 && assistantMessages.length > 0) {
        const firstUserMessage = userMessages
          .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
          .filter(m => !isNaN(m.timestamp.getTime()))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
        
        const firstAssistantMessage = assistantMessages
          .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
          .filter(m => !isNaN(m.timestamp.getTime()))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
        
        if (firstUserMessage && firstAssistantMessage && firstAssistantMessage.timestamp > firstUserMessage.timestamp) {
          timeToFirstResponse = firstAssistantMessage.timestamp.getTime() - firstUserMessage.timestamp.getTime();
        }
      }
      const responseTimeSeconds = Math.round(timeToFirstResponse / 1000);

      // Message count filters
      if (minMessages !== '' && messageCount < minMessages) return false;
      if (maxMessages !== '' && messageCount > maxMessages) return false;

      // Duration filters (in seconds)
      if (minDuration !== '' && durationSeconds < minDuration) return false;
      if (maxDuration !== '' && durationSeconds > maxDuration) return false;

      // Response time filters (in seconds)
      if (minResponseTime !== '' && responseTimeSeconds < minResponseTime) return false;
      if (maxResponseTime !== '' && responseTimeSeconds > maxResponseTime) return false;

      return true;
    }).sort((a, b) => {
      // Sort by createdAt timestamp with most recent first (descending order)
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [threads, searchTerm, hasUiFilter, selectedTools, showErrorsOnly, showTimeoutsOnly, messageSearchEnabled, messageSearchTerm, threadHasErrors, threadHasTimeouts, minMessages, maxMessages, minDuration, maxDuration, minResponseTime, maxResponseTime]);

  // Update thread order whenever filtered threads change to keep navigation in sync
  useEffect(() => {
    if (filteredThreads.length > 0 && onThreadOrderChange) {
      // Use unique conversation IDs for navigation (some conversations may have multiple threads)
      const uniqueConversationIds = Array.from(new Set(filteredThreads.map(thread => thread.conversationId)));
      onThreadOrderChange(uniqueConversationIds);
    }
  }, [filteredThreads, onThreadOrderChange]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / itemsPerPage);
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredThreads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredThreads, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, hasUiFilter, selectedTools, showErrorsOnly, showTimeoutsOnly, minMessages, maxMessages, minDuration, maxDuration, minResponseTime, maxResponseTime]);

  const analytics = useMemo(() => calculateThreadAnalytics(filteredThreads), [filteredThreads]);

  // Calculate conversation analytics
  const conversationAnalytics = useMemo(() => {
    if (!uploadedConversations.length) {
      return null;
    }

    let totalMessages = 0;
    let totalUiEvents = 0;
    let totalLinkouts = 0;
    let totalConversations = uploadedConversations.length;
    let totalExcludedMessages = 0;
    
    uploadedConversations.forEach((conversation, convIndex) => {
      const allNonSystemMessages = conversation.messages?.filter((message: any) => message.role !== 'system') || [];
      
      // Count only non-system messages that don't contain UI components
      const nonSystemMessages = conversation.messages?.filter((message: any) => {
        if (message.role === 'system') return false;
        
        // Exclude messages that contain UI components
        const hasUiComponent = message.content?.some((content: any) => content.kind === 'ui');
        
        if (hasUiComponent) {
          totalExcludedMessages++;
        }
        
        return !hasUiComponent;
      }) || [];
      
      totalMessages += nonSystemMessages.length;
      
      conversation.messages?.forEach((message: any) => {
        message.content?.forEach((content: any) => {
          if (content.kind === 'ui') totalUiEvents++;
          if (content.kind === 'linkout') totalLinkouts++;
        });
      });
    });

    const avgMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

    // Conversation analytics calculated
    
    return {
      totalConversations,
      totalMessages,
      totalUiEvents,
      totalLinkouts,
      avgMessagesPerConversation,
      totalExcludedMessages
    };
  }, [uploadedConversations]);


  const handleBulkAttributes = async () => {
    if (selectedThreads.size === 0) return;

    // Processing bulk attributes
    setBulkLoading(true);
    setError(null);

    try {
      const request: BulkAttributesRequest = {
        threads: Array.from(selectedThreads as Set<string>).map(threadId => ({ threadId })),
      };

      // Making API call to getBulkAttributes
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
      // Marked conversation as viewed
    } catch (error) {
      console.error('Failed to save viewed conversations:', error);
    }
    
    // Notify parent component
    onConversationViewed?.(conversationId);
  };

  // Handle conversation viewing
  const handleConversationView = (conversationId: string, position?: number) => {
    // Handle conversation view
    
    // Mark conversation as viewed
    markConversationAsViewed(conversationId);
    
    // Find the thread associated with this conversation
    const associatedThread = filteredThreads.find(thread => thread.conversationId === conversationId);
    if (associatedThread && onThreadSelect) {
      // Since the threads endpoint now contains all messages, use the thread data directly
      console.log('✅ Using thread data directly:', {
          id: associatedThread.id,
          conversationId: associatedThread.conversationId,
          messagesCount: associatedThread.messages?.length,
        hasSystemMessages: associatedThread.messages?.some(m => m.role === 'system'),
        systemMessagesCount: associatedThread.messages?.filter(m => m.role === 'system').length
      });
      
      // Calling onThreadSelect with thread data
            onThreadSelect(associatedThread);
    }
    
    // Notify parent about the thread order for navigation FIRST
    // Use unique conversation IDs for navigation (some conversations may have multiple threads)
    const uniqueConversationIds = Array.from(new Set(filteredThreads.map(thread => thread.conversationId)));
    onThreadOrderChange?.(uniqueConversationIds);
    
    // Since threads now contain all messages, we no longer need to fetch conversation data
    const currentIndex = position !== undefined ? position : filteredThreads.findIndex(thread => thread.conversationId === conversationId);
    
    // Call the original onConversationSelect callback with position
    onConversationSelect?.(conversationId, currentIndex !== -1 ? currentIndex : undefined);
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
                  className={`flex-1 transition-transform duration-100 ${
                    buttonClicked ? 'scale-95' : 'scale-100'
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {loadingProgress.total > 0 ? `Day ${loadingProgress.current}/${loadingProgress.total}` : 'Searching...'}
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
                    // Clear any cached data
                    // setFetchedConversations(new Map());
                    // setConversationsFetched(false);
                    setMessageSearchEnabled(false);
                    setMessageSearchTerm('');
                    // No more cache clearing needed
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
                      onChange={(e) => {
                        setMessageSearchTerm(e.target.value);
                        // Don't disable messageSearchEnabled when text is empty - keep the input open
                      }}
                      className="flex-1"
                    />
                  </div>
                  
                  
                  {messageSearchEnabled && messageSearchTerm && (
                    <div className="text-sm text-muted-foreground">
                      Searching through {filteredThreads.length} thread messages for "{messageSearchTerm}"
                    </div>
                  )}
                  
                  {messageSearchEnabled && messageSearchTerm && filteredThreads.length > 0 && (
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
              {uploadedConversations.map((conversation, index) => (
                <div 
                  key={conversation.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleConversationView(conversation.id, index)}
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

      {/* Loading Progress Indicator */}
      {loading && loadingProgress.total > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Processing 6-Hour Chunks</h3>
                <span className="text-sm text-muted-foreground">
                  {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
                </span>
              </div>
              
              {loadingProgress.currentDate && (
                <p className="text-sm text-muted-foreground">
                  📅 Current: {loadingProgress.currentDate} (Chunk {loadingProgress.current} of {loadingProgress.total})
                </p>
              )}
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Processing data in 6-hour chunks for optimal speed and reliability...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intent Analysis - Show when we have threads */}
      {threads.length > 0 && hasSearched && (
        <div className="mb-6">
          <IntentAnalysis threads={filteredThreads} />
        </div>
      )}

      {/* Threads Table (only show when threads are available) */}
      {threads.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <CardTitle>Threads ({filteredThreads.length})</CardTitle>
                {lastSearchDates && !uploadedThreads?.length && hasSearched && (
                  <div className="text-sm text-muted-foreground bg-slate-50 px-3 py-1 rounded-md border">
                    <span className="font-medium">Search period:</span> {new Date(lastSearchDates.startDate).toLocaleString('en-GB')} - {new Date(lastSearchDates.endDate).toLocaleString('en-GB')}
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
                  
                  {/* Advanced Filters Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-dashed"
                    onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                  >
                    <Filter className="mr-2 h-3 w-3" />
                    Advanced Filters
                    {(minMessages !== '' || maxMessages !== '' || minDuration !== '' || maxDuration !== '' || minResponseTime !== '' || maxResponseTime !== '') && (
                      <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                        Active
                      </Badge>
                    )}
                  </Button>
                  
                  {/* Tool Filter Dropdown */}
                  {availableTools.length > 0 && (
                    <div className="relative" ref={toolDropdownRef}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 border-dashed"
                        onClick={() => setToolDropdownOpen(!toolDropdownOpen)}
                      >
                        <Filter className="mr-2 h-3 w-3" />
                        Tools
                        {selectedTools.size > 0 && (
                          <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                            {selectedTools.size}
                          </Badge>
                        )}
                        <ChevronDown className="ml-2 h-3 w-3" />
                      </Button>
                      
                      {toolDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 backdrop-blur-sm flex flex-col" style={{ backgroundColor: 'white', height: '320px', maxHeight: '320px' }}>
                          <div className="p-2 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs font-medium text-gray-600">Filter by Tools</Label>
                              {selectedTools.size > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-xs"
                                  onClick={() => setSelectedTools(new Set())}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                            <div className="space-y-1 flex-1 overflow-y-auto">
                              {availableToolsWithCounts.length > 0 ? (
                                availableToolsWithCounts.map((toolInfo) => (
                                  <div key={toolInfo.name} className="flex items-center space-x-2 py-1">
                                    <Checkbox
                                      id={`tool-${toolInfo.name}`}
                                      checked={selectedTools.has(toolInfo.name)}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedTools);
                                        if (checked) {
                                          newSelected.add(toolInfo.name);
                                        } else {
                                          newSelected.delete(toolInfo.name);
                                        }
                                        setSelectedTools(newSelected);
                                      }}
                                      className="h-3 w-3"
                                    />
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                      <Label 
                                        htmlFor={`tool-${toolInfo.name}`} 
                                        className="text-xs font-mono cursor-pointer truncate flex-1 mr-2"
                                        title={toolInfo.name}
                                      >
                                        {toolInfo.name}
                                      </Label>
                                      <Badge variant="secondary" className="text-xs px-1 py-0 h-4 min-w-0 shrink-0">
                                        {toolInfo.count}
                                      </Badge>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground text-center py-3">
                                  <div>No tools found in system messages</div>
                                  <div className="text-xs mt-1 opacity-75">
                                    Tools will appear here after searching threads
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Filter Dropdown */}
                  {totalThreadsWithErrors > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-errors-only"
                        checked={showErrorsOnly}
                        onCheckedChange={(checked) => setShowErrorsOnly(!!checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="show-errors-only" className="text-sm font-medium cursor-pointer flex items-center">
                        <AlertCircle className="mr-1 h-4 w-4 text-red-500" />
                        Show errors only
                        <Badge variant="destructive" className="ml-2 px-2 py-0 text-xs">
                          {totalThreadsWithErrors}
                        </Badge>
                      </Label>
                    </div>
                  )}
                  
                  {/* Timeout Filter */}
                  {totalThreadsWithTimeouts > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-timeouts-only"
                        checked={showTimeoutsOnly}
                        onCheckedChange={(checked) => setShowTimeoutsOnly(!!checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="show-timeouts-only" className="text-sm font-medium cursor-pointer flex items-center">
                        <Clock className="mr-1 h-4 w-4 text-orange-500" />
                        Show timeouts only
                        <Badge variant="secondary" className="ml-2 px-2 py-0 text-xs bg-orange-100 text-orange-800">
                          {totalThreadsWithTimeouts}
                        </Badge>
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          
          {/* Advanced Filters Panel */}
          {advancedFiltersOpen && (
            <div className="px-6 pb-4 border-b bg-gray-50">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Advanced Filters</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Message Count Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Message Count</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={minMessages}
                        onChange={(e) => setMinMessages(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxMessages}
                        onChange={(e) => setMaxMessages(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  {/* Duration Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Duration (seconds)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={minDuration}
                        onChange={(e) => setMinDuration(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxDuration}
                        onChange={(e) => setMaxDuration(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  {/* Response Time Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Response Time (seconds)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={minResponseTime}
                        onChange={(e) => setMinResponseTime(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxResponseTime}
                        onChange={(e) => setMaxResponseTime(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 text-xs"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Clear Advanced Filters */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinMessages('');
                      setMaxMessages('');
                      setMinDuration('');
                      setMaxDuration('');
                      setMinResponseTime('');
                      setMaxResponseTime('');
                    }}
                    className="h-8 text-xs"
                  >
                    Clear Advanced Filters
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table className="w-full table-fixed">
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
                  <TableHead style={{ width: '200px' }}>First User Message</TableHead>
                  <TableHead style={{ width: '120px' }}>Thread ID</TableHead>
                  <TableHead style={{ width: '150px' }}>Conversation ID</TableHead>
                  <TableHead style={{ width: '120px' }}>Created</TableHead>
                  <TableHead style={{ width: '80px' }}>UI Events</TableHead>
                  <TableHead style={{ width: '80px' }}>Messages</TableHead>
                  <TableHead style={{ width: '80px' }}>Duration</TableHead>
                  <TableHead style={{ width: '100px' }}>Response Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedThreads.map((thread, paginatedIndex) => {
                  // Calculate the actual index in filteredThreads
                  const actualIndex = (currentPage - 1) * itemsPerPage + paginatedIndex;
                  const parsed = parseThreadId(thread.id);
                  const uiCount = thread.messages.reduce(
                    (acc, msg) => acc + msg.content.filter(c => c.kind === 'ui').length, 
                    0
                  );
                  const messageCount = thread.messages.filter(
                    msg => msg.role === 'user' || msg.role === 'assistant'
                  ).length;

                  // Calculate conversation duration (first to last message)
                  const allTimestamps = thread.messages
                    .map((m: any) => new Date(m.created_at || m.createdAt || m.sentAt))
                    .filter(date => !isNaN(date.getTime()))
                    .sort((a, b) => a.getTime() - b.getTime());
                  
                  const conversationDuration = allTimestamps.length > 1 
                    ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
                    : 0;
                  const durationMinutes = Math.round(conversationDuration / (1000 * 60));
                  const durationSeconds = Math.round(conversationDuration / 1000);

                  // Calculate time to first assistant response
                  const userMessages = thread.messages.filter((m: any) => m.role === 'user');
                  const assistantMessages = thread.messages.filter((m: any) => m.role === 'assistant');
                  
                  let timeToFirstResponse = 0;
                  if (userMessages.length > 0 && assistantMessages.length > 0) {
                    const firstUserMessage = userMessages
                      .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
                      .filter(m => !isNaN(m.timestamp.getTime()))
                      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
                    
                    const firstAssistantMessage = assistantMessages
                      .map(m => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
                      .filter(m => !isNaN(m.timestamp.getTime()))
                      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
                    
                    if (firstUserMessage && firstAssistantMessage && firstAssistantMessage.timestamp > firstUserMessage.timestamp) {
                      timeToFirstResponse = firstAssistantMessage.timestamp.getTime() - firstUserMessage.timestamp.getTime();
                    }
                  }
                  const responseTimeSeconds = Math.round(timeToFirstResponse / 1000);

                  // Extract first user message content
                  const firstUserMessage = thread.messages
                    .filter((m: any) => m.role === 'user')
                    .sort((a: any, b: any) => {
                      const timeA = new Date(a.created_at || a.createdAt || a.sentAt).getTime();
                      const timeB = new Date(b.created_at || b.createdAt || b.sentAt).getTime();
                      return timeA - timeB;
                    })[0];

                  const firstUserMessageText = firstUserMessage?.content
                    ?.map((content: any) => content.text || content.content || '')
                    .join(' ')
                    .trim()
                    .substring(0, 100) + (firstUserMessage?.content?.some((c: any) => (c.text || c.content || '').length > 100) ? '...' : '') || '';

                  // Check if this conversation ID exists in uploaded conversations
                  const hasConversationData = uploadedConversations.some(c => c.id === thread.conversationId);

                  const isThreadViewed = viewedThreads.has(thread.id);
                  const isConversationViewed = viewedConversations.has(thread.conversationId);
                  const isAnyViewed = isThreadViewed || isConversationViewed;
                  
                  return (
                    <TableRow 
                      key={thread.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${isAnyViewed ? 'bg-gray-50' : ''} ${threadHasErrors(thread) ? 'bg-red-50 border-l-4 border-l-red-500' : ''} min-h-16`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()} className="py-4">
                        <Checkbox
                          checked={selectedThreads.has(thread.id)}
                          onCheckedChange={() => toggleThreadSelection(thread.id)}
                        />
                      </TableCell>
                      <TableCell 
                        onClick={() => handleConversationView(thread.conversationId, actualIndex)}
                        className="cursor-pointer py-2"
                        title={firstUserMessageText || 'No user message found'}
                        style={{ width: '200px', maxWidth: '200px', minWidth: '200px' }}
                      >
                        <div 
                          className={`text-xs leading-tight ${!isAnyViewed ? 'font-bold text-foreground' : 'text-gray-600'}`}
                          style={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            lineHeight: '1.3',
                            maxHeight: '2.6em',
                            height: '2.6em'
                          }}
                        >
                          {firstUserMessageText || '-'}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-foreground">{parsed.id}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isAnyViewed && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                Viewed
                              </Badge>
                            )}
                            {savedConversationIds.has(thread.conversationId) && (
                              <div className="flex items-center" title="Saved chat">
                                <Bookmark className="h-3 w-3 text-blue-600 fill-blue-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell 
                        onClick={() => handleConversationView(thread.conversationId, actualIndex)}
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
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        {formatTimestamp(thread.createdAt)}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        {uiCount > 0 ? (
                          <Badge variant="outline">{uiCount}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        {messageCount > 0 ? (
                          <Badge variant="outline">{messageCount}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        {conversationDuration > 0 ? (
                          <Badge variant="outline">
                            {durationMinutes > 0 ? `${durationMinutes}m` : `${durationSeconds}s`}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleConversationView(thread.conversationId, actualIndex)} className="py-4">
                        {responseTimeSeconds > 0 ? (
                          <Badge variant="outline">{responseTimeSeconds}s</Badge>
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

    </div>
  );
}