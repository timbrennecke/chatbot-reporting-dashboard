import type { Thread } from '../lib/types';

export interface ConversationData {
  id: string;
  createdAt: string;
  created_at?: string;
  messages: Message[];
  threadId?: string;
  threadCreatedAt?: string;
}

export interface Message {
  role: string;
  created_at?: string;
  createdAt?: string;
  sentAt?: string;
  content?: unknown;
}

export interface DateChunk {
  start: Date;
  end: Date;
  dateStr: string;
}

export interface ConversationMetric {
  id: string;
  userMessages: number;
  assistantMessages: number;
  totalMessages: number;
  duration: number;
  durationMinutes: number;
  durationHours: number;
  timeToFirstResponse: number;
  timeToFirstResponseSeconds: number;
  timeToFirstResponseMinutes: number;
}

export interface DailyConversation {
  date: Date;
  formattedDate: string;
  conversations: number;
}

/**
 * Create smart time chunks for a single day based on typical usage patterns
 */
export function createDayChunks(dayStart: Date): DateChunk[] {
  const dayChunks: DateChunk[] = [];
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
}

/**
 * Generate date chunks for a date range
 */
export function generateDateChunks(startDate: Date, endDate: Date): DateChunk[] {
  const chunks: DateChunk[] = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  const endDateObj = new Date(endDate);

  while (currentDate <= endDateObj) {
    const dayChunks = createDayChunks(currentDate);

    // Filter chunks to only include those that overlap with our time range
    dayChunks.forEach((chunk) => {
      const chunkStart = new Date(Math.max(chunk.start.getTime(), startDate.getTime()));
      const chunkEnd = new Date(Math.min(chunk.end.getTime(), endDate.getTime()));

      // Only add chunk if it has a valid time range
      if (chunkStart < chunkEnd) {
        chunks.push({
          start: chunkStart,
          end: chunkEnd,
          dateStr: `${chunkStart.toLocaleDateString()} ${chunkStart.getHours()}:${chunkStart
            .getMinutes()
            .toString()
            .padStart(2, '0')}-${chunkEnd.getHours()}:${chunkEnd
            .getMinutes()
            .toString()
            .padStart(2, '0')}`,
        });
      }
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return chunks;
}

/**
 * Filter threads by date range
 */
export function filterThreadsByDateRange(
  threads: Thread[],
  startDate: Date | null,
  endDate: Date | null
): Thread[] {
  if (!startDate || !endDate) return threads;

  return threads.filter((thread) => {
    const threadDate = new Date(thread.createdAt);
    return threadDate >= startDate && threadDate <= endDate;
  });
}

/**
 * Filter conversations by date range
 */
export function filterConversationsByDateRange(
  conversations: ConversationData[],
  startDate: Date | null,
  endDate: Date | null
): ConversationData[] {
  if (!startDate || !endDate) return conversations;

  return conversations.filter((conversation) => {
    const convDate = new Date(conversation.createdAt || conversation.created_at || Date.now());
    return convDate >= startDate && convDate <= endDate;
  });
}

/**
 * Calculate conversations per hour
 */
export function calculateConversationsPerHour(
  conversations: ConversationData[],
  startDate: Date,
  endDate: Date
): DailyConversation[] {
  // Create a map for actual conversation counts by hour
  const hourlyCounts: Record<string, Set<string>> = {};

  conversations.forEach((conversation) => {
    if (conversation.id) {
      const date = new Date(
        conversation.createdAt || conversation.created_at || Date.now()
      );
      // Create a key for each hour: "YYYY-MM-DD-HH"
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
      
      if (!hourlyCounts[hourKey]) {
        hourlyCounts[hourKey] = new Set();
      }
      hourlyCounts[hourKey].add(conversation.id);
    }
  });

  // Generate ALL hours in the date range (including zeros)
  const result: DailyConversation[] = [];
  const currentDate = new Date(startDate);
  currentDate.setMinutes(0, 0, 0); // Reset to start of the hour
  const endDateTime = new Date(endDate);

  while (currentDate <= endDateTime) {
    const hourKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getHours()).padStart(2, '0')}`;
    const conversationCount = hourlyCounts[hourKey] ? hourlyCounts[hourKey].size : 0;

    // Format as "Nov 12, 14:00" with 24-hour format
    const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hour = String(currentDate.getHours()).padStart(2, '0');

    result.push({
      date: new Date(currentDate),
      formattedDate: `${month} ${day}, ${hour}:00`,
      conversations: conversationCount,
    });

    // Move to next hour
    currentDate.setHours(currentDate.getHours() + 1);
  }

  return result;
}

/**
 * Calculate conversations per day
 */
export function calculateConversationsPerDay(
  conversations: ConversationData[],
  startDate: Date,
  endDate: Date
): DailyConversation[] {
  // Create a map for actual conversation counts
  const dailyCounts: Record<string, Set<string>> = {};

  conversations.forEach((conversation) => {
    if (conversation.id) {
      const date = new Date(
        conversation.createdAt || conversation.created_at || Date.now()
      ).toDateString();
      if (!dailyCounts[date]) {
        dailyCounts[date] = new Set();
      }
      dailyCounts[date].add(conversation.id);
    }
  });

  // Generate ALL days in the date range (including zeros)
  const result: DailyConversation[] = [];
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);

  while (currentDate <= endDateTime) {
    const dateString = currentDate.toDateString();
    const conversationCount = dailyCounts[dateString] ? dailyCounts[dateString].size : 0;

    result.push({
      date: new Date(currentDate),
      formattedDate: currentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      conversations: conversationCount,
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Calculate metrics for a single conversation
 */
export function calculateConversationMetrics(
  conversation: ConversationData
): ConversationMetric | null {
  if (!conversation.messages) return null;

  // Calculate conversation duration (first to last message)
  const allTimestamps = conversation.messages
    .map((m) => new Date(m.created_at || m.createdAt || m.sentAt || Date.now()))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const conversationDuration =
    allTimestamps.length > 1
      ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
      : 0;

  // Calculate time to first assistant response
  const userMessages = conversation.messages.filter((m) => m.role === 'user');
  const assistantMessages = conversation.messages.filter((m) => m.role === 'assistant');

  let timeToFirstResponse = 0;
  if (userMessages.length > 0 && assistantMessages.length > 0) {
    const firstUserMessage = userMessages
      .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt || 0) }))
      .filter((m) => !Number.isNaN(m.timestamp.getTime()))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

    const firstAssistantMessage = assistantMessages
      .map((m) => ({ ...m, timestamp: new Date(m.created_at || m.createdAt || m.sentAt || 0) }))
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

  return {
    id: conversation.id,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    totalMessages: userMessages.length + assistantMessages.length,
    duration: conversationDuration,
    durationMinutes: Math.round(conversationDuration / (1000 * 60)),
    durationHours: Math.round((conversationDuration / (1000 * 60 * 60)) * 10) / 10,
    timeToFirstResponse,
    timeToFirstResponseSeconds: Math.round(timeToFirstResponse / 1000),
    timeToFirstResponseMinutes: Math.round((timeToFirstResponse / (1000 * 60)) * 10) / 10,
  };
}

/**
 * Calculate metrics for all conversations
 */
export function calculateAllConversationMetrics(
  conversations: ConversationData[]
): ConversationMetric[] {
  return conversations
    .map((conversation) => calculateConversationMetrics(conversation))
    .filter((metric): metric is ConversationMetric => metric !== null);
}

/**
 * Convert thread data to conversation format
 */
export function convertThreadToConversation(thread: {
  conversationId: string;
  createdAt: string;
  messages: Message[];
  id: string;
}): ConversationData {
  return {
    id: thread.conversationId,
    createdAt: thread.createdAt,
    created_at: thread.createdAt,
    messages: thread.messages || [],
    threadId: thread.id,
    threadCreatedAt: thread.createdAt,
  };
}
