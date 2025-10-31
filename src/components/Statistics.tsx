import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  LabelList
} from 'recharts';
import { 
  TrendingUp,
  MessageSquare,
  Users,
  Calendar,
  Activity,
  BarChart3,
  CalendarIcon,
  Filter,
  RefreshCw,
  Download
} from 'lucide-react';
import { Thread } from '../lib/types';
import { getApiBaseUrl, getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';

interface StatisticsProps {
  threads: Thread[];
  uploadedConversations?: any[];
}

// Helper function to extract workflows from conversation messages (same as other components)
function extractWorkflowsFromConversation(conversation: any): Set<string> {
  const workflows = new Set<string>();
  
  if (!conversation.messages) return workflows;
  
  conversation.messages.forEach((message: any) => {
    // Look for workflows in system/status messages
    if (message.role === 'system' || message.role === 'status') {
      if (message.content) {
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
                  const workflowNames = workflowsString.split(',').map(w => w.trim()).filter(w => w.length > 0);
                  workflowNames.forEach(workflowName => {
                    if (workflowName.length > 1) {
                      workflows.add(workflowName);
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
                workflows.add(workflowName);
              }
            }
          }
        });
      }
    }
  });
  
  return workflows;
}

export function Statistics({ threads, uploadedConversations = [] }: StatisticsProps) {
  
  // Time range state with localStorage persistence - using full days
  const [startDate, setStartDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-start-date');
      if (saved) {
        const date = new Date(saved);
        // Set to start of day
        date.setHours(0, 0, 0, 0);
        return date;
      }
    } catch (error) {
      console.warn('Failed to load saved stats start date:', error);
    }
    // Default to yesterday (full day)
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-end-date');
      if (saved) {
        const date = new Date(saved);
        // Set to end of day
        date.setHours(23, 59, 59, 999);
        return date;
      }
    } catch (error) {
      console.warn('Failed to load saved stats end date:', error);
    }
    // Default to today (end of current day)
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });

  // Fetching state
  const [fetchedConversations, setFetchedConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchKey, setLastSearchKey] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, currentDate: '' });
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (showToolDetails || showWorkflowDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showToolDetails, showWorkflowDetails]);

  // Save statistics state to localStorage when it changes
  useEffect(() => {
    try {
      if (startDate) {
        setEnvironmentSpecificItem('chatbot-dashboard-stats-start-date', startDate.toISOString());
      }
    } catch (error) {
      console.warn('Failed to save stats start date:', error);
    }
  }, [startDate]);

  useEffect(() => {
    try {
      if (endDate) {
        setEnvironmentSpecificItem('chatbot-dashboard-stats-end-date', endDate.toISOString());
      }
    } catch (error) {
      console.warn('Failed to save stats end date:', error);
    }
  }, [endDate]);

  // Fetch conversations for statistics
  const fetchConversationsForStats = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    // Create cache key
    const searchKey = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    // Check if we already have this data cached
    if (searchKey === lastSearchKey && fetchedConversations.length > 0) {
      console.log('Using cached statistics data');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiKey = await getEnvironmentSpecificItem('chatbot-dashboard-api-key');
      if (!apiKey?.trim()) {
        throw new Error('API key is required');
      }

      const apiBaseUrl = getApiBaseUrl();
      
      // Calculate time difference - use smart chunking for optimal balance
      const timeDiff = endDate.getTime() - startDate.getTime();
      const hoursDiff = Math.ceil(timeDiff / (1000 * 60 * 60));
      
      let allConversations: any[] = [];
      
      // Smart chunking strategy based on typical usage patterns
      // 00:00-11:59 (12h), 12:00-16:59 (5h), 17:00-18:59 (2h), 19:00-20:59 (2h), 21:00-23:59 (3h)
      console.log(`📊 Processing ${hoursDiff} hours with smart chunking strategy...`);
      
      const chunks: Array<{start: Date, end: Date, dateStr: string}> = [];
      
      // Smart chunking function for a single day
      const createDayChunks = (dayStart: Date) => {
        const dayChunks: Array<{start: Date, end: Date, dateStr: string}> = [];
        const year = dayStart.getFullYear();
        const month = dayStart.getMonth();
        const date = dayStart.getDate();
        
        // Define smart chunk periods for each day
        const periods = [
          { start: 0, end: 11, label: '00:00-11:59' },   // 12 hours - low activity
          { start: 12, end: 16, label: '12:00-16:59' },  // 5 hours - moderate activity
          { start: 17, end: 18, label: '17:00-18:59' },  // 2 hours - peak activity
          { start: 19, end: 20, label: '19:00-20:59' },  // 2 hours - peak activity
          { start: 21, end: 23, label: '21:00-23:59' }   // 3 hours - moderate activity
        ];
        
        periods.forEach(period => {
          const chunkStart = new Date(year, month, date, period.start, 0, 0);
          const chunkEnd = new Date(year, month, date, period.end, 59, 59, 999);
          
          dayChunks.push({
            start: chunkStart,
            end: chunkEnd,
            dateStr: `${chunkStart.toLocaleDateString()} ${period.label}`
          });
        });
        
        return dayChunks;
      };
      
      // Generate chunks for each day in the range
      let currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0); // Start at beginning of day
      
      const endDateObj = new Date(endDate);
      
      while (currentDate <= endDateObj) {
        const dayChunks = createDayChunks(currentDate);
        
        // Filter chunks to only include those that overlap with our time range
        dayChunks.forEach(chunk => {
          const chunkStart = new Date(Math.max(chunk.start.getTime(), startDate.getTime()));
          const chunkEnd = new Date(Math.min(chunk.end.getTime(), endDate.getTime()));
          
          // Only add chunk if it has a valid time range
          if (chunkStart < chunkEnd) {
            chunks.push({
              start: chunkStart,
              end: chunkEnd,
              dateStr: `${chunkStart.toLocaleDateString()} ${chunkStart.getHours()}:${chunkStart.getMinutes().toString().padStart(2, '0')}-${chunkEnd.getHours()}:${chunkEnd.getMinutes().toString().padStart(2, '0')}`
            });
          }
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Parallel processing with concurrency control (like ThreadPoolExecutor)
      // Get concurrency setting from localStorage or use default
      const savedConcurrency = localStorage.getItem('chatbot-dashboard-concurrency');
      const CONCURRENT_REQUESTS = savedConcurrency ? parseInt(savedConcurrency, 10) : 5; // Number of parallel requests
      
      console.log(`📦 Processing ${chunks.length} smart chunks with parallel fetching (concurrency: ${CONCURRENT_REQUESTS})`);
      setLoadingProgress({ current: 0, total: chunks.length, currentDate: '' });
      let completedChunks = 0;
      
      // Function to process a single chunk
      const processChunk = async (chunk: any, index: number) => {
        console.log(`📅 Starting chunk ${index + 1}/${chunks.length}: ${chunk.dateStr}`);
        
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
              limit: 10000
            }),
          });

          if (!response.ok) {
            console.warn(`⚠️ Chunk ${index + 1} (${chunk.dateStr}) failed: HTTP ${response.status}`);
            // Update progress even for failed chunks
            completedChunks++;
            setLoadingProgress({ 
              current: completedChunks, 
              total: chunks.length, 
              currentDate: `Failed: ${chunk.dateStr}` 
            });
            return { conversations: [], index, chunk };
          }

          const chunkData = await response.json();
          const chunkThreads = chunkData.threads?.map((item: any) => item.thread) || [];
          
          // Convert to conversation-like objects
          const chunkConversations = chunkThreads.map((thread: any) => ({
            id: thread.conversationId,
            createdAt: thread.createdAt,
            created_at: thread.createdAt,
            messages: thread.messages || [],
            threadId: thread.id,
            threadCreatedAt: thread.createdAt
          }));
          
          // Update progress immediately when chunk completes
          completedChunks++;
          setLoadingProgress({ 
            current: completedChunks, 
            total: chunks.length, 
            currentDate: `Completed: ${chunk.dateStr}` 
          });
          
          console.log(`✅ Chunk ${index + 1}/${chunks.length} (${chunk.dateStr}): +${chunkConversations.length} conversations`);
          return { conversations: chunkConversations, index, chunk };
          
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown error';
          const isTimeout = errorMessage.includes('504') || errorMessage.includes('timeout');
          
          if (isTimeout) {
            console.warn(`⚠️ Chunk ${index + 1} (${chunk.dateStr}) failed: HTTP 504 Gateway Timeout - Server overloaded or chunk too large`);
          } else {
            console.warn(`⚠️ Chunk ${index + 1} (${chunk.dateStr}) failed:`, errorMessage);
          }
          
          // Update progress even for errored chunks
          completedChunks++;
          setLoadingProgress({ 
            current: completedChunks, 
            total: chunks.length, 
            currentDate: `⚠️ ${isTimeout ? 'Timeout' : 'Error'}: ${chunk.dateStr}` 
          });
          return { conversations: [], index, chunk, error: errorMessage };
        }
      };

      // Process chunks sequentially to avoid overwhelming the server
      const results: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`📅 Processing chunk ${i + 1}/${chunks.length} sequentially: ${chunk.dateStr}`);
        
        const result = await processChunk(chunk, i);
        results.push(result);
        
        // Small delay between requests to be gentle on the server
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
        
        console.log(`✅ Completed chunk ${i + 1}/${chunks.length}`);
      }
      
      // Sort results by original index to maintain order and collect all conversations
      results.sort((a, b) => a.index - b.index);
      
      const failedChunks = results.filter(result => result.error);
      const successfulChunks = results.filter(result => !result.error);
      
      results.forEach(result => {
        allConversations.push(...result.conversations);
      });
      
      if (failedChunks.length > 0) {
        console.warn(`⚠️ Smart chunking completed with ${failedChunks.length} failed chunks:`);
        failedChunks.forEach(failed => {
          const isTimeout = failed.error?.includes('504') || failed.error?.includes('timeout');
          console.warn(`   - ${failed.chunk.dateStr}: ${isTimeout ? 'Server timeout (504)' : failed.error}`);
        });
        console.log(`✅ Successfully loaded ${allConversations.length} conversations from ${successfulChunks.length}/${chunks.length} chunks`);
      } else {
        console.log(`🎉 Sequential chunking complete: ${allConversations.length} total conversations from ${chunks.length} chunks`);
      }
      
      setLoadingProgress({ current: 0, total: 0, currentDate: '' });
      
      setFetchedConversations(allConversations);
      setLastSearchKey(searchKey);
      
    } catch (error) {
      console.error('Error fetching conversations for statistics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data based on selected time range
  const filteredThreads = useMemo(() => {
    if (!startDate || !endDate) return threads;
    
    return threads.filter(thread => {
      const threadDate = new Date(thread.createdAt);
      return threadDate >= startDate && threadDate <= endDate;
    });
  }, [threads, startDate, endDate]);

  const filteredUploadedConversations = useMemo(() => {
    if (!startDate || !endDate) return uploadedConversations;
    
    return uploadedConversations.filter(conversation => {
      const convDate = new Date(conversation.createdAt || conversation.created_at || Date.now());
      return convDate >= startDate && convDate <= endDate;
    });
  }, [uploadedConversations, startDate, endDate]);

  // All conversations including fetched ones
  const allConversations = useMemo(() => {
    return [...filteredUploadedConversations, ...fetchedConversations];
  }, [filteredUploadedConversations, fetchedConversations]);

  // Conversations per day data - FOR STATISTICS TAB ONLY
  const conversationsPerDay = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    // Create a map for actual conversation counts
    const dailyCounts: Record<string, Set<string>> = {};
    
    // Only use fetchedConversations for statistics (not threads or uploaded data)
    fetchedConversations.forEach(conversation => {
      if (conversation.id) {
        const date = new Date(conversation.createdAt || conversation.created_at || Date.now()).toDateString();
        if (!dailyCounts[date]) {
          dailyCounts[date] = new Set();
        }
        dailyCounts[date].add(conversation.id);
      }
    });

    // Generate ALL days in the date range (including zeros and recent days)
    const result = [];
    const currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    while (currentDate <= endDateTime) {
      const dateString = currentDate.toDateString();
      const conversations = dailyCounts[dateString] ? dailyCounts[dateString].size : 0;
      
      result.push({
        date: new Date(currentDate),
        formattedDate: currentDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        conversations: conversations
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }, [fetchedConversations, startDate, endDate]);

  // Calculate conversation metrics
  const conversationMetrics = useMemo(() => {
    return allConversations.map(conversation => {
      if (!conversation.messages) return null;

      // Calculate conversation duration (first to last message)
      const allTimestamps = conversation.messages
        .map((m: any) => new Date(m.created_at || m.createdAt || m.sentAt))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      
      const conversationDuration = allTimestamps.length > 1 
        ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
        : 0;

      // Calculate time to first assistant response
      const userMessages = conversation.messages.filter((m: any) => m.role === 'user');
      const assistantMessages = conversation.messages.filter((m: any) => m.role === 'assistant');
      
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

      return {
        id: conversation.id,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        totalMessages: userMessages.length + assistantMessages.length,
        duration: conversationDuration, // in milliseconds
        durationMinutes: Math.round(conversationDuration / (1000 * 60)),
        durationHours: Math.round(conversationDuration / (1000 * 60 * 60) * 10) / 10,
        timeToFirstResponse: timeToFirstResponse, // in milliseconds
        timeToFirstResponseSeconds: Math.round(timeToFirstResponse / 1000),
        timeToFirstResponseMinutes: Math.round(timeToFirstResponse / (1000 * 60) * 10) / 10
      };
    }).filter(Boolean);
  }, [allConversations]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalConversations = new Set([
      ...filteredThreads.map(t => t.conversationId),
      ...allConversations.map(c => c.id)
    ]).size;

    const totalThreads = filteredThreads.length + allConversations.length;
    
    const avgConversationsPerDay = conversationsPerDay.length > 0 
      ? Math.round(conversationsPerDay.reduce((sum, day) => sum + day.conversations, 0) / conversationsPerDay.length)
      : 0;

    const peakDay = conversationsPerDay.reduce((max, day) => 
      day.conversations > max.conversations ? day : max, 
      { conversations: 0, formattedDate: 'N/A' }
    );

    // Function to check if a conversation has errors (same logic as ThreadsOverview)
    const conversationHasErrors = (conversation: any): boolean => {
      if (!conversation.messages) return false;
      return conversation.messages.some((message: any) => {
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
    };

    // Calculate conversations with errors
    const conversationsWithErrors = allConversations.filter(conversationHasErrors);
    const errorPercentage = allConversations.length > 0 
      ? Math.round((conversationsWithErrors.length / allConversations.length) * 100)
      : 0;

    // Conversation metrics aggregation
    const totalUserMessages = conversationMetrics.reduce((sum, conv) => sum + (conv?.userMessages || 0), 0);
    const totalAssistantMessages = conversationMetrics.reduce((sum, conv) => sum + (conv?.assistantMessages || 0), 0);
    
    // Modified: Average messages per conversation - ONLY count user messages
    const avgMessagesPerConversation = conversationMetrics.length > 0 
      ? Math.round((totalUserMessages / conversationMetrics.length) * 100) / 100
      : 0;
    
    const avgDurationMinutes = conversationMetrics.length > 0
      ? Math.round((conversationMetrics.reduce((sum, conv) => sum + (conv?.durationMinutes || 0), 0) / conversationMetrics.length) * 100) / 100
      : 0;
    
    const avgTimeToFirstResponseSeconds = conversationMetrics.length > 0
      ? Math.round((conversationMetrics.reduce((sum, conv) => sum + (conv?.timeToFirstResponseSeconds || 0), 0) / conversationMetrics.length) * 100) / 100
      : 0;

    // Calculate Kontaktquote (conversations with contact tools)
    // Base contact tool patterns (without prefixes) - only the two tools we want to track
    const baseContactTools = [
      'send-message-to-customer-service', 
      'callback'
    ];
    
    // Calculate Travel Agent Quote (conversations with travel agent tools)
    // Base travel agent tool patterns (without prefixes)
    const baseTravelAgentTools = [
      'get-promoted-results-url',
      'get-hotel-min-price',
      'search-hotels',
      'show-hotel-recommendations'
    ];
    
    // Function to check if a tool name matches any contact tool pattern
    const isContactTool = (toolName: string): boolean => {
      return baseContactTools.some(baseTool => {
        // Check exact match
        if (toolName === baseTool) return true;
        
        // Check with various prefixes and formats
        const patterns = [
          `hotel__${baseTool}`,
          `hotel-staging__${baseTool}`,
          `hotel__${baseTool.replace(/-/g, '_')}`,
          `hotel-staging__${baseTool.replace(/-/g, '_')}`,
          baseTool.replace(/-/g, '_')
        ];
        
        return patterns.some(pattern => toolName === pattern);
      });
    };
    
    // Function to check if a tool name matches any travel agent tool pattern
    const isTravelAgentTool = (toolName: string): boolean => {
      return baseTravelAgentTools.some(baseTool => {
        // Check exact match
        if (toolName === baseTool) return true;
        
        // Check with various prefixes and formats
        const patterns = [
          `hotel__${baseTool}`,
          `hotel-staging__${baseTool}`,
          `hotel__${baseTool.replace(/-/g, '_')}`,
          `hotel-staging__${baseTool.replace(/-/g, '_')}`,
          baseTool.replace(/-/g, '_')
        ];
        
        return patterns.some(pattern => toolName === pattern);
      });
    };
    
    // Debug: Comprehensive tool search across ALL messages and content types
    const allToolNames = new Set<string>();

    // Local helper to normalize and validate tool names
    const normalizeToolName = (raw: string | undefined | null): string | null => {
      if (!raw) return null;
      let name = String(raw).trim();
      // Strip backticks/quotes/parentheses and trailing punctuation
      name = name.replace(/^['"`(\s]+|[)\s'"`.:;,]+$/g, '');
      name = name.replace(/`/g, '');
      // Replace spaces with hyphens
      name = name.replace(/\s+/g, '-');
      // Allow only safe chars
      name = name.replace(/[^A-Za-z0-9._-]/g, '-');
      // Collapse multiple hyphens
      name = name.replace(/-{2,}/g, '-');
      if (!name || name.length < 2) return null;
      if (!/[A-Za-z0-9]/.test(name)) return null;
      return name;
    };
    let contactToolsFound = new Set<string>();
    let totalMessagesChecked = 0;
    let messagesWithContent = 0;
    let contentItemsChecked = 0;
    
    fetchedConversations.forEach(conversation => {
      if (conversation.messages) {
        conversation.messages.forEach((message: any) => {
          totalMessagesChecked++;
          
          if (message.content) {
            messagesWithContent++;
            message.content.forEach((content: any) => {
              contentItemsChecked++;
              
              // FIRST: Use the WORKING logic from ThreadsOverview
              if (message.role === 'system' || message.role === 'status') {
                if (content.text || content.content) {
                  const text = (content.text || content.content || '').toString();
                  
                  // Look for "**Tool Name:** `name`" pattern
                  for (const match of text.matchAll(/\*\*Tool Name:\*\*\s*`([^`]+)`/gi)) {
                    const normalized = normalizeToolName(match[1]);
                    if (normalized) allToolNames.add(normalized);
                  }
                  // Also support messages like: Tool Call Initiated (`name`) / (name) / : name
                  const initiatedPatterns = [
                    /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
                    /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                    /Calling\s+tool[:\s]*`([^`]+)`/gi,
                    /Using\s+tool[:\s]*`([^`]+)`/gi
                  ];
                  initiatedPatterns.forEach((pattern) => {
                    for (const m of text.matchAll(pattern)) {
                      const normalized = normalizeToolName(m[1]);
                      if (normalized) allToolNames.add(normalized);
                    }
                  });
                }
              }
              
              // SECOND: Check for assistant message tool usage (SAME as ThreadsOverview)
              if (message.role === 'assistant' && content.tool_use) {
                const normalized = normalizeToolName(content.tool_use.name);
                if (normalized) allToolNames.add(normalized);
              }
              
              // THIRD: Check for other tool storage patterns
              if (content.kind === 'tool_use' && content.tool_name) {
                const normalized = normalizeToolName(content.tool_name);
                if (normalized) allToolNames.add(normalized);
              }
              if (content.type === 'tool_use' && content.name) {
                const normalized = normalizeToolName(content.name);
                if (normalized) allToolNames.add(normalized);
              }
              if (content.tool && content.tool.name) {
                const normalized = normalizeToolName(content.tool.name);
                if (normalized) allToolNames.add(normalized);
              }
              if (content.function_call && content.function_call.name) {
                const normalized = normalizeToolName(content.function_call.name);
                if (normalized) allToolNames.add(normalized);
              }
              
              // NEW: Check if tools are mentioned in the text content itself
              // Do not add loose text mentions into tool list (avoids odd names in details view)
            });
          }
          
          // Also check message-level tool storage
          if (message.tool_calls) {
            message.tool_calls.forEach((tool: any) => {
              if (tool.function && tool.function.name) {
                allToolNames.add(tool.function.name);
              }
            });
          }
        });
      }
    });
    
    // Sample text analysis to see what's actually in the messages
    const sampleTexts = new Set<string>();
    const contactRelatedWords = new Set<string>();
    const potentialToolWords = ['hotline', 'callback', 'phone', 'number', 'service', 'customer', 'contact', 'call', 'support'];
    
    fetchedConversations.slice(0, 10).forEach(conversation => {
      if (conversation.messages) {
        conversation.messages.forEach((message: any) => {
          if (message.content) {
            message.content.forEach((content: any) => {
              if (content.text && typeof content.text === 'string') {
                const text = content.text.toLowerCase();
                
                // Sample some text snippets
                if (text.length > 20 && sampleTexts.size < 5) {
                  sampleTexts.add(text.substring(0, 100) + '...');
                }
                
                // Look for contact-related words
                potentialToolWords.forEach(word => {
                  if (text.includes(word)) {
                    contactRelatedWords.add(word);
                  }
                });
              }
            });
          }
        });
      }
    });
    
    // Check which contact and travel agent tools we found
    const foundContactTools = Array.from(allToolNames).filter(isContactTool);
    const foundTravelAgentTools = Array.from(allToolNames).filter(isTravelAgentTool);
    console.log(`🔧 Tools found: ${allToolNames.size} unique tools (${foundContactTools.length} contact, ${foundTravelAgentTools.length} travel agent)`, {
      contact: foundContactTools,
      travelAgent: foundTravelAgentTools
    });
    
    // TOOL-BASED APPROACH: Check for specific contact tools
    console.log('🔍 Kontaktquote Debug: Starting tool-based contact analysis...');
    const conversationsWithContactTools = fetchedConversations.filter((conversation, idx) => {
      if (!conversation.messages) return false;
      
      // Look for specific contact tools
      let hasContactTool = false;
      const foundTools = new Set<string>();
      
      conversation.messages.forEach((message: any) => {
        if (message.role === 'system' || message.role === 'status') {
          if (message.content) {
            message.content.forEach((content: any) => {
              if (content.text || content.content) {
                const text = content.text || content.content || '';
                
                // Look for "**Tool Name:**" pattern with specific tools
                const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
                const matches = text.matchAll(toolNamePattern);
                
                for (const match of matches) {
                  const toolNameRaw = match[1];
                  const toolName = normalizeToolName(toolNameRaw) || toolNameRaw;
                  foundTools.add(toolName);
                  
                  // Check for specific contact tools using flexible pattern matching
                  if (isContactTool(toolName)) {
                    hasContactTool = true;
                    if (idx < 3) {
                      console.log(`✅ Found contact tool in conversation ${idx}: ${toolName}`);
                    }
                    break;
                  }
                }

                // Also support text patterns like Tool Call Initiated/Completed and Calling/Using tool
                if (!hasContactTool) {
                  const initiatedPatterns = [
                    /Tool\s*Call\s*(?:Initiated|Completed)[^`\w]*`([^`]+)`/gi,
                    /Tool\s*Call\s*(?:Initiated|Completed)[^A-Za-z0-9_-]*\(([^)]+)\)/gi,
                    /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                    /Calling\s+tool[:\s]*`([^`]+)`/gi,
                    /Using\s+tool[:\s]*`([^`]+)`/gi
                  ];
                  for (let p = 0; p < initiatedPatterns.length && !hasContactTool; p++) {
                    const re = initiatedPatterns[p];
                    for (const m of text.matchAll(re)) {
                      const raw = m[1];
                      const name = normalizeToolName(raw) || raw;
                      foundTools.add(name);
                      if (isContactTool(name)) {
                        hasContactTool = true;
                        if (idx < 3) console.log(`✅ Found contact tool (initiated pattern) in conversation ${idx}: ${name}`);
                        break;
                      }
                    }
                  }
                }
              }
            });
          }
        }
        
        // Also check assistant message tool usage
        if (message.role === 'assistant' && message.content) {
          message.content.forEach((content: any) => {
            if (content.tool_use && content.tool_use.name) {
              const toolName = normalizeToolName(content.tool_use.name) || content.tool_use.name;
              foundTools.add(toolName);
              
              if (isContactTool(toolName)) {
                hasContactTool = true;
                if (idx < 3) {
                  console.log(`✅ Found contact tool in assistant message ${idx}: ${toolName}`);
                }
              }
            }

            // Assistant text-based mentions
            if ((content.text || content.content) && !hasContactTool) {
              const text = (content.text || content.content || '').toString();
              const initiatedPatterns = [
                /Tool\s*Call\s*(?:Initiated|Completed)[^`\w]*`([^`]+)`/gi,
                /Tool\s*Call\s*(?:Initiated|Completed)[^A-Za-z0-9_-]*\(([^)]+)\)/gi,
                /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                /Calling\s+tool[:\s]*`([^`]+)`/gi,
                /Using\s+tool[:\s]*`([^`]+)`/gi
              ];
              for (let p = 0; p < initiatedPatterns.length && !hasContactTool; p++) {
                const re = initiatedPatterns[p];
                for (const m of text.matchAll(re)) {
                  const raw = m[1];
                  const name = normalizeToolName(raw) || raw;
                  foundTools.add(name);
                  if (isContactTool(name)) {
                    hasContactTool = true;
                    if (idx < 3) console.log(`✅ Found contact tool (assistant text) in conversation ${idx}: ${name}`);
                    break;
                  }
                }
              }
            }

            // Assistant tool_use in alt schema
            if (content.kind === 'tool_use' && content.tool_name) {
              const name = normalizeToolName(content.tool_name) || content.tool_name;
              foundTools.add(name);
              if (isContactTool(name)) {
                hasContactTool = true;
                if (idx < 3) console.log(`✅ Found contact tool (assistant tool_use.kind) in conversation ${idx}: ${name}`);
              }
            }
          });
        }
      });
      
      if (idx < 3 && foundTools.size > 0) {
        console.log(`🔧 Conversation ${idx} tools found:`, Array.from(foundTools));
      }
      
      return hasContactTool;
    });
    
    console.log(`📊 Kontaktquote Result: ${conversationsWithContactTools.length}/${fetchedConversations.length} conversations with contact tools`);
    
    const conversationsWithTravelAgentTools = fetchedConversations.filter(conversation => {
      const workflows = extractWorkflowsFromConversation(conversation);
      return workflows.has('workflow-travel-agent');
    });
    
    const kontaktquote = fetchedConversations.length > 0 
      ? Math.round((conversationsWithContactTools.length / fetchedConversations.length) * 10000) / 100
      : 0;
      
    const travelAgentQuote = fetchedConversations.length > 0 
      ? Math.round((conversationsWithTravelAgentTools.length / fetchedConversations.length) * 10000) / 100
      : 0;
      
    // Only log detailed info if we have data
    if (fetchedConversations.length > 0) {
      console.log(`📊 Kontaktquote (workflow-based): ${conversationsWithContactTools.length}/${fetchedConversations.length} (${kontaktquote}%)`);
      console.log(`🧳 Travel Agent Quote (workflow-based): ${conversationsWithTravelAgentTools.length}/${fetchedConversations.length} (${travelAgentQuote}%)`);
      
      // Debug: Check message structure
      const sampleConv = fetchedConversations[0];
      if (sampleConv && sampleConv.messages && sampleConv.messages.length > 0) {
        console.log(`🔍 Sample message structure:`, {
          messageCount: sampleConv.messages.length,
          firstMessage: {
            role: sampleConv.messages[0].role,
            hasContent: !!sampleConv.messages[0].content,
            contentLength: sampleConv.messages[0].content?.length || 0,
            contentTypes: sampleConv.messages[0].content?.map((c: any) => c.kind) || [],
            fullContent: sampleConv.messages[0].content // Show full content structure
          }
        });
        
        // Show ACTUAL content objects - not just references
        console.log(`📋 ACTUAL Content Objects:`, sampleConv.messages.slice(0, 3).map((msg: any, idx: number) => ({
          messageIndex: idx,
          role: msg.role,
          contentCount: msg.content?.length || 0,
          contentObjects: msg.content?.map((c: any, cidx: number) => ({
            contentIndex: cidx,
            // Show ALL properties of each content object
            ...c,
            // Also show what keys are available
            availableKeys: Object.keys(c || {})
          })) || []
        })));
        
        // Look specifically for text content
        console.log(`📝 Text Content Search:`, sampleConv.messages.slice(0, 5).map((msg: any, idx: number) => ({
          messageIndex: idx,
          role: msg.role,
          textFound: msg.content?.map((c: any) => ({
            text: c.text,
            value: c.value,
            content: c.content,
            body: c.body,
            message: c.message,
            allKeys: Object.keys(c || {})
          })) || []
        })));
        
        // Look for any tool_use in first few messages
        const toolUseMessages = sampleConv.messages.slice(0, 5).filter((msg: any) => 
          msg.content?.some((c: any) => c.kind === 'tool_use')
        );
        if (toolUseMessages.length > 0) {
          console.log(`🛠️ Found tool_use messages:`, toolUseMessages.map((msg: any) => ({
            role: msg.role,
            tools: msg.content.filter((c: any) => c.kind === 'tool_use').map((c: any) => c.tool_name)
          })));
        } else {
          console.log(`❌ No tool_use found in first 5 messages of sample conversation`);
        }
      }
    }

    return {
      totalConversations,
      totalThreads,
      avgConversationsPerDay,
      peakDay,
      activeDays: conversationsPerDay.length,
      totalUserMessages,
      totalAssistantMessages,
      avgMessagesPerConversation,
      avgDurationMinutes,
      avgTimeToFirstResponseSeconds,
      fetchedConversationsCount: fetchedConversations.length,
      conversationsWithErrors: conversationsWithErrors.length,
      errorPercentage,
      kontaktquote,
      conversationsWithContactTools: conversationsWithContactTools.length,
      travelAgentQuote,
      conversationsWithTravelAgentTools: conversationsWithTravelAgentTools.length
    };
  }, [filteredThreads, allConversations, conversationsPerDay, conversationMetrics, fetchedConversations.length]);

  // Calculate tool statistics with timing analysis
  const toolStats = useMemo(() => {
    // Create combined dataset like ThreadsOverview does
    // ThreadsOverview uses: uploaded threads + fetched threads from API
    // We need to combine: threads (uploaded) + convert fetchedConversations to thread format
    const combinedThreads = [...threads];
    
    // Convert fetchedConversations to thread format to match ThreadsOverview logic
    const threadsFromFetched = fetchedConversations.map(conv => ({
      id: conv.id,
      conversationId: conv.id,
      messages: conv.messages || [],
      createdAt: conv.created_at || conv.createdAt,
      updatedAt: conv.updated_at || conv.updatedAt
    }));
    
    combinedThreads.push(...threadsFromFetched);

    // Normalizer available before any mapping logic
    function normalizeTool(raw: string): string | null {
      if (!raw) return null;
      let name = String(raw).trim();
      name = name.replace(/^['"`(\s]+|[)\s'"`.:;,]+$/g, '');
      name = name.replace(/`/g, '');
      name = name.replace(/\s+/g, '-');
      name = name.replace(/[^A-Za-z0-9._-]/g, '-');
      name = name.replace(/-{2,}/g, '-');
      if (!name || name.length < 2) return null;
      if (!/[A-Za-z0-9]/.test(name)) return null;
      return name;
    }

    // Pre-scan: Build ToolCallID -> ToolName map from status/assistant texts
    const toolCallIdToName = new Map<string, string>();
    const mapToolId = (id: string | null | undefined, name: string | null | undefined) => {
      const normName = normalizeTool(name || '') || null;
      if (id && normName) toolCallIdToName.set(id, normName);
    };
    const idNamePatterns: RegExp[] = [
      /\*\*Tool Name:\*\*\s*`([^`]+)`[\s\S]*?\*\*Tool Call ID:\*\*\s*`([^`]+)`/gi,
      /\*\*Tool Call ID:\*\*\s*`([^`]+)`[\s\S]*?\*\*Tool Name:\*\*\s*`([^`]+)`/gi,
      /Tool\s*Call\s*(?:Initiated|Completed)[^`]*`([^`]+)`[\s\S]*?(?:ID|Id|id)[:\s]*`([^`]+)`/gi,
      /Tool\s*Call\s*(?:Initiated|Completed)[^)]*\(([^)]+)\)[\s\S]*?(?:ID|Id|id)[:\s]*`([^`]+)`/gi
    ];
    combinedThreads.forEach(t => {
      (t.messages || []).forEach((m: any) => {
        (m.content || []).forEach((c: any) => {
          const text = (c?.text || c?.content || '').toString();
          if (!text) return;
          for (let r = 0; r < idNamePatterns.length; r++) {
            const re = idNamePatterns[r];
            const matches = Array.from(text.matchAll(re));
            for (let k = 0; k < matches.length; k++) {
              const a = matches[k][1];
              const b = matches[k][2];
              // Patterns may be (name,id) or (id,name); try both
              if (r === 0 || r === 2 || r === 3) {
                mapToolId(b, a);
              } else {
                mapToolId(a, b);
              }
            }
          }
        });
      });
    });
    
    const toolAnalysis: { [toolName: string]: { count: number; responseTimes: number[] } } = {};
    let totalToolCalls = 0;

    // Use combined threads data (same approach as ThreadsOverview)
    if (combinedThreads.length === 0) {
      console.log('🔧 No threads found for tool analysis');
      return {
        totalToolCalls: 0,
        uniqueTools: 0,
        avgResponseTime: 0,
        mostUsedTool: '',
        toolDetails: []
      };
    }

    console.log('🔧 Tool analysis starting with combined threads data:', {
      combinedThreadsCount: combinedThreads.length,
      sampleThread: combinedThreads[0]
    });

    // Analyze each thread for tool usage and timing (same as ThreadsOverview logic)
    combinedThreads.forEach((thread, threadIndex) => {
      const messages = thread.messages || [];
      
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          
          // Look for tool calls in system/status messages
          if ((message.role === 'system' || message.role === 'status') && message.content) {
            // Debug: Log status/system message content
            if (threadIndex < 3 && message.role === 'status') {
              console.log(`🔧 Status message ${i} content:`, message.content);
            }
            
          message.content.forEach((content: any, contentIndex: number) => {
            // Check if it's a tool_call object
            if (content.kind === 'tool_call' && content.tool_name) {
              const normalizedName = normalizeTool(content.tool_name);
              const toolName = normalizedName || content.tool_name;
              console.log(`🔧 Found tool call (object): ${toolName}`);
              totalToolCalls++;
              
              if (!toolAnalysis[toolName]) {
                toolAnalysis[toolName] = { count: 0, responseTimes: [] };
              }
              toolAnalysis[toolName].count++;
              
              // Calculate response time
              const toolCallTime = new Date(message.created_at || message.createdAt || message.sentAt).getTime();
              
              for (let j = i + 1; j < messages.length; j++) {
                const nextMessage = messages[j];
                if (nextMessage.role === 'assistant') {
                  const responseTime = new Date(nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt).getTime();
                  const timeDiff = (responseTime - toolCallTime) / 1000;
                  
                  if (timeDiff > 0 && timeDiff < 300) {
                    toolAnalysis[toolName].responseTimes.push(timeDiff);
                    console.log(`🔧 Tool ${toolName} response time: ${timeDiff}s`);
                  }
                  break;
                }
              }
            }
            // Check if it's text content that contains tool call information
            else if (content.kind === 'text' && content.content) {
              const textContent = content.content;
              
              // Debug: Log more detailed content to understand the format
              if (threadIndex < 5 && contentIndex === 0) {
                console.log(`🔧 Sample text content (thread ${threadIndex}):`, textContent);
                console.log(`🔧 Looking for patterns:`, {
                  hasToolName: textContent.includes('**Tool Name:**'),
                  hasToolCallId: textContent.includes('**Tool Call ID:**'),
                  hasFunction: textContent.includes('function'),
                  hasTool: textContent.includes('tool'),
                  contentLength: textContent.length,
                  firstLines: textContent.split('\n').slice(0, 5)
                });
              }
              
              // Use the same pattern as ThreadsOverview: "**Tool Name:**" pattern
              const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
              const matches = textContent.matchAll(toolNamePattern);
              
              let foundToolName = false;
              for (const match of matches) {
                const toolName = match[1];
                if (toolName && toolName.length > 1) {
                  console.log(`🔧 Found tool: ${toolName} (from Tool Name pattern)`);
                  totalToolCalls++;
                  foundToolName = true;
                  
                  const normalizedName = normalizeTool(toolName) || toolName;
                  if (!toolAnalysis[normalizedName]) {
                    toolAnalysis[normalizedName] = { count: 0, responseTimes: [] };
                  }
                  toolAnalysis[normalizedName].count++;
                  
                  // Calculate response time
                  const toolCallTime = new Date(message.created_at || message.createdAt || message.sentAt).getTime();
                  
                  for (let j = i + 1; j < messages.length; j++) {
                    const nextMessage = messages[j];
                    if (nextMessage.role === 'assistant') {
                      const responseTime = new Date(nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt).getTime();
                      const timeDiff = (responseTime - toolCallTime) / 1000;
                      
                      if (timeDiff > 0) {
                        toolAnalysis[normalizedName].responseTimes.push(timeDiff);
                        console.log(`🔧 Tool ${toolName} response time: ${timeDiff}s`);
                      }
                      break;
                    }
                  }
                }
              }
              
              // Try alternative patterns if Tool Name pattern didn't work
              if (!foundToolName) {
                // 1) Text-based initiated/completed patterns
                const initiatedPatterns = [
                  /Tool\s*Call\s*(?:Initiated|Completed)[^`\w]*`([^`]+)`/gi,
                  /Tool\s*Call\s*(?:Initiated|Completed)[^A-Za-z0-9_-]*\(([^)]+)\)/gi,
                  /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                  /Calling\s+tool[:\s]*`([^`]+)`/gi,
                  /Using\s+tool[:\s]*`([^`]+)`/gi
                ];
                for (let p = 0; p < initiatedPatterns.length && !foundToolName; p++) {
                  const pat = initiatedPatterns[p];
                  const matches = Array.from(textContent.matchAll(pat));
                  for (let m = 0; m < matches.length; m++) {
                    const toolName = matches[m][1];
                    if (toolName && toolName.length > 1) {
                      totalToolCalls++;
                      foundToolName = true;
                      const normalizedName = normalizeTool(toolName) || toolName;
                      if (!toolAnalysis[normalizedName]) {
                        toolAnalysis[normalizedName] = { count: 0, responseTimes: [] };
                      }
                      toolAnalysis[normalizedName].count++;
                      const toolCallTime = new Date(message.created_at || message.createdAt || message.sentAt).getTime();
                      for (let j = i + 1; j < messages.length; j++) {
                        const nextMessage = messages[j];
                        if (nextMessage.role === 'assistant') {
                          const responseTime = new Date(nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt).getTime();
                          const timeDiff = (responseTime - toolCallTime) / 1000;
                          if (timeDiff > 0 && timeDiff < 300) {
                            toolAnalysis[normalizedName].responseTimes.push(timeDiff);
                          }
                          break;
                        }
                      }
                      break;
                    }
                  }
                }

                // 2) Safer JSON-ish blocks: ensure name is within tool_use/tool_call/function_call
                if (!foundToolName) {
                  const patternList = [
                    /"tool_use"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/gi,
                    /"tool_call"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/gi,
                    /"function_call"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/gi
                  ];
                  for (let p = 0; p < patternList.length && !foundToolName; p++) {
                    const pat = patternList[p];
                    const matches = Array.from(textContent.matchAll(pat));
                    for (let m = 0; m < matches.length; m++) {
                      const toolName = matches[m][1];
                      if (toolName && toolName.length > 1) {
                        totalToolCalls++;
                        foundToolName = true;
                        const normalizedName = normalizeTool(toolName) || toolName;
                        if (!toolAnalysis[normalizedName]) {
                          toolAnalysis[normalizedName] = { count: 0, responseTimes: [] };
                        }
                        toolAnalysis[normalizedName].count++;
                        const toolCallTime = new Date(message.created_at || message.createdAt || message.sentAt).getTime();
                        for (let j = i + 1; j < messages.length; j++) {
                          const nextMessage = messages[j];
                          if (nextMessage.role === 'assistant') {
                            const responseTime = new Date(nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt).getTime();
                            const timeDiff = (responseTime - toolCallTime) / 1000;
                            if (timeDiff > 0 && timeDiff < 300) {
                              toolAnalysis[normalizedName].responseTimes.push(timeDiff);
                            }
                            break;
                          }
                        }
                        break;
                      }
                    }
                  }
                }
              }
              
              // Fallback: If no Tool Name pattern found, look for Tool Call ID as backup
              if (!foundToolName && textContent.includes('**Tool Call ID:**')) {
                const idMatches = Array.from(textContent.matchAll(/\*\*Tool Call ID:\*\*\s*`([^`]+)`/gi));
                if (idMatches.length > 0) {
                  for (let idx = 0; idx < idMatches.length; idx++) {
                    const callId = idMatches[idx][1];
                    const mappedName = toolCallIdToName.get(callId);
                    // If we cannot resolve the ID to a tool name anywhere, skip adding an unknown bucket
                    if (!mappedName) {
                      continue;
                    }
                    totalToolCalls++;
                    if (!toolAnalysis[mappedName]) {
                      toolAnalysis[mappedName] = { count: 0, responseTimes: [] };
                    }
                    toolAnalysis[mappedName].count++;
                    const toolCallTime = new Date(message.created_at || message.createdAt || message.sentAt).getTime();
                    for (let j = i + 1; j < messages.length; j++) {
                      const nextMessage = messages[j];
                      if (nextMessage.role === 'assistant') {
                        const responseTime = new Date(nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt).getTime();
                        const timeDiff = (responseTime - toolCallTime) / 1000;
                        if (timeDiff > 0 && timeDiff < 300) {
                          toolAnalysis[mappedName].responseTimes.push(timeDiff);
                          console.log(`🔧 Tool ${mappedName} response time: ${timeDiff}s`);
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }
          });
        }
      }
    });

    console.log('🔧 Tool analysis complete:', {
      totalToolCalls,
      uniqueToolsFound: Object.keys(toolAnalysis).length,
      toolsFound: Object.keys(toolAnalysis),
      detailedAnalysis: toolAnalysis,
      sampleToolDetails: Object.entries(toolAnalysis).slice(0, 3).map(([name, data]) => ({
        name,
        count: data.count,
        responseTimes: data.responseTimes.length,
        avgTime: data.responseTimes.length > 0 
          ? Math.round(data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length)
          : 0
      }))
    });

    // Calculate averages and variability metrics with proper statistical analysis
    const toolDetails = Object.entries(toolAnalysis).map(([toolName, data]) => {
      const times = data.responseTimes;
      const count = data.count;
      
      if (times.length === 0) {
        return {
          name: toolName,
          count,
          avgResponseTime: 0,
          responseTimes: times,
          stdDev: 0,
          coefficientOfVariation: 0,
          range: 0,
          minTime: 0,
          maxTime: 0,
          confidenceInterval: null,
          outliers: [],
          significance: { level: 'no-data', icon: '❓', color: '#9ca3af', confidence: 0, interpretation: 'No timing data available' }
        };
      }
      
      const n = times.length;
      
      // Calculate average
      const avg = times.reduce((sum, time) => sum + time, 0) / n;
      
      // Use sample standard deviation (n-1) for better statistical accuracy
      const sampleVariance = n > 1 
        ? times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / (n - 1)
        : times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / n;
      const stdDev = Math.sqrt(sampleVariance);
      
      // Calculate coefficient of variation (CV) - the key metric for relative variability
      const coefficientOfVariation = avg > 0 ? (stdDev / avg) * 100 : 0;
      
      // Calculate 95% confidence interval for the mean
      const getTValue = (df) => {
        // Simplified t-distribution critical values for 95% confidence
        const tTable = {
          1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
          6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
          15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042
        };
        if (df <= 30) return tTable[df] || tTable[Math.floor(df)] || 2.042;
        return 1.96; // For large samples
      };
      
      const tValue = getTValue(n - 1);
      const marginOfError = n > 1 ? tValue * (stdDev / Math.sqrt(n)) : 0;
      const confidenceInterval = n > 1 ? {
        lower: avg - marginOfError,
        upper: avg + marginOfError,
        margin: marginOfError
      } : null;
      
      // Detect outliers using IQR method
      const getPercentile = (sortedArray, percentile) => {
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
      };
      
      const sortedTimes = [...times].sort((a, b) => a - b);
      const q1 = getPercentile(sortedTimes, 25);
      const q3 = getPercentile(sortedTimes, 75);
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      const outliers = times.filter(time => time < lowerBound || time > upperBound);
      
      // Calculate range and min/max
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const range = maxTime - minTime;
      
      // Statistically correct significance assessment based on CV and sample size
      const getStatisticalSignificance = (sampleCount, cv) => {
        if (sampleCount < 3) {
          return { 
            level: 'insufficient', 
            icon: '❓', 
            color: '#9ca3af', 
            confidence: 0,
            interpretation: 'Too few samples for reliable analysis',
            cvCategory: 'unknown'
          };
        }
        
        // Categorize variability based on coefficient of variation
        let cvCategory, baseConfidence, variabilityLevel;
        
        if (cv < 10) {
          cvCategory = 'very-low';
          variabilityLevel = 'Very Consistent';
          baseConfidence = 0.90;
        } else if (cv < 25) {
          cvCategory = 'low';
          variabilityLevel = 'Consistent';
          baseConfidence = 0.85;
        } else if (cv < 50) {
          cvCategory = 'moderate';
          variabilityLevel = 'Somewhat Variable';
          baseConfidence = 0.75;
        } else if (cv < 100) {
          cvCategory = 'high';
          variabilityLevel = 'Highly Variable';
          baseConfidence = 0.65;
        } else {
          cvCategory = 'very-high';
          variabilityLevel = 'Extremely Variable';
          baseConfidence = 0.55;
        }
        
        // Adjust confidence based on sample size
        let confidence = baseConfidence;
        if (sampleCount >= 30) confidence = Math.min(confidence + 0.15, 0.99);
        else if (sampleCount >= 20) confidence = Math.min(confidence + 0.10, 0.95);
        else if (sampleCount >= 10) confidence = Math.min(confidence + 0.05, 0.90);
        else if (sampleCount < 5) confidence = Math.max(confidence - 0.15, 0.40);
        
        const icons = {
          'very-low': '✅',
          'low': '✅', 
          'moderate': '⚡',
          'high': '⚠️',
          'very-high': '🔴'
        };
        
        const colors = {
          'very-low': '#10b981',
          'low': '#10b981',
          'moderate': '#3b82f6', 
          'high': '#f59e0b',
          'very-high': '#ef4444'
        };
        
        return {
          level: cvCategory,
          cvCategory,
          variabilityLevel,
          cv: Math.round(cv * 10) / 10,
          confidence: Math.round(confidence * 100),
          icon: icons[cvCategory],
          color: colors[cvCategory],
          interpretation: `${variabilityLevel} (CV=${cv.toFixed(1)}%)`
        };
      };
      
      const significance = getStatisticalSignificance(times.length, coefficientOfVariation);
      
      return {
        name: toolName,
        count,
        avgResponseTime: Math.round(avg * 100) / 100,
        responseTimes: times,
        stdDev: Math.round(stdDev * 100) / 100,
        coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
        range: Math.round(range * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        confidenceInterval,
        outliers,
        significance,
        quartiles: n >= 4 ? {
          q1: Math.round(q1 * 100) / 100,
          median: Math.round(getPercentile(sortedTimes, 50) * 100) / 100,
          q3: Math.round(q3 * 100) / 100,
          iqr: Math.round(iqr * 100) / 100
        } : null
      };
    }).sort((a, b) => b.count - a.count);

    const overallAvgResponseTime = toolDetails.length > 0
      ? Math.round(toolDetails.reduce((sum, tool) => sum + (tool.avgResponseTime * tool.count), 0) / totalToolCalls)
      : 0;

    return {
      totalToolCalls,
      uniqueTools: Object.keys(toolAnalysis).length,
      avgResponseTime: overallAvgResponseTime,
      mostUsedTool: toolDetails.length > 0 ? toolDetails[0].name : '',
      toolDetails
    };
  }, [threads, fetchedConversations]);

  // Calculate workflow statistics - similar to tool stats but for workflows
  const workflowStats = useMemo(() => {
    // Create combined dataset like we do for tools
    const combinedThreads = [...threads];
    
    // Convert fetchedConversations to thread format
    const threadsFromFetched = fetchedConversations.map(conv => ({
      id: conv.id,
      conversationId: conv.id,
      messages: conv.messages || [],
      createdAt: conv.created_at || conv.createdAt,
      updatedAt: conv.updated_at || conv.updatedAt
    }));
    
    combinedThreads.push(...threadsFromFetched);
    
    const workflowThreadCounts = new Map<string, Set<string>>(); // Map workflow name to set of thread IDs
    
    // Extract workflows from threads using the same logic as ThreadsOverview
    combinedThreads.forEach(thread => {
      const threadWorkflows = new Set<string>(); // Workflows found in this specific thread
      
      thread.messages.forEach(message => {
        // Look for workflows in system/status messages
        if (message.role === 'system' || message.role === 'status') {
          message.content.forEach(content => {
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
                    const workflows = workflowsString.split(',').map(w => w.trim()).filter(w => w.length > 0);
                    workflows.forEach(workflowName => {
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
      threadWorkflows.forEach(workflowName => {
        if (!workflowThreadCounts.has(workflowName)) {
          workflowThreadCounts.set(workflowName, new Set());
        }
        workflowThreadCounts.get(workflowName)!.add(thread.id);
      });
    });

    // Convert to array and sort by count (descending)
    const workflowDetails = Array.from(workflowThreadCounts.entries())
      .map(([name, threadSet]) => ({ name, count: threadSet.size }))
      .sort((a, b) => b.count - a.count);
    
    const totalWorkflowUsage = workflowDetails.reduce((sum, workflow) => sum + workflow.count, 0);
    const mostUsedWorkflow = workflowDetails.length > 0 ? workflowDetails[0].name : '';

    return {
      totalWorkflowUsage,
      uniqueWorkflows: workflowDetails.length,
      mostUsedWorkflow,
      workflowDetails
    };
  }, [threads, fetchedConversations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
            <p className="text-gray-600">Analytics and insights from your conversation data</p>
          </div>
        </div>
      </div>

      {/* Time Range Selection */}
      <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg text-gray-900">Time Range Filter</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
                {/* Date inputs row - compact */}
                <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-[200px]">
                    <Label htmlFor="start-date" className="text-xs font-medium text-gray-600">Start Date</Label>
                    <Input
                    id="start-date"
                    type="date"
                    key={`start-${startDate?.getTime()}`}
                    value={startDate ? 
                      `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}` 
                      : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const date = new Date(e.target.value + 'T00:00:00');
                        console.log('Start date input changed to:', date);
                        setStartDate(date);
                      } else {
                        setStartDate(null);
                      }
                    }}
                    className="text-sm h-8"
                    />
                </div>
                <div className="flex-1 max-w-[200px]">
                    <Label htmlFor="end-date" className="text-xs font-medium text-gray-600">End Date</Label>
                    <Input
                    id="end-date"
                    type="date"
                    key={`end-${endDate?.getTime()}`}
                    value={endDate ? 
                      `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}` 
                      : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const date = new Date(e.target.value + 'T23:59:59');
                        console.log('End date input changed to:', date);
                        setEndDate(date);
                      } else {
                        setEndDate(null);
                      }
                    }}
                    className="text-sm h-8"
                    />
                </div>
                </div>
                
                {/* Buttons row */}
                <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  console.log('Today button clicked. Current date:', now);
                  
                  // Create start of today
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  console.log('Start of today:', today);
                  
                  // Current time
                  const currentTime = new Date();
                  console.log('Current time:', currentTime);
                  
                  // Debug the date formatting
                  const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const currentFormatted = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
                  console.log('Today formatted for input:', todayFormatted);
                  console.log('Current formatted for input:', currentFormatted);
                  
                  setStartDate(today);
                  setEndDate(currentTime);
                }}
                className="text-xs h-8"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  console.log('Last 24 Hours button clicked. Current date:', now);
                  
                  // Create start of yesterday
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  yesterday.setHours(0, 0, 0, 0);
                  console.log('Start of yesterday:', yesterday);
                  
                  // Current time
                  const currentTime = new Date();
                  console.log('Current time:', currentTime);
                  
                  setStartDate(yesterday);
                  setEndDate(currentTime);
                }}
                className="text-xs h-8"
              >
                Last 24 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() - 7);
                  setStartDate(date);
                  setEndDate(new Date());
                }}
                className="whitespace-nowrap"
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() - 30);
                  setStartDate(date);
                  setEndDate(new Date());
                }}
                className="whitespace-nowrap"
              >
                Last 30 Days
              </Button>
              
              {/* ANALYZE BUTTON - Blue and clean */}
              <button
                onClick={fetchConversationsForStats}
                disabled={isLoading || !startDate || !endDate}
                style={{
                  backgroundColor: isLoading || !startDate || !endDate ? '#9CA3AF' : '#3B82F6',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '500',
                  fontSize: '14px',
                  cursor: isLoading || !startDate || !endDate ? 'not-allowed' : 'pointer',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center'
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    📊
                    Analyze Data
                  </>
                )}
              </button>
              
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-sm font-medium">Error:</span>
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats - Consolidated */}
      {(stats.totalConversations > 0 || stats.fetchedConversationsCount > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            📊 Analysis Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.fetchedConversationsCount.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Conversations Found</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.avgConversationsPerDay}</p>
              <p className="text-sm text-gray-600">Avg. per Day</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.peakDay.conversations}</p>
              <p className="text-sm text-gray-600">Peak Day</p>
              <p className="text-xs text-gray-500">{stats.peakDay.formattedDate}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.activeDays}</p>
              <p className="text-sm text-gray-600">Active Days</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Metrics - Consolidated */}
      {stats.fetchedConversationsCount > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            💬 Message Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.totalUserMessages.toLocaleString()}</p>
              <p className="text-sm text-gray-600">User Messages</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.totalAssistantMessages.toLocaleString()}</p>
              <p className="text-sm text-gray-600">AI Responses</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.avgMessagesPerConversation}</p>
              <p className="text-sm text-gray-600">Avg. User Messages</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{stats.conversationsWithErrors} ({stats.errorPercentage}%)</p>
              <p className="text-sm text-gray-600">Conversations with Errors</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.avgTimeToFirstResponseSeconds}s</p>
              <p className="text-sm text-gray-600">Avg. Response Time to First Message</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.kontaktquote}%</p>
              <p className="text-sm text-gray-600">Kontaktquote</p>
              <p className="text-xs text-gray-500">{stats.conversationsWithContactTools} chats</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.travelAgentQuote}%</p>
              <p className="text-sm text-gray-600">Travel Agent Quote</p>
              <p className="text-xs text-gray-500">{stats.conversationsWithTravelAgentTools} chats</p>
            </div>
          </div>
        </div>
      )}

      {/* Tool & Workflow Details Section */}
      {stats.fetchedConversationsCount > 0 && (
        <Card className="shadow-lg border-2 border-green-100">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900">🔧 Tool & Workflow Analysis</CardTitle>
                  <CardDescription className="text-gray-600">
                    Individual tool usage, response times, and workflow patterns
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowWorkflowDetails(true)}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: '1px solid #7c3aed',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#6d28d9';
                    e.currentTarget.style.borderColor = '#6d28d9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#7c3aed';
                    e.currentTarget.style.borderColor = '#7c3aed';
                  }}
                >
                  🔄 View Workflow Details
                </button>
                <button
                onClick={() => {
                  console.log('🔧 BUTTON CLICKED - Debug info:', {
                    allConversationsLength: allConversations.length,
                    fetchedConversationsLength: fetchedConversations.length,
                    uploadedConversationsLength: uploadedConversations.length,
                    threadsLength: threads.length,
                    toolStatsExists: !!toolStats,
                    toolStatsValue: toolStats,
                    sampleConversation: allConversations[0],
                    sampleMessages: allConversations[0]?.messages?.slice(0, 3)
                  });
                  
                  // Check what tools ThreadsOverview would find for comparison
                  console.log('🔧 Comparing with ThreadsOverview tool detection...');
                  const threadsOverviewTools = new Set();
                  allConversations.forEach(conv => {
                    conv.messages?.forEach(msg => {
                      if ((msg.role === 'system' || msg.role === 'status') && msg.content) {
                        msg.content.forEach(content => {
                          if (content.text || content.content) {
                            const text = content.text || content.content || '';
                            const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
                            const matches = text.matchAll(toolNamePattern);
                            for (const match of matches) {
                              threadsOverviewTools.add(match[1]);
                            }
                          }
                        });
                      }
                    });
                  });
                  console.log('🔧 ThreadsOverview would find these tools:', Array.from(threadsOverviewTools));
                  
                  // Force recalculation by logging sample data
                  if (allConversations.length > 0) {
                    console.log('🔧 Sample conversation for debugging:', allConversations[0]);
                    if (allConversations[0]?.messages) {
                      console.log('🔧 Sample messages:', allConversations[0].messages.slice(0, 5));
                      allConversations[0].messages.slice(0, 5).forEach((msg, i) => {
                        console.log(`🔧 Message ${i} (${msg.role}):`, msg);
                        if (msg.content) {
                          console.log(`🔧 Message ${i} content:`, msg.content);
                          // Log each content item individually
                          msg.content.forEach((contentItem, j) => {
                            console.log(`🔧 Message ${i} content[${j}]:`, contentItem);
                            if (contentItem.kind) {
                              console.log(`🔧 Message ${i} content[${j}] kind:`, contentItem.kind);
                            }
                            if (contentItem.content || contentItem.text) {
                              console.log(`🔧 Message ${i} content[${j}] text:`, contentItem.content || contentItem.text);
                            }
                          });
                        }
                      });
                    }
                  }
                  
                  setShowToolDetails(true);
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: '1px solid #059669',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#047857';
                  e.currentTarget.style.borderColor = '#047857';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.borderColor = '#059669';
                }}
              >
                📊 View Tool Details
              </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-white">
            <div className="text-center py-4">
              <p className="text-gray-600 max-w-md mx-auto">
                Click "View Tool Details" to see individual tool usage patterns, response times, and detailed analytics for each tool used in your conversations. 
                Click "View Workflow Details" to see workflow usage patterns and statistics.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tool Details Modal - Simple Overlay */}
      {showToolDetails && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowToolDetails(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔧</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  Tool Analysis Results
                </h3>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  ({toolStats.toolDetails.length} tools)
                </span>
              </div>
              <button
                onClick={() => setShowToolDetails(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Summary */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>
                    {toolStats.totalToolCalls}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Calls</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7c3aed' }}>
                    {toolStats.avgResponseTime}s
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Avg Response Time</div>
                </div>
              </div>
              
            </div>
            
            {/* Scrollable Table */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {toolStats.toolDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>No Tools Found</h3>
                  <p style={{ margin: 0 }}>No tool calls were detected in the analyzed conversations.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        #
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Tool Name
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Count
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Average Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {toolStats.toolDetails.map((tool, index) => (
                      <tr 
                        key={tool.name} 
                        style={{ 
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                        }}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            fontSize: '12px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '50%',
                            fontWeight: '600'
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>
                            {tool.name}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '4px'
                          }}>
                            {tool.count}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '12px' }}>
                            {tool.confidenceInterval && tool.responseTimes.length > 1 ? (
                              <div>
                                <div style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  borderRadius: '4px',
                                  marginBottom: '2px'
                                }}>
                                  {tool.avgResponseTime}s
                                </div>
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#6b7280',
                                  marginTop: '2px'
                                }}>
                                  {(tool.avgResponseTime - tool.confidenceInterval.margin).toFixed(2)}s - {(tool.avgResponseTime + tool.confidenceInterval.margin).toFixed(2)}s
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '4px'
                              }}>
                                {tool.avgResponseTime > 0 ? `${tool.avgResponseTime}s` : 'N/A'}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Details Modal - Simple Overlay */}
      {showWorkflowDetails && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowWorkflowDetails(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f3e8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔄</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  Workflow Analysis Results
                </h3>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  ({workflowStats.workflowDetails.length} workflows)
                </span>
              </div>
              <button
                onClick={() => setShowWorkflowDetails(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Summary */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7c3aed' }}>
                    {workflowStats.totalWorkflowUsage}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Usage</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>
                    {workflowStats.uniqueWorkflows}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Unique Workflows</div>
                </div>
              </div>
              
            </div>
            
            {/* Scrollable Table */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {workflowStats.workflowDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>No Workflows Found</h3>
                  <p style={{ margin: 0 }}>No workflows were detected in the analyzed conversations.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        #
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Workflow Name
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Usage Count
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflowStats.workflowDetails.map((workflow, index) => (
                      <tr 
                        key={workflow.name} 
                        style={{ 
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                        }}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            fontSize: '12px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            borderRadius: '50%',
                            fontWeight: '600'
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>
                            {workflow.name}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            borderRadius: '4px'
                          }}>
                            {workflow.count}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '4px'
                          }}>
                            {workflowStats.totalWorkflowUsage > 0 
                              ? Math.round((workflow.count / workflowStats.totalWorkflowUsage) * 100)
                              : 0
                            }%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Info - Show data status */}
      {isLoading && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="space-y-3">
            <p className="text-blue-700 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyzing data...
            </p>
            
            {loadingProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Processing chunk {loadingProgress.current} of {loadingProgress.total}</span>
                  <span>{Math.round((loadingProgress.current / loadingProgress.total) * 100)}%</span>
                </div>
                
                {loadingProgress.currentDate && (
                  <p className="text-sm text-blue-600">📅 Current: {loadingProgress.currentDate}</p>
                )}
                
                {/* Progress Bar */}
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-blue-600">
                  Processing data with smart chunking to avoid timeouts...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoading && stats.fetchedConversationsCount === 0 && (
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <p className="text-yellow-700">
            📊 No data to analyze yet. Select dates and click "Analyze Data" to see statistics and graphs.
          </p>
        </div>
      )}


      {/* Conversations per Day Chart - Enhanced */}
      {stats.fetchedConversationsCount > 0 && conversationsPerDay.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-gray-900">Daily Conversation Volume</CardTitle>
                <CardDescription className="text-gray-600">
                  Conversation activity over time • {stats.activeDays} active days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={500}>
              <AreaChart data={conversationsPerDay} margin={{ top: 40, right: 30, left: 40, bottom: 5 }}>
                <defs>
                  <linearGradient id="conversationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => {
                    // Calculate a logical maximum in steps of 250
                    const step = 250;
                    return Math.max(step, Math.ceil(dataMax / step) * step);
                  }]}
                  ticks={(() => {
                    const maxValue = Math.max(...conversationsPerDay.map(d => d.conversations), 250);
                    const step = 250;
                    const max = Math.ceil(maxValue / step) * step;
                    const ticks = [];
                    for (let i = 0; i <= max; i += step) {
                      ticks.push(i);
                    }
                    return ticks;
                  })()}
                />
                <Tooltip 
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value: number) => [
                    `${value} conversation${value !== 1 ? 's' : ''}`, 
                    'Daily Volume'
                  ]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="conversations" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fill="url(#conversationGradient)"
                  dot={{ 
                    fill: '#3b82f6', 
                    strokeWidth: 2, 
                    stroke: '#ffffff',
                    r: 4
                  }}
                  activeDot={{ 
                    r: 6, 
                    fill: '#1d4ed8',
                    stroke: '#ffffff',
                    strokeWidth: 2
                  }}
                >
                  <LabelList 
                    dataKey="conversations" 
                    position="top" 
                    fontSize={12}
                    fill="#374151"
                    offset={15}
                    fontWeight="600"
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {conversationsPerDay.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              Load some conversation data to see statistics and analytics.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
