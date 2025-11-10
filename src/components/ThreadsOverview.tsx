import {
  AlertCircle,
  Bookmark,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ApiError,
  api,
  getApiBaseUrl,
  getEnvironmentSpecificItem,
  setEnvironmentSpecificItem,
} from '../lib/api';
import { categorizeThread as categorizationUtilCategorizeThread } from '../lib/categorization';
import type { BulkAttributesRequest, Thread } from '../lib/types';
import { calculateThreadAnalytics, debounce, formatTimestamp, parseThreadId } from '../lib/utils';
import { IntentAnalysis } from './IntentAnalysis';
import { ChunkStatusModal } from './statistics';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
} from './ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

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

// Memoized ThreadRow component for better performance
const ThreadRow = React.memo(
  ({
    thread,
    // actualIndex is used in the component rendering
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    actualIndex,
    isSelected,
    isThreadViewed,
    isConversationViewed,
    hasConversationData,
    isSaved,
    hasError,
    onToggleSelection,
    onConversationView,
  }: {
    thread: Thread;
    actualIndex: number;
    isSelected: boolean;
    isThreadViewed: boolean;
    isConversationViewed: boolean;
    hasConversationData: boolean;
    isSaved: boolean;
    hasError: boolean;
    onToggleSelection: () => void;
    onConversationView: () => void;
  }) => {
    // Memoize expensive calculations
    const threadData = useMemo(() => {
      const parsed = parseThreadId(thread.id);
      const uiCount = thread.messages.reduce(
        (acc, msg) => acc + msg.content.filter((c) => c.kind === 'ui').length,
        0
      );
      const messageCount = thread.messages.filter(
        (msg) => msg.role === 'user' || msg.role === 'assistant'
      ).length;

      // Calculate conversation duration
      const allTimestamps = thread.messages
        .map((m: any) => {
          const msg = m as any;
          return new Date(msg.created_at || msg.createdAt || msg.sentAt);
        })
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      const conversationDuration =
        allTimestamps.length > 1
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
          .map((m: any) => ({
            ...m,
            timestamp: new Date((m as any).created_at || (m as any).createdAt || (m as any).sentAt),
          }))
          .filter((m: any) => !Number.isNaN(m.timestamp.getTime()))
          .sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime())[0];

        const firstAssistantMessage = assistantMessages
          .map((m: any) => ({
            ...m,
            timestamp: new Date((m as any).created_at || (m as any).createdAt || (m as any).sentAt),
          }))
          .filter((m: any) => !Number.isNaN(m.timestamp.getTime()))
          .sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime())[0];

        if (
          firstUserMessage &&
          firstAssistantMessage &&
          firstAssistantMessage.timestamp > firstUserMessage.timestamp
        ) {
          timeToFirstResponse =
            firstAssistantMessage.timestamp.getTime() - firstUserMessage.timestamp.getTime();
        }
      }
      const responseTimeSeconds = Math.round(timeToFirstResponse / 1000);

      // Extract first user message content
      const firstUserMessage = thread.messages
        .filter((m: any) => m.role === 'user')
        .sort((a: any, b: any) => {
          const msgA = a as any;
          const msgB = b as any;
          const timeA = new Date(msgA.created_at || msgA.createdAt || msgA.sentAt).getTime();
          const timeB = new Date(msgB.created_at || msgB.createdAt || msgB.sentAt).getTime();
          return timeA - timeB;
        })[0];

      const firstUserMessageText =
        firstUserMessage?.content
          ?.map((content: any) => content.text || content.content || '')
          .join(' ')
          .trim()
          .substring(0, 100) +
          (firstUserMessage?.content?.some((c: any) => (c.text || c.content || '').length > 100)
            ? '...'
            : '') || '';

      return {
        parsed,
        uiCount,
        messageCount,
        durationMinutes,
        durationSeconds,
        responseTimeSeconds,
        firstUserMessageText,
        conversationDuration,
      };
    }, [thread]);

    const isAnyViewed = isThreadViewed || isConversationViewed;

    return (
      <TableRow
        key={thread.id}
        className={`thread-row cursor-pointer hover:bg-muted/50 ${isAnyViewed ? 'bg-gray-50' : ''} ${hasError ? 'bg-red-50 border-l-4 border-l-red-500' : ''} min-h-16`}
      >
        <TableCell onClick={(e) => e.stopPropagation()} className="py-4">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelection} />
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="cursor-pointer py-2"
          title={threadData.firstUserMessageText || 'No user message found'}
          style={{ width: '200px', maxWidth: '200px', minWidth: '200px' }}
        >
          <div className="flex items-start gap-2">
            <div
              className={`text-xs leading-tight flex-1 ${!isAnyViewed ? 'font-bold text-foreground' : 'text-gray-600'}`}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                lineHeight: '1.3',
                maxHeight: '2.6em',
                height: '2.6em',
              }}
            >
              {threadData.firstUserMessageText || '-'}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAnyViewed && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                  Viewed
                </Badge>
              )}
              {isSaved && (
                <div className="flex items-center" title="Saved chat">
                  <Bookmark className="h-3 w-3 text-blue-600 fill-blue-600" />
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4"
          style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}
        >
          <div className="text-foreground text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
            {threadData.parsed.id}
          </div>
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="cursor-pointer py-4"
          title={thread.conversationId}
          style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
        >
          <div
            className={`text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap ${hasConversationData ? 'text-blue-600 hover:underline' : 'text-foreground'}`}
          >
            {thread.conversationId}
          </div>
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4"
          style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}
        >
          <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
            {formatTimestamp(thread.createdAt)}
          </div>
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4 text-center"
          style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}
        >
          {threadData.uiCount > 0 ? <Badge variant="outline">{threadData.uiCount}</Badge> : '-'}
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4 text-center"
          style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}
        >
          {threadData.messageCount > 0 ? (
            <Badge variant="outline">{threadData.messageCount}</Badge>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4 text-center"
          style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}
        >
          {threadData.conversationDuration > 0 ? (
            <Badge variant="outline">
              {threadData.durationMinutes > 0
                ? `${threadData.durationMinutes}m`
                : `${threadData.durationSeconds}s`}
            </Badge>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell
          onClick={onConversationView}
          className="py-4 text-center"
          style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}
        >
          {threadData.responseTimeSeconds > 0 ? (
            <Badge variant="outline">{threadData.responseTimeSeconds}s</Badge>
          ) : (
            '-'
          )}
        </TableCell>
      </TableRow>
    );
  }
);
// Note: Removed custom comparison function to ensure immediate updates for viewed status

