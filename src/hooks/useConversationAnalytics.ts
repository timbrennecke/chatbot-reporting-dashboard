import { useMemo } from 'react';
import type { Conversation, Message } from '../lib/types';
import { consolidateMessageContent, countMessagesExcludingUI } from '../utils/conversationUtils';

interface ConversationAnalytics {
  totalMessages: number;
  totalUiEvents: number;
  totalLinkouts: number;
  avgMessageLength: number;
}

export function useConversationAnalytics(
  activeConversation: Conversation | null
): ConversationAnalytics | null {
  return useMemo((): ConversationAnalytics | null => {
    if (!activeConversation) return null;

    let totalUiEvents = 0;
    let totalLinkouts = 0;
    let totalCharacters = 0;
    let messageCount = 0;

    activeConversation.messages.forEach((message) => {
      const { consolidatedText } = consolidateMessageContent(message.content);
      if (consolidatedText) {
        totalCharacters += consolidatedText.length;
        messageCount++;
      }

      message.content.forEach((content) => {
        if (content.kind === 'ui') totalUiEvents++;
        if (content.kind === 'linkout') totalLinkouts++;
      });
    });

    return {
      totalMessages: countMessagesExcludingUI(activeConversation.messages),
      totalUiEvents,
      totalLinkouts,
      avgMessageLength: messageCount > 0 ? totalCharacters / messageCount : 0,
    };
  }, [activeConversation]);
}

export function useFilteredMessages(
  activeConversation: Conversation | null,
  showSystemMessages: boolean
): Message[] {
  return useMemo(() => {
    if (!activeConversation) return [];
    return activeConversation.messages.filter(
      (message) => showSystemMessages || (message.role !== 'system' && message.role !== 'status')
    );
  }, [activeConversation, showSystemMessages]);
}

export function useTimeoutDetection(activeConversation: Conversation | null): Set<string> {
  return useMemo(() => {
    if (!activeConversation?.messages) return new Set();

    const timeoutMessageIds = new Set<string>();

    // Sort all messages by timestamp
    const sortedMessages = [...activeConversation.messages].sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || a.sentAt).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.sentAt).getTime();
      return timeA - timeB;
    });

    // Check for gaps of 30+ seconds between consecutive messages
    for (let i = 0; i < sortedMessages.length - 1; i++) {
      const currentMessage = sortedMessages[i];
      const nextMessage = sortedMessages[i + 1];

      const currentTime = new Date(
        currentMessage.created_at || currentMessage.createdAt || currentMessage.sentAt
      ).getTime();
      const nextTime = new Date(
        nextMessage.created_at || nextMessage.createdAt || nextMessage.sentAt
      ).getTime();

      const timeDiff = nextTime - currentTime;

      // 30+ second gap indicates potential timeout
      if (timeDiff >= 30000) {
        // Check if the next message is a user message that starts with "continue"
        // This likely means the user restarted the conversation after timing out
        if (nextMessage.role === 'user') {
          const messageText =
            typeof nextMessage.content === 'string'
              ? nextMessage.content
              : Array.isArray(nextMessage.content)
                ? nextMessage.content
                    .filter((c) => c.kind === 'text')
                    .map((c) => c.text || c.content || '')
                    .join('')
                : '';

          // If user sent a simple "continue" type message, it's a session restart
          if (
            messageText
              .trim()
              .toLowerCase()
              .match(/^(continue|go on|keep going|proceed)$/i)
          ) {
            continue; // Skip this gap - it's a session restart, don't show timeout pill
          }
        }
        // Show timeout pill on the message that was followed by the delay
        timeoutMessageIds.add(currentMessage.id);
      }
    }

    return timeoutMessageIds;
  }, [activeConversation]);
}
