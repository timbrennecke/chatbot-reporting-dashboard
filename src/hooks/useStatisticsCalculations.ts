import { useMemo } from 'react';
import type { Thread } from '../lib/types';
import type { ConversationData, ConversationMetric } from '../utils/statisticsUtils';
import {
  calculateAllConversationMetrics,
  calculateConversationsPerDay,
  filterConversationsByDateRange,
  filterThreadsByDateRange,
} from '../utils/statisticsUtils';

interface ContactToolsData {
  kontaktquote: number;
  conversationsWithContactTools: { length: number };
}

interface TravelAgentToolsData {
  travelAgentQuote: number;
  conversationsWithTravelAgentTools: { length: number };
}

export function useStatisticsCalculations(
  threads: Thread[],
  uploadedConversations: ConversationData[],
  fetchedConversations: ConversationData[],
  startDate: Date | null,
  endDate: Date | null,
  contactTools?: ContactToolsData,
  travelAgentTools?: TravelAgentToolsData
) {
  // Filter data based on selected time range
  const filteredThreads = useMemo(
    () => filterThreadsByDateRange(threads, startDate, endDate),
    [threads, startDate, endDate]
  );

  const filteredUploadedConversations = useMemo(
    () => filterConversationsByDateRange(uploadedConversations, startDate, endDate),
    [uploadedConversations, startDate, endDate]
  );

  // All conversations including fetched ones
  const allConversations = useMemo(
    () => [...filteredUploadedConversations, ...fetchedConversations],
    [filteredUploadedConversations, fetchedConversations]
  );

  // Conversations per day data - only calculate if we have fetched conversations
  const conversationsPerDay = useMemo(() => {
    if (!startDate || !endDate || fetchedConversations.length === 0) return [];
    return calculateConversationsPerDay(fetchedConversations, startDate, endDate);
  }, [fetchedConversations, startDate, endDate]);

  // Calculate conversation metrics
  const conversationMetrics = useMemo(
    () => calculateAllConversationMetrics(allConversations),
    [allConversations]
  );

  // Calculate summary statistics
  const stats = useMemo(() => {
    return calculateSummaryStats(
      filteredThreads,
      allConversations,
      conversationsPerDay,
      conversationMetrics,
      contactTools,
      travelAgentTools
    );
  }, [filteredThreads, allConversations, conversationsPerDay, conversationMetrics, contactTools, travelAgentTools]);

  return {
    filteredThreads,
    filteredUploadedConversations,
    allConversations,
    conversationsPerDay,
    conversationMetrics,
    stats,
  };
}

function calculateSummaryStats(
  filteredThreads: Thread[],
  allConversations: ConversationData[],
  conversationsPerDay: Array<{ conversations: number; formattedDate: string }>,
  conversationMetrics: ConversationMetric[],
  contactTools?: ContactToolsData,
  travelAgentTools?: TravelAgentToolsData
) {
  const totalConversations = new Set([
    ...filteredThreads.map((t) => t.conversationId),
    ...allConversations.map((c) => c.id),
  ]).size;

  const totalThreads = filteredThreads.length + allConversations.length;

  const avgConversationsPerDay =
    conversationsPerDay.length > 0
      ? Math.round(
          conversationsPerDay.reduce((sum, day) => sum + day.conversations, 0) /
            conversationsPerDay.length
        )
      : 0;

  const peakDay = conversationsPerDay.reduce(
    (max, day) => (day.conversations > max.conversations ? day : max),
    { conversations: 0, formattedDate: 'N/A' }
  );

  // Calculate conversations with errors
  const conversationsWithErrors = allConversations.filter(conversationHasErrors);
  const errorPercentage =
    allConversations.length > 0
      ? Math.round((conversationsWithErrors.length / allConversations.length) * 100)
      : 0;

  // Conversation metrics aggregation
  const totalUserMessages = conversationMetrics.reduce(
    (sum, conv) => sum + (conv?.userMessages || 0),
    0
  );

  const totalAssistantMessages = conversationMetrics.reduce(
    (sum, conv) => sum + (conv?.assistantMessages || 0),
    0
  );

  const avgMessagesPerConversation =
    conversationMetrics.length > 0
      ? Math.round((totalUserMessages / conversationMetrics.length) * 100) / 100
      : 0;

  const avgDurationMinutes =
    conversationMetrics.length > 0
      ? Math.round(
          (conversationMetrics.reduce((sum, conv) => sum + (conv?.durationMinutes || 0), 0) /
            conversationMetrics.length) *
            100
        ) / 100
      : 0;

  const avgTimeToFirstResponseSeconds =
    conversationMetrics.length > 0
      ? Math.round(
          (conversationMetrics.reduce(
            (sum, conv) => sum + (conv?.timeToFirstResponseSeconds || 0),
            0
          ) /
            conversationMetrics.length) *
            100
        ) / 100
      : 0;

  const activeDays = conversationsPerDay.filter((day) => day.conversations > 0).length;
  const fetchedConversationsCount = allConversations.length;

  return {
    totalConversations,
    totalThreads,
    avgConversationsPerDay,
    peakDay,
    activeDays,
    totalUserMessages,
    totalAssistantMessages,
    conversationsWithErrors: conversationsWithErrors.length,
    errorPercentage,
    avgMessagesPerConversation,
    avgDurationMinutes,
    avgTimeToFirstResponseSeconds,
    fetchedConversationsCount,
    kontaktquote: contactTools?.kontaktquote ?? 0,
    conversationsWithContactTools: Array.isArray(contactTools?.conversationsWithContactTools) ? contactTools.conversationsWithContactTools.length : 0,
    travelAgentQuote: travelAgentTools?.travelAgentQuote ?? 0,
    conversationsWithTravelAgentTools: travelAgentTools?.conversationsWithTravelAgentTools?.length ?? 0,
  };
}

function conversationHasErrors(conversation: ConversationData): boolean {
  if (!conversation.messages) return false;
  return conversation.messages.some((message) => {
    if (message.role === 'system' || message.role === 'status') {
      const content = message.content as Array<{ text?: string; content?: string }> | undefined;
      if (!content || !Array.isArray(content)) return false;

      return content.some((c) => {
        if (c.text || c.content) {
          const text = c.text || c.content || '';
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
}
