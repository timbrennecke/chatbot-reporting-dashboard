/**
 * Individual thread row component for the threads table
 */

import { Bookmark } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { ThreadRowData } from '../../lib/threadTypes';
import type { Thread } from '../../lib/types';
import { formatTimestamp, parseThreadId } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { TableCell, TableRow } from '../ui/table';

interface ThreadRowProps {
  thread: Thread;
  isThreadViewed: boolean;
  isConversationViewed: boolean;
  hasConversationData: boolean;
  isSaved: boolean;
  hasError: boolean;
  onConversationView: () => void;
}

function ThreadRowComponent({
  thread,
  isThreadViewed,
  isConversationViewed,
  hasConversationData,
  isSaved,
  hasError,
  onConversationView,
}: ThreadRowProps) {
  // Debug log for error status
  if (hasError) {
    console.debug('🔴 Row with error:', {
      threadId: thread.id,
      conversationId: thread.conversationId,
      firstMessage: thread.messages[0]?.content?.[0]?.text?.slice(0, 50),
    });
  }

  // Memoize expensive calculations
  const threadData = useMemo<ThreadRowData>(() => {
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
      .map((m) => new Date(m.created_at || m.createdAt || m.sentAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const conversationDuration =
      allTimestamps.length > 1
        ? allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
        : 0;
    const durationSeconds = Math.round(conversationDuration / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);

    // Calculate time to first assistant response
    const userMessages = thread.messages.filter((m) => m.role === 'user');
    const assistantMessages = thread.messages.filter((m) => m.role === 'assistant');

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

    // Get first user message text
    const firstUserMessage = thread.messages.find((m) => m.role === 'user');
    const firstUserMessageText =
      firstUserMessage?.content
        .map((c) => c.text || c.content || '')
        .join(' ')
        .trim()
        .slice(0, 100) || '';

    return {
      parsed,
      uiCount,
      messageCount,
      firstUserMessageText,
      conversationDuration,
      durationMinutes,
      durationSeconds,
      responseTimeSeconds,
    };
  }, [thread]);

  const isAnyViewed = isThreadViewed || isConversationViewed;

  return (
    <TableRow
      className={`transition-colors h-[55px] ${
        hasError ? 'bg-red-50 dark:bg-red-950/10' : isAnyViewed ? 'bg-green-50/30 dark:bg-green-950/10' : 'bg-white'
      }`}
    >
      <TableCell className="p-0 px-4 cursor-pointer text-left" onClick={onConversationView}>
        <div className="flex items-center gap-2 min-w-0" style={{ height: '55px' }}>
          <div
            className={`flex-1 min-w-0 text-sm overflow-hidden leading-tight ${
              !isAnyViewed ? 'font-bold' : 'font-normal'
            }`}
            style={{ wordBreak: 'break-word' }}
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
        className="p-0 px-4 cursor-pointer text-left"
        title={thread.conversationId}
      >
        <div
          className={`text-sm font-mono whitespace-nowrap flex items-center ${
            hasConversationData ? 'text-blue-600 hover:underline' : 'text-foreground'
          }`}
          style={{ height: '55px' }}
        >
          {thread.conversationId}
        </div>
      </TableCell>

      <TableCell onClick={onConversationView} className="p-0 px-4 text-left">
        <div className="text-sm whitespace-nowrap flex items-center" style={{ height: '55px' }}>
          {formatTimestamp(thread.createdAt)}
        </div>
      </TableCell>

      <TableCell
        onClick={onConversationView}
        className="p-0 px-3 text-right"
      >
        <div className="flex items-center justify-end" style={{ height: '55px' }}>
          {threadData.uiCount > 0 ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {threadData.uiCount}
            </Badge>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </TableCell>

      <TableCell
        onClick={onConversationView}
        className="p-0 px-3 text-right"
      >
        <div className="flex items-center justify-end" style={{ height: '55px' }}>
          {threadData.messageCount > 0 ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {threadData.messageCount}
            </Badge>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </TableCell>

      <TableCell
        onClick={onConversationView}
        className="p-0 px-3 text-right"
      >
        <div className="flex items-center justify-end" style={{ height: '55px' }}>
          {threadData.conversationDuration > 0 ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {threadData.durationMinutes > 0
                ? `${threadData.durationMinutes}m`
                : `${threadData.durationSeconds}s`}
            </Badge>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </TableCell>

      <TableCell
        onClick={onConversationView}
        className="p-0 px-3 text-right"
      >
        <div className="flex items-center justify-end" style={{ height: '55px' }}>
          {threadData.responseTimeSeconds > 0 ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {threadData.responseTimeSeconds}s
            </Badge>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ThreadRow = memo(ThreadRowComponent);