export function ThreadsOverview({
  uploadedThreads,
  uploadedConversations = [],
  onThreadSelect,
  onConversationSelect,
  onFetchedConversationsChange,
  onThreadOrderChange,
  onConversationViewed,
  onThreadsChange,
  savedConversationIds = new Set(),
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
  const [lastSearchDates, setLastSearchDates] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [chunkStatuses, setChunkStatuses] = useState<Array<{ chunk: number; status: string; date: string }>>([]);
  const [finalChunkStatuses, setFinalChunkStatuses] = useState<Array<{ chunk: number; status: string; date: string }>>([]);
  const [showChunkStatus, setShowChunkStatus] = useState(false);

  // Viewed threads tracking
  const [viewedThreads, setViewedThreads] = useState<Set<string>>(new Set());

  // Viewed conversations tracking
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(new Set());

  // Flag to prevent saving during initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load viewed data on mount
  useEffect(() => {
    try {
      // Load viewed threads
      const savedThreads = getEnvironmentSpecificItem('chatbot-dashboard-viewed-threads');
      if (savedThreads) {
        setViewedThreads(new Set(JSON.parse(savedThreads)));
      }

      // Load viewed conversations
      const savedConversations = getEnvironmentSpecificItem(
        'chatbot-dashboard-viewed-conversations'
      );
      if (savedConversations) {
        setViewedConversations(new Set(JSON.parse(savedConversations)));
      }

      // Load search filters
      const savedStartDate = getEnvironmentSpecificItem('threads-search-start-date');
      if (savedStartDate && typeof savedStartDate === 'string') {
        setStartDate(savedStartDate);
      }

      const savedEndDate = getEnvironmentSpecificItem('threads-search-end-date');
      if (savedEndDate && typeof savedEndDate === 'string') {
        setEndDate(savedEndDate);
      }

      const savedSearchTerm = getEnvironmentSpecificItem('threads-search-term');
      // Clear invalid search terms (like "[object Promise]")
      if (savedSearchTerm && typeof savedSearchTerm === 'string' && !savedSearchTerm.includes('[object')) {
        setSearchTerm(savedSearchTerm);
      } else if (savedSearchTerm && savedSearchTerm.includes('[object')) {
        // Clear the corrupted value
        setEnvironmentSpecificItem('threads-search-term', '');
        setSearchTerm('');
      }
    } catch (_error) {
      // Failed to load viewed data
    } finally {
      // Mark initial load as complete
      setIsInitialLoad(false);
    }
  }, []);

  // Effect to update viewed conversations immediately when onConversationViewed is called
  useEffect(() => {
    const handleConversationViewed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { conversationId } = customEvent.detail;

      // Update local state immediately without waiting for storage
      setViewedConversations((prev) => {
        const newSet = new Set(prev);
        newSet.add(conversationId);
        return newSet;
      });
    };

    // Listen for custom conversationViewed events
    window.addEventListener('conversationViewed', handleConversationViewed);

    return () => {
      window.removeEventListener('conversationViewed', handleConversationViewed);
    };
  }, []);

  // Removed spamming debug log

  // Filters with localStorage persistence
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to 1 hour ago
    const date = new Date();
    date.setHours(date.getHours() - 1);
    const defaultValue = date.toISOString().slice(0, 16);
    return defaultValue; // Format for datetime-local input
  });
  const [endDate, setEndDate] = useState<string>(() => {
    // Default to current system time
    return new Date().toISOString().slice(0, 16); // Format for datetime-local input
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [hasUiFilter, setHasUiFilter] = useState(false);
  const [_hasLinkoutFilter, _setHasLinkoutFilter] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const toolDropdownRef = useRef<HTMLDivElement>(null);
  const toolButtonRef = useRef<HTMLButtonElement>(null);
  const [toolDropdownPosition, setToolDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);
  const workflowDropdownRef = useRef<HTMLDivElement>(null);
  const workflowButtonRef = useRef<HTMLButtonElement>(null);
  const [workflowDropdownPosition, setWorkflowDropdownPosition] = useState({ top: 0, left: 0 });
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showTimeoutsOnly, setShowTimeoutsOnly] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Advanced filters
  const [minMessages, setMinMessages] = useState<number | ''>('');
  const [maxMessages, setMaxMessages] = useState<number | ''>('');
  const [minDuration, setMinDuration] = useState<number | ''>('');
  const [maxDuration, setMaxDuration] = useState<number | ''>('');
  const [minResponseTime, setMinResponseTime] = useState<number | ''>('');
  const [maxResponseTime, setMaxResponseTime] = useState<number | ''>('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Close dropdown when clicking outside and update position on scroll
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      // For tool dropdown: close if clicking outside both the dropdown AND the button
      if (
        toolDropdownOpen &&
        toolDropdownRef.current &&
        !toolDropdownRef.current.contains(target) &&
        toolButtonRef.current &&
        !toolButtonRef.current.contains(target)
      ) {
        setToolDropdownOpen(false);
      }

      // For workflow dropdown: close if clicking outside both the dropdown AND the button
      if (
        workflowDropdownOpen &&
        workflowDropdownRef.current &&
        !workflowDropdownRef.current.contains(target) &&
        workflowButtonRef.current &&
        !workflowButtonRef.current.contains(target)
      ) {
        setWorkflowDropdownOpen(false);
      }
    }

    function handleScroll() {
      // Update dropdown positions when scrolling the main page to keep them aligned with their buttons
      if (toolDropdownOpen && toolButtonRef.current) {
        const rect = toolButtonRef.current.getBoundingClientRect();
        setToolDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }

      if (workflowDropdownOpen && workflowButtonRef.current) {
        const rect = workflowButtonRef.current.getBoundingClientRect();
        setWorkflowDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    }

    if (toolDropdownOpen || workflowDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Only listen to scroll on the main document, not all elements
      document.addEventListener('scroll', handleScroll, false);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, false);
    };
  }, [toolDropdownOpen, workflowDropdownOpen]);

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
              /Forbidden/gi,
            ];
            return errorPatterns.some((pattern) => pattern.test(text));
          }
          return false;
        });
      }
      return false;
    });
  }, []);

  // Function to check if a thread has timeouts (30+ second gaps between consecutive messages)
  // Excludes user-initiated gaps (session restarts) where the gap is followed by a user message
  // Helper function to check if a thread matches a specific topic
  const threadMatchesTopic = useCallback((thread: any, topicName: string) => {
    const threadCategory = categorizationUtilCategorizeThread(thread);
    return threadCategory === topicName;
  }, []);

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

      const prevTime = new Date(
        prevMessage.created_at || prevMessage.createdAt || prevMessage.sentAt
      ).getTime();
      const currentTime = new Date(
        currentMessage.created_at || currentMessage.createdAt || currentMessage.sentAt
      ).getTime();

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
    return threads.filter((thread) => threadHasErrors(thread)).length;
  }, [threads, threadHasErrors]);

  // Calculate total threads with timeouts
  const totalThreadsWithTimeouts = useMemo(() => {
    return threads.filter((thread) => threadHasTimeouts(thread)).length;
  }, [threads, threadHasTimeouts]);

  // Message search functionality
  const [messageSearchEnabled, setMessageSearchEnabled] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  // Removed conversation fetching states since threads now contain all messages

  // Extract all available tools from system messages with counts (counting unique threads, not total occurrences)
  const availableToolsWithCounts = useMemo(() => {
    const toolThreadCounts = new Map<string, Set<string>>(); // Map tool name to set of thread IDs

    // Extracting tools from threads - count unique threads per tool
    threads.forEach((thread) => {
      const threadTools = new Set<string>(); // Tools found in this specific thread

      thread.messages.forEach((message) => {
        // Look for tools in system/status messages
        if (message.role === 'system' || message.role === 'status') {
          message.content.forEach((content) => {
            if (content.text || content.content) {
              const text = (content.text || content.content || '').toString();

              // Look specifically for "**Tool Name:**" pattern in system messages
              const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
              for (const match of text.matchAll(toolNamePattern)) {
                const toolName = match[1];
                if (toolName && toolName.length > 1) {
                  threadTools.add(toolName);
                }
              }

              // Also support messages like: "Tool Call Initiated (`tool-name`)" or without backticks
              const initiatedPatterns = [
                /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi, // backticked name
                /Tool\s*Call\s*Initiated[^A-Za-z0-9_-]*\(([^)]+)\)/gi, // inside parentheses
                /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi, // plain name
                /Calling\s+tool[:\s]*`([^`]+)`/gi,
                /Using\s+tool[:\s]*`([^`]+)`/gi,
              ];
              initiatedPatterns.forEach((pattern) => {
                for (const m of text.matchAll(pattern)) {
                  const candidate = (m[1] || '').trim();
                  // Clean wrappers like quotes/backticks if any remained
                  const toolName = candidate.replace(/^['"`]+|['"`]+$/g, '');
                  if (toolName && toolName.length > 1) {
                    threadTools.add(toolName);
                  }
                }
              });
            }
          });
        }

        // Look for tools in ALL message types using comprehensive patterns
        message.content.forEach((content) => {
          // 1. Check for tool_use patterns (assistant messages)
          if (content.tool_use) {
            const toolName = content.tool_use.name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 2. Check for tool_call patterns
          if (content.tool_call) {
            const toolName = content.tool_call.name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 3. Check for tool_name when kind is tool_use
          if (content.kind === 'tool_use' && (content as any).tool_name) {
            const toolName = (content as any).tool_name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 4. Check for type === 'tool_use' pattern
          if ((content as any).type === 'tool_use' && (content as any).name) {
            const toolName = (content as any).name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 5. Check for nested tool.name pattern
          if ((content as any).tool?.name) {
            const toolName = (content as any).tool.name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 6. Check for function_call pattern
          if ((content as any).function_call?.name) {
            const toolName = (content as any).function_call.name;
            if (toolName && toolName.length > 1) {
              threadTools.add(toolName);
            }
          }

          // 7. Check assistant text for phrases like "Tool Call Initiated (`name`)"
          if (content.text || (content as any).content) {
            const text = (content.text || (content as any).content || '').toString();
            const initiatedPatterns = [
              /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
              /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
              /Calling\s+tool[:\s]*`([^`]+)`/gi,
              /Using\s+tool[:\s]*`([^`]+)`/gi,
            ];
            initiatedPatterns.forEach((pattern) => {
              for (const m of text.matchAll(pattern)) {
                const candidate = (m[1] || '').trim();
                const toolName = candidate.replace(/^['"`]+|['"`]+$/g, '');
                if (toolName && toolName.length > 1) {
                  threadTools.add(toolName);
                }
              }
            });
          }
        });

        // 7. Check for message-level tool_calls
        if ((message as any).tool_calls) {
          (message as any).tool_calls.forEach((tool: any) => {
            if (tool.function?.name) {
              const toolName = tool.function.name;
              if (toolName && toolName.length > 1) {
                threadTools.add(toolName);
              }
            }
          });
        }
      });

      // Add this thread ID to each tool it contains
      threadTools.forEach((toolName) => {
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

    // Available tools extracted
    return toolsWithCounts;
  }, [threads]);

  // For backwards compatibility, extract just the tool names
  const availableTools = useMemo(() => {
    return availableToolsWithCounts.map((tool) => tool.name);
  }, [availableToolsWithCounts]);

  // Extract all available workflows from system messages with counts (counting unique threads, not total occurrences)
  const availableWorkflowsWithCounts = useMemo(() => {
    const workflowThreadCounts = new Map<string, Set<string>>(); // Map workflow name to set of thread IDs

    // Extracting workflows from threads - count unique threads per workflow
    threads.forEach((thread) => {
      const threadWorkflows = new Set<string>(); // Workflows found in this specific thread

      thread.messages.forEach((message) => {
        // Look for workflows in system/status messages
        if (message.role === 'system' || message.role === 'status') {
          message.content.forEach((content) => {
            if (content.text || content.content) {
              const text = content.text || content.content || '';

              // Look for "Workflows ausgewählt" pattern
              if (text.includes('Workflows ausgewählt')) {
                // Look for "* **Workflows:** `workflow-name1, workflow-name2`" pattern
                const workflowPattern = /\*\s*\*\*Workflows:\*\*\s*`([^`]+)`/gi;
                const matches = text.matchAll(workflowPattern);

                for (const match of matches) {
                  const workflowsString = match[1];
                  if (workflowsString) {
                    // Split by comma and clean up workflow names
                    const workflows = workflowsString
                      .split(',')
                      .map((w) => w.trim())
                      .filter((w) => w.length > 0);
                    workflows.forEach((workflowName) => {
                      if (workflowName.length > 1) {
                        threadWorkflows.add(workflowName);
                      }
                    });
                  }
                }
              }

              // Also look for standalone workflow mentions in system messages
              const standaloneWorkflowPattern = /workflow-[\w-]+/gi;
              const standaloneMatches = text.matchAll(standaloneWorkflowPattern);

              for (const match of standaloneMatches) {
                const workflowName = match[0];
                if (workflowName && workflowName.length > 1) {
                  threadWorkflows.add(workflowName);
                }
              }
            }
          });
        }
      });

      // Add this thread ID to each workflow it contains
      threadWorkflows.forEach((workflowName) => {
        if (!workflowThreadCounts.has(workflowName)) {
          workflowThreadCounts.set(workflowName, new Set());
        }
        workflowThreadCounts.get(workflowName)!.add(thread.id);
      });
    });

    // Convert to array and sort by name (count = number of unique threads)
    const workflowsWithCounts = Array.from(workflowThreadCounts.entries())
      .map(([name, threadSet]) => ({ name, count: threadSet.size }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return workflowsWithCounts;
  }, [threads]);

  // For backwards compatibility, extract just the workflow names
  const availableWorkflows = useMemo(() => {
    return availableWorkflowsWithCounts.map((workflow) => workflow.name);
  }, [availableWorkflowsWithCounts]);

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

    // Don't reset hasSearched here - let it persist until user performs new search
  };

  const _setDefaultTimeRange = () => {
    // Only set defaults if current values are empty
    if (!startDate || !endDate) {
      setTimeRange(1);
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
      return quickFilters.find((filter) => filter.hours === diffHours)?.hours || null;
    }

    return null;
  };

  const activeQuickFilter = getCurrentQuickFilter();

  // Remove this useEffect - defaults are already set in useState initializers

  // Update threads when uploaded data changes
  useEffect(() => {
    // Only act if we have actual uploaded threads (not empty array)
    if (uploadedThreads && uploadedThreads.length > 0) {
      setThreads(uploadedThreads);
      setError(null);
      setHasSearched(true); // Mark as searched since we have data
    }
  }, [uploadedThreads?.length, uploadedThreads]); // Only depend on length, not the array reference

  // Set hasSearched state when threads are loaded (including from cache) - but avoid loops
  useEffect(() => {
    if (threads.length > 0 && !uploadedThreads?.length && !hasSearched) {
      setHasSearched(true);
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
        onThreadsChange(threads);
      }
    }
  }, [threads, onThreadsChange]);

  // Save search state to localStorage when it changes (but not during initial load)
  useEffect(() => {
    if (isInitialLoad) return;

    try {
      if (startDate && typeof startDate === 'string') {
        setEnvironmentSpecificItem('threads-search-start-date', startDate);
      }
    } catch (_error) {
      // Failed to save start date
    }
  }, [startDate, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad) return;

    try {
      if (endDate && typeof endDate === 'string') {
        setEnvironmentSpecificItem('threads-search-end-date', endDate);
      }
    } catch (_error) {
      // Failed to save end date
    }
  }, [endDate, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad) return;

    try {
      if (typeof searchTerm === 'string') {
        setEnvironmentSpecificItem('threads-search-term', searchTerm);
      }
    } catch (_error) {
      // Failed to save search term
    }
  }, [searchTerm, isInitialLoad]);

  const fetchThreads = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    // Get API key from environment-specific localStorage
    const apiKey = await getEnvironmentSpecificItem('chatbot-dashboard-api-key');
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

      const apiBaseUrl = getApiBaseUrl();

      // Calculate time difference for smart chunking
      const timeDiff = new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
      const _hoursDiff = Math.ceil(timeDiff / (1000 * 60 * 60));

      const allThreads: any[] = [];

      // Smart chunking strategy based on typical usage patterns
      // 00:00-11:59 (12h), 12:00-16:59 (5h), 17:00-18:59 (2h), 19:00-20:59 (2h), 21:00-23:59 (3h)
      const chunks: Array<{ start: Date; end: Date; dateStr: string }> = [];

      // Smart chunking function for a single day
      const createDayChunks = (dayStart: Date) => {
        const dayChunks: Array<{ start: Date; end: Date; dateStr: string }> = [];
        const year = dayStart.getFullYear();
        const month = dayStart.getMonth();
        const date = dayStart.getDate();

        // Define smart chunk periods for each day
        const periods = [
          { start: 0, end: 11, label: '00:00-11:59' }, // 12 hours - low activity
          { start: 12, end: 16, label: '12:00-16:59' }, // 5 hours - moderate activity
          { start: 17, end: 18, label: '17:00-18:59' }, // 2 hours - peak activity
          { start: 19, end: 20, label: '19:00-20:59' }, // 2 hours - peak activity
          { start: 21, end: 23, label: '21:00-23:59' }, // 3 hours - moderate activity
        ];

        periods.forEach((period) => {
          const chunkStart = new Date(year, month, date, period.start, 0, 0);
          const chunkEnd = new Date(year, month, date, period.end, 59, 59, 999);

          dayChunks.push({
            start: chunkStart,
            end: chunkEnd,
            dateStr: `${chunkStart.toLocaleDateString()} ${period.label}`,
          });
        });

        return dayChunks;
      };

      // Generate chunks for each day in the range
      const currentDate = new Date(startTimestamp);
      currentDate.setHours(0, 0, 0, 0); // Start at beginning of day

      const endDateObj = new Date(endTimestamp);

      while (currentDate <= endDateObj) {
        const dayChunks = createDayChunks(currentDate);

        // Filter chunks to only include those that overlap with our time range
        dayChunks.forEach((chunk) => {
          const chunkStart = new Date(
            Math.max(chunk.start.getTime(), new Date(startTimestamp).getTime())
          );
          const chunkEnd = new Date(
            Math.min(chunk.end.getTime(), new Date(endTimestamp).getTime())
          );

          // Only add chunk if it has a valid time range
          if (chunkStart < chunkEnd) {
            chunks.push({
              start: chunkStart,
              end: chunkEnd,
              dateStr: `${chunkStart.toLocaleDateString()} ${chunkStart.getHours()}:${chunkStart.getMinutes().toString().padStart(2, '0')}-${chunkEnd.getHours()}:${chunkEnd.getMinutes().toString().padStart(2, '0')}`,
            });
          }
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Parallel processing with concurrency control (like ThreadPoolExecutor)
      // Get concurrency setting from localStorage or use default
      const savedConcurrency = localStorage.getItem('chatbot-dashboard-concurrency');
      const _CONCURRENT_REQUESTS = savedConcurrency ? parseInt(savedConcurrency, 10) : 5; // Number of parallel requests

      setLoadingProgress({ current: 0, total: chunks.length, currentDate: '' });
      setChunkStatuses([]);
      let completedChunks = 0;
      const localChunkStatuses: Array<{ chunk: number; status: string; date: string }> = [];

      // Function to process a single chunk
      const processChunk = async (chunk: any, index: number) => {
        try {
          const response = await fetch(`${apiBaseUrl}/thread`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify({
              startTimestamp: chunk.start.toISOString(),
              endTimestamp: chunk.end.toISOString(),
            }),
          });

          if (!response.ok) {
            // Update progress even for failed chunks
            completedChunks++;
            const statusText = response.status === 504 ? 'Timeout (504)' : `Failed (${response.status})`;
            setLoadingProgress({
              current: completedChunks,
              total: chunks.length,
              currentDate: `${statusText}: ${chunk.dateStr}`,
            });
            const statusObj = { chunk: index + 1, status: `${response.status}`, date: chunk.dateStr };
            localChunkStatuses.push(statusObj);
            setChunkStatuses((prev) => [...prev, statusObj]);
            return { threads: [], index, chunk };
          }

          const chunkData = await response.json();
          const chunkThreads = chunkData.threads?.map((item: any) => item.thread) || [];

          // Update progress immediately when chunk completes
          completedChunks++;
          setLoadingProgress({
            current: completedChunks,
            total: chunks.length,
            currentDate: `✓ Success (200): ${chunk.dateStr}`,
          });
          const statusObj = { chunk: index + 1, status: '200', date: chunk.dateStr };
          localChunkStatuses.push(statusObj);
          setChunkStatuses((prev) => [...prev, statusObj]);

          return { threads: chunkThreads, index, chunk };
        } catch (chunkError) {
          // Update progress even for errored chunks
          completedChunks++;
          const errorMsg = chunkError instanceof Error ? chunkError.message : 'Unknown error';
          setLoadingProgress({
            current: completedChunks,
            total: chunks.length,
            currentDate: `✗ Error: ${errorMsg.substring(0, 30)} - ${chunk.dateStr}`,
          });
          const statusObj = { chunk: index + 1, status: 'Error', date: chunk.dateStr };
          localChunkStatuses.push(statusObj);
          setChunkStatuses((prev) => [...prev, statusObj]);
          return { threads: [], index, chunk };
        }
      };

      // Process chunks sequentially to avoid overwhelming the server
      const results: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const result = await processChunk(chunk, i);
        results.push(result);

        // Small delay between requests to be gentle on the server
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        }
      }

      // Sort results by original index to maintain order and collect all threads
      results.sort((a, b) => a.index - b.index);
      results.forEach((result) => {
        allThreads.push(...result.threads);
      });

      setLoadingProgress({ current: 0, total: 0, currentDate: '' });
      setFinalChunkStatuses(localChunkStatuses); // Store final statuses for later viewing

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
          errorMessage =
            'Network error: Unable to connect to API. Check your internet connection and CORS settings.';
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
    () =>
      debounce((term: string) => {
        setSearchTerm(term);
      }, 300),
    []
  );

  const filteredThreads = useMemo(() => {
    const filtered = threads
      .filter((thread) => {
        // Safety check: ensure thread has valid structure
        if (!thread || !Array.isArray(thread.messages)) {
          return false;
        }

        const _parsed = parseThreadId(thread.id);

        // Search filter
        if (searchTerm && typeof searchTerm === 'string') {
          const searchLower = searchTerm.toLowerCase();
          if (
            !thread.id.toLowerCase().includes(searchLower) &&
            !thread.conversationId.toLowerCase().includes(searchLower)
          ) {
            return false;
          }
        }

        // Message content search filter - comprehensive search through all message content
        if (messageSearchEnabled && messageSearchTerm) {
          const searchLower = messageSearchTerm.toLowerCase().trim();

          // Debug mode - enable this to troubleshoot search issues
          // You can also enable by typing "debug-search" in the search box
          const _debugSearch = messageSearchTerm.includes('debug-search') || false;

          // Search through thread messages directly (threads now contain all messages)
          // EXCLUDE system messages - only search user and assistant messages
          const hasMatchingMessage =
            thread.messages?.some((message: any) => {
              try {
                // Skip system/status messages - only search user and assistant messages
                if (message.role === 'system' || message.role === 'status') {
                  return false;
                }
                // Handle different content structures
                if (message.content) {
                  // Case 1: content is a direct string
                  if (typeof message.content === 'string') {
                    const found = message.content.toLowerCase().includes(searchLower);
                    return found;
                  }

                  // Case 2: content is an array of content objects
                  if (Array.isArray(message.content)) {
                    const matchFound = message.content.some((content: any) => {
                      try {
                        // Search in text field
                        if (content.text && typeof content.text === 'string') {
                          if (content.text.toLowerCase().includes(searchLower)) {
                            return true;
                          }
                        }

                        // Search in content field
                        if (content.content && typeof content.content === 'string') {
                          if (content.content.toLowerCase().includes(searchLower)) {
                            return true;
                          }
                        }

                        // Search in tool_use content (for assistant messages with tool calls)
                        if (content.tool_use?.input) {
                          const toolInput = JSON.stringify(content.tool_use.input).toLowerCase();
                          if (toolInput.includes(searchLower)) {
                            return true;
                          }
                        }

                        // Search in any other string fields within content
                        if (typeof content === 'object' && content !== null) {
                          const contentStr = JSON.stringify(content).toLowerCase();
                          if (contentStr.includes(searchLower)) {
                            return true;
                          }
                        }
                      } catch (_e) {
                        // Error processing content item
                      }
                      return false;
                    });
                    return matchFound;
                  }

                  // Case 3: content is an object (not array)
                  if (typeof message.content === 'object' && message.content !== null) {
                    const contentStr = JSON.stringify(message.content).toLowerCase();
                    return contentStr.includes(searchLower);
                  }
                }
              } catch (_e) {
                // Error processing message
              }
              return false;
            }) || false;

          if (!hasMatchingMessage) {
            return false;
          }
        }

        // UI filter
        if (hasUiFilter) {
          const hasUi = thread.messages.some((m) => 
            Array.isArray(m.content) && m.content.some((c) => c.kind === 'ui')
          );
          if (!hasUi) {
            return false;
          }
        }

        // Tool filter - using same logic as tool counting for consistency
        if (selectedTools.size > 0) {
          const threadTools = new Set<string>();

          // Extract tools from this thread using the same patterns as availableToolsWithCounts
          thread.messages.forEach((message) => {
            // Check system/status messages
            if ((message.role === 'system' || message.role === 'status') && Array.isArray(message.content)) {
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

                  // Also support messages like: Tool Call Initiated (`name`) / (name) / : name
                  const initiatedPatterns = [
                    /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
                    /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                    /Calling\s+tool[:\s]*`([^`]+)`/gi,
                    /Using\s+tool[:\s]*`([^`]+)`/gi,
                  ];
                  initiatedPatterns.forEach((pattern) => {
                    for (const m of text.matchAll(pattern)) {
                      const candidate = (m[1] || '').trim();
                      const toolName = candidate.replace(/^['"`]+|['"`]+$/g, '');
                      if (toolName && toolName.length > 1) {
                        threadTools.add(toolName);
                      }
                    }
                  });
                }
              });
            }

            // Check assistant messages for tool usage (same as counting logic)
            if (message.role === 'assistant' && Array.isArray(message.content)) {
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
                    /Calling the (\w+) function/gi,
                  ];

                  toolUsagePatterns.forEach((pattern) => {
                    const matches = text.matchAll(pattern);
                    for (const match of matches) {
                      const toolName = match[1];
                      if (toolName && toolName.length > 1) {
                        threadTools.add(toolName);
                      }
                    }
                  });

                  // Also include initiated patterns in assistant text like counting logic
                  const initiatedPatterns = [
                    /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
                    /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                    /Calling\s+tool[:\s]*`([^`]+)`/gi,
                    /Using\s+tool[:\s]*`([^`]+)`/gi,
                  ];
                  initiatedPatterns.forEach((pattern) => {
                    for (const m of text.matchAll(pattern)) {
                      const candidate = (m[1] || '').trim();
                      const toolName = candidate.replace(/^['"`]+|['"`]+$/g, '');
                      if (toolName && toolName.length > 1) {
                        threadTools.add(toolName);
                      }
                    }
                  });
                }
              });
            }

            // Check for message-level tool_calls (same as counting logic)
            if ((message as any).tool_calls) {
              (message as any).tool_calls.forEach((tool: any) => {
                if (tool.function?.name) {
                  const toolName = tool.function.name;
                  if (toolName && toolName.length > 1) {
                    threadTools.add(toolName);
                  }
                }
              });
            }
          });

          // Check if thread has any of the selected tools
          const hasSelectedTool = Array.from(selectedTools).some((tool) => threadTools.has(tool));
          if (!hasSelectedTool) {
            return false;
          }
        }

        // Workflow filter - using same logic as workflow counting for consistency
        if (selectedWorkflows.size > 0) {
          const threadWorkflows = new Set<string>();

          // Extract workflows from this thread using the same patterns as availableWorkflowsWithCounts
          thread.messages.forEach((message) => {
            // Check system/status messages
            if ((message.role === 'system' || message.role === 'status') && Array.isArray(message.content)) {
              message.content.forEach((content: any) => {
                if (content.text || content.content) {
                  const text = content.text || content.content || '';

                  // Look for "Workflows ausgewählt" pattern
                  if (text.includes('Workflows ausgewählt')) {
                    // Look for "* **Workflows:** `workflow-name1, workflow-name2`" pattern
                    const workflowPattern = /\*\s*\*\*Workflows:\*\*\s*`([^`]+)`/gi;
                    const matches = text.matchAll(workflowPattern);

                    for (const match of matches) {
                      const workflowsString = match[1];
                      if (workflowsString) {
                        // Split by comma and clean up workflow names
                        const workflows = workflowsString
                          .split(',')
                          .map((w) => w.trim())
                          .filter((w) => w.length > 0);
                        workflows.forEach((workflowName) => {
                          if (workflowName.length > 1) {
                            threadWorkflows.add(workflowName);
                          }
                        });
                      }
                    }
                  }

                  // Also look for standalone workflow mentions in system messages
                  const standaloneWorkflowPattern = /workflow-[\w-]+/gi;
                  const standaloneMatches = text.matchAll(standaloneWorkflowPattern);

                  for (const match of standaloneMatches) {
                    const workflowName = match[0];
                    if (workflowName && workflowName.length > 1) {
                      threadWorkflows.add(workflowName);
                    }
                  }
                }
              });
            }
          });

          // Check if thread has any of the selected workflows
          const hasSelectedWorkflow = Array.from(selectedWorkflows).some((workflow) =>
            threadWorkflows.has(workflow)
          );
          if (!hasSelectedWorkflow) {
            return false;
          }
        }

        // Simple error filter - show only threads with errors if checkbox is checked
        if (showErrorsOnly) {
          if (!threadHasErrors(thread)) {
            return false;
          }
        }

        // Timeout filter - show only threads with timeouts if checkbox is checked
        if (showTimeoutsOnly) {
          if (!threadHasTimeouts(thread)) {
            return false;
          }
        }

        // Topic filter - show only threads matching the selected topic
        if (selectedTopic) {
          const matches = threadMatchesTopic(thread, selectedTopic);
          if (!matches) {
            return false;
          }
        }

        // Advanced filters - calculate metrics for this thread
        const messageCount = thread.messages.filter(
          (msg) => msg.role === 'user' || msg.role === 'assistant'
        ).length;

        // Calculate conversation duration (first to last message)
        const allTimestamps = thread.messages
          .map((m: any) => new Date(m.created_at || m.createdAt || m.sentAt))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

        const conversationDuration =
          allTimestamps.length > 1
            ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
            : 0;
        const durationSeconds = Math.round(conversationDuration / 1000);

        // Calculate time to first assistant response
        const userMessages = thread.messages.filter((m: any) => m.role === 'user');
        const assistantMessages = thread.messages.filter((m: any) => m.role === 'assistant');

        let timeToFirstResponse = 0;
        if (userMessages.length > 0 && assistantMessages.length > 0) {
          const firstUserMessage = userMessages
            .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
            .filter((m) => !Number.isNaN(m.timestamp.getTime()))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

          const firstAssistantMessage = assistantMessages
            .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt) }))
            .filter((m) => !Number.isNaN(m.timestamp.getTime()))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

          if (
            firstUserMessage &&
            firstAssistantMessage &&
            firstAssistantMessage.timestamp > firstUserMessage.timestamp
          ) {
            timeToFirstResponse =
              firstAssistantMessage.timestamp.getTime() - firstUserMessage.timestamp.getTime();
          }
        }
        const responseTimeSeconds = Math.round(timeToFirstResponse / 1000);

        // Message count filters
        if (minMessages !== '' && messageCount < minMessages) {
          return false;
        }
        if (maxMessages !== '' && messageCount > maxMessages) {
          return false;
        }

        // Duration filters (in seconds)
        if (minDuration !== '' && durationSeconds < minDuration) {
          return false;
        }
        if (maxDuration !== '' && durationSeconds > maxDuration) {
          return false;
        }

        // Response time filters (in seconds)
        if (minResponseTime !== '' && responseTimeSeconds < minResponseTime) {
          return false;
        }
        if (maxResponseTime !== '' && responseTimeSeconds > maxResponseTime) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by createdAt timestamp with most recent first (descending order)
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; // Most recent first
      });

    return filtered;
  }, [
    threads,
    searchTerm,
    hasUiFilter,
    selectedTools,
    selectedWorkflows,
    showErrorsOnly,
    showTimeoutsOnly,
    selectedTopic,
    messageSearchEnabled,
    messageSearchTerm,
    threadHasErrors,
    threadHasTimeouts,
    threadMatchesTopic,
    minMessages,
    maxMessages,
    minDuration,
    maxDuration,
    minResponseTime,
    maxResponseTime,
  ]);

  // Update thread order whenever filtered threads change to keep navigation in sync
  useEffect(() => {
    if (filteredThreads.length > 0 && onThreadOrderChange) {
      // Use unique conversation IDs for navigation (some conversations may have multiple threads)
      const uniqueConversationIds = Array.from(
        new Set(filteredThreads.map((thread) => thread.conversationId))
      );
      onThreadOrderChange(uniqueConversationIds);
    }
  }, [filteredThreads, onThreadOrderChange]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / itemsPerPage);
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredThreads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredThreads, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, []);

  const _analytics = useMemo(() => calculateThreadAnalytics(filteredThreads), [filteredThreads]);

  // Calculate conversation analytics
  const conversationAnalytics = useMemo(() => {
    if (!uploadedConversations.length) {
      return null;
    }

    let totalMessages = 0;
    let totalUiEvents = 0;
    let totalLinkouts = 0;
    const totalConversations = uploadedConversations.length;
    let totalExcludedMessages = 0;

    uploadedConversations.forEach((conversation, _convIndex) => {
      const _allNonSystemMessages =
        conversation.messages?.filter((message: any) => message.role !== 'system') || [];

      // Count only non-system messages that don't contain UI components
      const nonSystemMessages =
        conversation.messages?.filter((message: any) => {
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

    const avgMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;

    // Conversation analytics calculated

    return {
      totalConversations,
      totalMessages,
      totalUiEvents,
      totalLinkouts,
      avgMessagesPerConversation,
      totalExcludedMessages,
    };
  }, [uploadedConversations]);

  const handleBulkAttributes = async () => {
    if (selectedThreads.size === 0) return;

    // Processing bulk attributes
    setBulkLoading(true);
    setError(null);

    try {
      const request: BulkAttributesRequest = {
        threads: Array.from(selectedThreads as Set<string>).map((threadId) => ({ threadId })),
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
  const _handleThreadView = (thread: Thread) => {
    // Mark thread as viewed
    const newViewedThreads = new Set(viewedThreads);
    newViewedThreads.add(thread.id);
    setViewedThreads(newViewedThreads);

    // Persist to localStorage
    try {
      setEnvironmentSpecificItem(
        'chatbot-dashboard-viewed-threads',
        JSON.stringify(Array.from(newViewedThreads))
      );
    } catch (_error) {
      // Failed to save viewed threads
    }

    // Call the original onThreadSelect callback
    onThreadSelect?.(thread);
  };

  // Mark conversation as viewed (can be called externally)
  const markConversationAsViewed = (conversationId: string) => {
    // Update local state immediately for instant visual feedback
    const newViewedConversations = new Set(viewedConversations);
    newViewedConversations.add(conversationId);
    setViewedConversations(newViewedConversations);

    // Notify parent component (App.tsx will handle localStorage persistence)
    onConversationViewed?.(conversationId);

    // Dispatch custom event for other listeners
    window.dispatchEvent(new CustomEvent('conversationViewed', { detail: { conversationId } }));
  };

  // Handle conversation viewing
  const handleConversationView = (conversationId: string, position?: number) => {
    // Handle conversation view

    // Mark conversation as viewed
    markConversationAsViewed(conversationId);

    // Find the thread associated with this conversation
    const associatedThread = filteredThreads.find(
      (thread) => thread.conversationId === conversationId
    );
    if (associatedThread && onThreadSelect) {
      // Since the threads endpoint now contains all messages, use the thread data directly
      onThreadSelect(associatedThread);
    }

    // Notify parent about the thread order for navigation FIRST
    // Use unique conversation IDs for navigation (some conversations may have multiple threads)
    const uniqueConversationIds = Array.from(
      new Set(filteredThreads.map((thread) => thread.conversationId))
    );
    onThreadOrderChange?.(uniqueConversationIds);

    // Since threads now contain all messages, we no longer need to fetch conversation data
    const currentIndex =
      position !== undefined
        ? position
        : filteredThreads.findIndex((thread) => thread.conversationId === conversationId);

    // Call the original onConversationSelect callback with position
    onConversationSelect?.(conversationId, currentIndex !== -1 ? currentIndex : undefined);
  };

  return (
    <div className="space-y-6">
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
                    <p className="text-lg font-bold">
                      {conversationAnalytics.totalConversations.toLocaleString()}
                    </p>
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
                    <p className="text-lg font-bold">
                      {conversationAnalytics.totalMessages.toLocaleString()}
                    </p>
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
                    <p className="text-lg font-bold">
                      {conversationAnalytics.totalUiEvents.toLocaleString()}
                    </p>
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
                    <p className="text-lg font-bold">
                      {conversationAnalytics.totalLinkouts.toLocaleString()}
                    </p>
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
            Search Threads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Filter Buttons */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.hours}
                  variant={activeQuickFilter === filter.hours ? 'default' : 'outline'}
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
                      {loadingProgress.total > 0
                        ? `Chunk ${loadingProgress.current}/${loadingProgress.total}`
                        : 'Fetching in progress...'}
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
                {finalChunkStatuses.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowChunkStatus(true)}
                    className="px-3 py-1 text-xs font-medium flex-shrink-0"
                  >
                    Chunk Status ({finalChunkStatuses.length})
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
                      Searching through {filteredThreads.length} thread messages for "
                      {messageSearchTerm}"
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
                        <span>
                          {conversation.messages?.filter((msg: any) => {
                            if (msg.role === 'system') return false;
                            const hasUiComponent = msg.content?.some(
                              (content: any) => content.kind === 'ui'
                            );
                            return !hasUiComponent;
                          }).length || 0}{' '}
                          messages
                        </span>
                        <span>{conversation.threadIds?.length || 0} threads</span>
                        <span>{formatTimestamp(conversation.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">
                        {conversation.messages?.reduce(
                          (acc: number, msg: any) =>
                            acc + (msg.content?.filter((c: any) => c.kind === 'ui').length || 0),
                          0
                        )}{' '}
                        UI
                      </Badge>
                      <Badge variant="outline">
                        {conversation.messages?.reduce(
                          (acc: number, msg: any) =>
                            acc +
                            (msg.content?.filter((c: any) => c.kind === 'linkout').length || 0),
                          0
                        )}{' '}
                        Links
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
            <CardDescription>{selectedThreads.size} thread(s) selected</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBulkAttributes} disabled={bulkLoading} className="mr-4">
              {bulkLoading ? 'Processing...' : 'Process Attributes'}
            </Button>
            <Button variant="outline" onClick={() => setSelectedThreads(new Set())}>
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
                  📅 Current: {loadingProgress.currentDate} (Chunk {loadingProgress.current} of{' '}
                  {loadingProgress.total})
                </p>
              )}

              {/* Progress Bar - Visible styled bar */}
              <div 
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(1, Math.min(100, (loadingProgress.current / loadingProgress.total) * 100))}%`,
                    backgroundColor: '#111827',
                    borderRadius: '4px',
                    transition: 'width 0.3s',
                  }}
                />
              </div>

              <p className="text-xs text-gray-500">
                Processing data with smart chunking for optimal speed and reliability...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Analysis */}
      {threads.length > 0 && (
        <IntentAnalysis
          threads={threads}
          onTopicClick={(topicName) => {
            setSelectedTopic(topicName);
          }}
        />
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
                    <span className="font-medium">Search period:</span>{' '}
                    {new Date(lastSearchDates.startDate).toLocaleString('en-GB')} -{' '}
                    {new Date(lastSearchDates.endDate).toLocaleString('en-GB')}
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
                    <Label htmlFor="hasUi" className="text-sm">
                      Has UI Components
                    </Label>
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
                    {(minMessages !== '' ||
                      maxMessages !== '' ||
                      minDuration !== '' ||
                      maxDuration !== '' ||
                      minResponseTime !== '' ||
                      maxResponseTime !== '') && (
                      <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                        Active
                      </Badge>
                    )}
                  </Button>

                  {/* Tool Filter Dropdown */}
                  {availableTools.length > 0 && (
                    <div className="relative">
                      <Button
                        ref={toolButtonRef}
                        variant="outline"
                        size="sm"
                        className="h-8 border-dashed"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (!toolDropdownOpen && toolButtonRef.current) {
                            const rect = toolButtonRef.current.getBoundingClientRect();
                            const position = {
                              top: rect.bottom + 4,
                              left: rect.left,
                            };
                            setToolDropdownPosition(position);
                          }
                          setToolDropdownOpen((prev) => !prev);
                        }}
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

                      {toolDropdownOpen &&
                        createPortal(
                          <div
                            ref={toolDropdownRef}
                            data-dropdown="tool"
                            className="fixed w-96 bg-white border-2 border-gray-400 rounded-md shadow-2xl flex flex-col"
                            style={{
                              backgroundColor: '#ffffff',
                              opacity: 1,
                              zIndex: 999999,
                              boxShadow:
                                '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                              top: `${toolDropdownPosition.top}px`,
                              left: `${toolDropdownPosition.left}px`,
                              maxHeight: '300px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="p-3 flex-shrink-0 border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-gray-600">
                                  Filter by Tools
                                </Label>
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
                            </div>
                            <div className="flex-1 overflow-y-auto" style={{ maxHeight: '240px' }}>
                              <div className="p-3">
                                <div className="space-y-1">
                                  {availableToolsWithCounts.length > 0 ? (
                                    availableToolsWithCounts.map((toolInfo) => (
                                      <div
                                        key={toolInfo.name}
                                        className="flex items-center space-x-2 py-1"
                                      >
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
                                            className="text-xs cursor-pointer flex-1 mr-2 break-all"
                                            title={toolInfo.name}
                                          >
                                            {toolInfo.name}
                                          </Label>
                                          <Badge
                                            variant="secondary"
                                            className="text-xs px-1 py-0 h-4 min-w-0 shrink-0"
                                          >
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
                          </div>,
                          document.body
                        )}
                    </div>
                  )}

                  {/* Workflow Filter Dropdown */}
                  {availableWorkflows.length > 0 && (
                    <div className="relative">
                      <Button
                        ref={workflowButtonRef}
                        variant="outline"
                        size="sm"
                        className="h-8 border-dashed"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (!workflowDropdownOpen && workflowButtonRef.current) {
                            const rect = workflowButtonRef.current.getBoundingClientRect();
                            const position = {
                              top: rect.bottom + 4,
                              left: rect.left,
                            };
                            setWorkflowDropdownPosition(position);
                          }
                          setWorkflowDropdownOpen((prev) => !prev);
                        }}
                      >
                        <Filter className="mr-2 h-3 w-3" />
                        Workflows
                        {selectedWorkflows.size > 0 && (
                          <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                            {selectedWorkflows.size}
                          </Badge>
                        )}
                        <ChevronDown className="ml-2 h-3 w-3" />
                      </Button>

                      {workflowDropdownOpen &&
                        createPortal(
                          <div
                            ref={workflowDropdownRef}
                            data-dropdown="workflow"
                            className="fixed w-96 bg-white border-2 border-gray-400 rounded-md shadow-2xl flex flex-col"
                            style={{
                              backgroundColor: '#ffffff',
                              opacity: 1,
                              zIndex: 999999,
                              boxShadow:
                                '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                              top: `${workflowDropdownPosition.top}px`,
                              left: `${workflowDropdownPosition.left}px`,
                              maxHeight: '300px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="p-3 flex-shrink-0 border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-gray-600">
                                  Filter by Workflows
                                </Label>
                                {selectedWorkflows.size > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-xs"
                                    onClick={() => setSelectedWorkflows(new Set())}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto" style={{ maxHeight: '240px' }}>
                              <div className="p-3">
                                <div className="space-y-1">
                                  {availableWorkflowsWithCounts.length > 0 ? (
                                    availableWorkflowsWithCounts.map((workflowInfo) => (
                                      <div
                                        key={workflowInfo.name}
                                        className="flex items-center space-x-2 py-1"
                                      >
                                        <Checkbox
                                          id={`workflow-${workflowInfo.name}`}
                                          checked={selectedWorkflows.has(workflowInfo.name)}
                                          onCheckedChange={(checked) => {
                                            const newSelected = new Set(selectedWorkflows);
                                            if (checked) {
                                              newSelected.add(workflowInfo.name);
                                            } else {
                                              newSelected.delete(workflowInfo.name);
                                            }
                                            setSelectedWorkflows(newSelected);
                                          }}
                                          className="h-3 w-3"
                                        />
                                        <div className="flex-1 flex items-center justify-between min-w-0">
                                          <Label
                                            htmlFor={`workflow-${workflowInfo.name}`}
                                            className="text-xs cursor-pointer flex-1 mr-2 break-all"
                                            title={workflowInfo.name}
                                          >
                                            {workflowInfo.name}
                                          </Label>
                                          <Badge
                                            variant="secondary"
                                            className="text-xs px-1 py-0 h-4 min-w-0 shrink-0"
                                          >
                                            {workflowInfo.count}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-muted-foreground text-center py-3">
                                      <div>No workflows found in system messages</div>
                                      <div className="text-xs mt-1 opacity-75">
                                        Workflows will appear here after searching threads
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>,
                          document.body
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
                      <Label
                        htmlFor="show-errors-only"
                        className="text-sm font-medium cursor-pointer flex items-center"
                      >
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
                      <Label
                        htmlFor="show-timeouts-only"
                        className="text-sm font-medium cursor-pointer flex items-center"
                      >
                        <Clock className="mr-1 h-4 w-4 text-orange-500" />
                        Show timeouts only
                        <Badge
                          variant="secondary"
                          className="ml-2 px-2 py-0 text-xs bg-orange-100 text-orange-800"
                        >
                          {totalThreadsWithTimeouts}
                        </Badge>
                      </Label>
                    </div>
                  )}

                  {/* Topic Filter */}
                  {selectedTopic && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                        <Filter className="h-3 w-3 text-blue-600" />
                        <span className="text-sm text-blue-700">Topic: {selectedTopic}</span>
                        <button
                          onClick={() => setSelectedTopic(null)}
                          className="text-blue-600 hover:text-blue-800 ml-1"
                          title="Clear topic filter"
                        >
                          ×
                        </button>
                      </div>
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
                        onChange={(e) =>
                          setMinMessages(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxMessages}
                        onChange={(e) =>
                          setMaxMessages(e.target.value === '' ? '' : Number(e.target.value))
                        }
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
                        onChange={(e) =>
                          setMinDuration(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxDuration}
                        onChange={(e) =>
                          setMaxDuration(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="h-8 text-xs"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Response Time Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Response Time (seconds)
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={minResponseTime}
                        onChange={(e) =>
                          setMinResponseTime(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="h-8 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxResponseTime}
                        onChange={(e) =>
                          setMaxResponseTime(e.target.value === '' ? '' : Number(e.target.value))
                        }
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
                        checked={
                          paginatedThreads.length > 0 &&
                          paginatedThreads.every((thread) => selectedThreads.has(thread.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedThreads(new Set(paginatedThreads.map((t) => t.id)));
                          } else {
                            setSelectedThreads(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead style={{ width: '200px', minWidth: '200px' }}>
                      First User Message
                    </TableHead>
                    <TableHead style={{ width: '150px', minWidth: '150px' }}>Thread ID</TableHead>
                    <TableHead style={{ width: '200px', minWidth: '200px' }}>
                      Conversation ID
                    </TableHead>
                    <TableHead style={{ width: '140px', minWidth: '140px' }}>Created</TableHead>
                    <TableHead style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>
                      UI Events
                    </TableHead>
                    <TableHead style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>
                      Messages
                    </TableHead>
                    <TableHead style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>
                      Duration
                    </TableHead>
                    <TableHead style={{ width: '110px', minWidth: '110px', textAlign: 'center' }}>
                      Response Time
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody key={`tbody-${viewedConversations.size}-${currentPage}`}>
                  {filteredThreads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <div className="text-muted-foreground">
                          <p className="text-lg font-medium mb-2">No threads found</p>
                          <p className="text-sm">
                            Try adjusting your filters or search terms to see more results.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedThreads.map((thread, paginatedIndex) => {
                      const actualIndex = (currentPage - 1) * itemsPerPage + paginatedIndex;
                      const hasConversationData = uploadedConversations.some(
                        (c) => c.id === thread.conversationId
                      );
                      const isThreadViewed = viewedThreads.has(thread.id);
                      const isConversationViewed = viewedConversations.has(thread.conversationId);
                      const hasError = threadHasErrors(thread);

                      return (
                        <ThreadRow
                          key={`${thread.id}-viewed-${isConversationViewed}`}
                          thread={thread}
                          actualIndex={actualIndex}
                          isSelected={selectedThreads.has(thread.id)}
                          isThreadViewed={isThreadViewed}
                          isConversationViewed={isConversationViewed}
                          hasConversationData={hasConversationData}
                          isSaved={savedConversationIds.has(thread.conversationId)}
                          hasError={hasError}
                          onToggleSelection={() => toggleThreadSelection(thread.id)}
                          onConversationView={() =>
                            handleConversationView(thread.conversationId, actualIndex)
                          }
                        />
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredThreads.length)} of{' '}
                  {filteredThreads.length} threads
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(1)}
                        className={
                          currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                        }
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
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className={
                          currentPage === totalPages
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chunk Status Modal */}
      {showChunkStatus && (
        <ChunkStatusModal
          isOpen={showChunkStatus}
          onClose={() => setShowChunkStatus(false)}
          chunkStatuses={finalChunkStatuses}
        />
      )}
    </div>
  );
}
