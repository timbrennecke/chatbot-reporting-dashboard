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
  AreaChart
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
  Clock,
  Download
} from 'lucide-react';
import { Thread } from '../lib/types';
import { getApiBaseUrl, getEnvironmentSpecificItem } from '../lib/api';

interface StatisticsProps {
  threads: Thread[];
  uploadedConversations?: any[];
}

export function Statistics({ threads, uploadedConversations = [] }: StatisticsProps) {
  
  // Time range state with localStorage persistence
  const [startDate, setStartDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-start-date');
      if (saved) return new Date(saved);
    } catch (error) {
      console.warn('Failed to load saved stats start date:', error);
    }
    // Default to 1 hour ago
    const date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-end-date');
      if (saved) return new Date(saved);
    } catch (error) {
      console.warn('Failed to load saved stats end date:', error);
    }
    // Default to current time
    return new Date();
  });

  // Fetching state
  const [fetchedConversations, setFetchedConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchKey, setLastSearchKey] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, currentDate: '' });

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
      const apiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key');
      if (!apiKey?.trim()) {
        throw new Error('API key is required');
      }

      const apiBaseUrl = getApiBaseUrl();
      
      // Calculate time difference - always use daily chunking for reliability
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      let allConversations: any[] = [];
      
      // Always use daily chunking to avoid timeouts
      console.log(`📊 Processing ${daysDiff} days with daily chunking to avoid timeouts...`);
      
      const chunks: Array<{start: Date, end: Date, dateStr: string}> = [];
      
      // Create daily chunks
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        let nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // Don't go past the end date
        if (nextDate > endDate) {
          nextDate = new Date(endDate);
        }
        
        chunks.push({
          start: new Date(currentDate),
          end: new Date(nextDate),
          dateStr: currentDate.toLocaleDateString()
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📦 Processing ${chunks.length} daily chunks`);
      setLoadingProgress({ current: 0, total: chunks.length, currentDate: '' });
      
      // Process chunks with progress tracking
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setLoadingProgress({ current: i + 1, total: chunks.length, currentDate: chunk.dateStr });
        
        console.log(`📅 Day ${i + 1}/${chunks.length}: ${chunk.dateStr}`);
        
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
            console.warn(`⚠️ Day ${i + 1} (${chunk.dateStr}) failed: HTTP ${response.status}`);
            continue; // Skip failed days but continue with others
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
          
          allConversations.push(...chunkConversations);
          console.log(`✅ Day ${i + 1}/${chunks.length} (${chunk.dateStr}): +${chunkConversations.length} conversations (total: ${allConversations.length})`);
          
          // Small delay to be nice to the server
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          console.warn(`⚠️ Day ${i + 1} (${chunk.dateStr}) error:`, chunkError);
          // Continue with other days
        }
      }
      
      console.log(`🎉 Daily processing complete: ${allConversations.length} total conversations from ${chunks.length} days`);
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

    // Conversation metrics aggregation
    const totalUserMessages = conversationMetrics.reduce((sum, conv) => sum + (conv?.userMessages || 0), 0);
    const totalAssistantMessages = conversationMetrics.reduce((sum, conv) => sum + (conv?.assistantMessages || 0), 0);
    const avgMessagesPerConversation = conversationMetrics.length > 0 
      ? Math.round(((totalUserMessages + totalAssistantMessages) / conversationMetrics.length) * 100) / 100
      : 0;
    const avgDurationMinutes = conversationMetrics.length > 0
      ? Math.round((conversationMetrics.reduce((sum, conv) => sum + (conv?.durationMinutes || 0), 0) / conversationMetrics.length) * 100) / 100
      : 0;
    
    const avgTimeToFirstResponseSeconds = conversationMetrics.length > 0
      ? Math.round((conversationMetrics.reduce((sum, conv) => sum + (conv?.timeToFirstResponseSeconds || 0), 0) / conversationMetrics.length) * 100) / 100
      : 0;

    // Calculate Kontaktquote (conversations with contact tools)
    // Base contact tool patterns (without prefixes)
    const baseContactTools = [
      'hotline-availability',
      'send-message-to-customer-service', 
      'show-enter-phone-number',
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
              if (message.role === 'system') {
                if (content.text || content.content) {
                  const text = content.text || content.content || '';
                  
                  // Look specifically for "**Tool Name:**" pattern in system messages
                  const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
                  const matches = text.matchAll(toolNamePattern);
                  
                  for (const match of matches) {
                    const toolName = match[1];
                    if (toolName && toolName.length > 1) {
                      allToolNames.add(toolName);
                    }
                  }
                }
              }
              
              // SECOND: Check for assistant message tool usage (SAME as ThreadsOverview)
              if (message.role === 'assistant' && content.tool_use) {
                const toolName = content.tool_use.name;
                if (toolName && toolName.length > 1) {
                  allToolNames.add(toolName);
                }
              }
              
              // THIRD: Check for other tool storage patterns
              if (content.kind === 'tool_use' && content.tool_name) {
                allToolNames.add(content.tool_name);
              }
              if (content.type === 'tool_use' && content.name) {
                allToolNames.add(content.name);
              }
              if (content.tool && content.tool.name) {
                allToolNames.add(content.tool.name);
              }
              if (content.function_call && content.function_call.name) {
                allToolNames.add(content.function_call.name);
              }
              
              // NEW: Check if tools are mentioned in the text content itself
              if (content.text && typeof content.text === 'string') {
                baseContactTools.forEach(tool => {
                  if (content.text.toLowerCase().includes(tool.toLowerCase()) ||
                      content.text.toLowerCase().includes(tool.replace(/-/g, '_').toLowerCase()) ||
                      content.text.toLowerCase().includes(tool.replace(/-/g, ' ').toLowerCase())) {
                    allToolNames.add(`text-mention:${tool}`);
                  }
                });
              }
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
    
    // SIMPLE APPROACH: If we found contact tools, check which conversations have them
    const conversationsWithContactTools = fetchedConversations.filter(conversation => {
      if (!conversation.messages) return false;
      
      // Check if ANY of the found contact tools appear in this conversation
      return foundContactTools.some(contactToolName => {
        return conversation.messages.some((message: any) => {
          if (!message.content) return false;
          
          return message.content.some((content: any) => {
            // Check system messages for tool definitions (most reliable)
            if (message.role === 'system' && (content.text || content.content)) {
              const text = content.text || content.content || '';
              if (text.includes(`\`${contactToolName}\``)) {
                contactToolsFound.add(contactToolName);
                return true;
              }
            }
            
            // Check assistant messages for tool usage
            if (message.role === 'assistant' && content.tool_use && content.tool_use.name === contactToolName) {
              contactToolsFound.add(contactToolName);
              return true;
            }
            
            return false;
          });
        });
      });
    });
    
    // SIMPLE APPROACH: If we found travel agent tools, check which conversations have them
    let travelAgentToolsFound = new Set<string>();
    const conversationsWithTravelAgentTools = fetchedConversations.filter(conversation => {
      if (!conversation.messages) return false;
      
      // Check if ANY of the found travel agent tools appear in this conversation
      return foundTravelAgentTools.some(travelAgentToolName => {
        return conversation.messages.some((message: any) => {
          if (!message.content) return false;
          
          return message.content.some((content: any) => {
            // Check system messages for tool definitions (most reliable)
            if (message.role === 'system' && (content.text || content.content)) {
              const text = content.text || content.content || '';
              if (text.includes(`\`${travelAgentToolName}\``)) {
                travelAgentToolsFound.add(travelAgentToolName);
                return true;
              }
            }
            
            // Check assistant messages for tool usage
            if (message.role === 'assistant' && content.tool_use && content.tool_use.name === travelAgentToolName) {
              travelAgentToolsFound.add(travelAgentToolName);
              return true;
            }
            
            return false;
          });
        });
      });
    });
    
    const kontaktquote = fetchedConversations.length > 0 
      ? Math.round((conversationsWithContactTools.length / fetchedConversations.length) * 10000) / 100
      : 0;
      
    const travelAgentQuote = fetchedConversations.length > 0 
      ? Math.round((conversationsWithTravelAgentTools.length / fetchedConversations.length) * 10000) / 100
      : 0;
      
    // Only log detailed info if we have data
    if (fetchedConversations.length > 0) {
      console.log(`📊 Kontaktquote: ${conversationsWithContactTools.length}/${fetchedConversations.length} (${kontaktquote}%)`);
      console.log(`🧳 Travel Agent Quote: ${conversationsWithTravelAgentTools.length}/${fetchedConversations.length} (${travelAgentQuote}%)`);
      
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
      kontaktquote,
      conversationsWithContactTools: conversationsWithContactTools.length,
      travelAgentQuote,
      conversationsWithTravelAgentTools: conversationsWithTravelAgentTools.length
    };
  }, [filteredThreads, allConversations, conversationsPerDay, conversationMetrics, fetchedConversations.length]);

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
                    type="datetime-local"
                    value={startDate?.toISOString().slice(0, 16) || ''}
                    onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                    className="text-sm h-8"
                    />
                </div>
                <div className="flex-1 max-w-[200px]">
                    <Label htmlFor="end-date" className="text-xs font-medium text-gray-600">End Date</Label>
                    <Input
                    id="end-date"
                    type="datetime-local"
                    value={endDate?.toISOString().slice(0, 16) || ''}
                    onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
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
              <p className="text-sm text-gray-600">Avg. Messages</p>
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
                  <span>Processing day {loadingProgress.current} of {loadingProgress.total}</span>
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

      {/* Debug: Show data loading status */}
      {!isLoading && stats.fetchedConversationsCount > 0 && (
        <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
          <p className="text-green-700">
            ✅ Data loaded: {stats.fetchedConversationsCount} conversations analyzed | 
            Chart data points: {conversationsPerDay.length} | 
            {conversationsPerDay.length > 0 ? 'Graph should appear below' : 'No daily data for chart'}
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
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={conversationsPerDay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    // Calculate a logical maximum in steps of 50
                    const step = 50;
                    return Math.max(step, Math.ceil(dataMax / step) * step);
                  }]}
                  ticks={(() => {
                    const maxValue = Math.max(...conversationsPerDay.map(d => d.conversations), 50);
                    const step = 50;
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
                />
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
