import { Bot, Check, Clock, Copy, Settings, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../lib/types';
import { formatTimestamp } from '../../lib/utils';
import { consolidateMessageContent, systemMessageHasErrors } from '../../utils/conversationUtils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageContentRenderer } from './MessageContentRenderer';

interface MessageBubbleProps {
  message: Message;
  hasTimeout?: boolean;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}

export function MessageBubble({
  message,
  hasTimeout = false,
  copiedId,
  onCopy,
}: MessageBubbleProps) {
  const { consolidatedText, otherContents } = consolidateMessageContent(message.content || []);

  return (
    <div className={`flex gap-4 mb-8 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar - only for assistant and system messages (left side) */}
      {message.role !== 'user' && (
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
            message.role === 'assistant'
              ? 'bg-slate-100 border-slate-200'
              : message.role === 'system' || message.role === 'status'
                ? systemMessageHasErrors(message)
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
                : 'bg-slate-100 border-slate-200'
          }`}
        >
          {message.role === 'assistant' ? (
            <Bot className="h-5 w-5 text-slate-600" />
          ) : message.role === 'system' || message.role === 'status' ? (
            <Settings
              className={`h-5 w-5 ${
                systemMessageHasErrors(message) ? 'text-red-600' : 'text-amber-600'
              }`}
            />
          ) : (
            <User className="h-5 w-5 text-slate-600" />
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className={`max-w-[70%] ${message.role === 'system' ? 'max-w-[90%]' : ''}`}>
        {/* Message header with role and timestamp */}
        <div
          className={`flex items-center gap-2 mb-2 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              message.role === 'user'
                ? 'bg-blue-50 text-blue-700'
                : message.role === 'assistant'
                  ? 'bg-green-50 text-green-700'
                  : message.role === 'system'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
            }`}
          >
            {message.role === 'user'
              ? 'User'
              : message.role === 'assistant'
                ? 'Assistant'
                : 'System'}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimestamp(message.sentAt)}
          </span>
          {/* Timeout indicator pill */}
          {hasTimeout && (
            <Badge
              variant="secondary"
              className="text-xs px-2 py-0 bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1"
            >
              <Clock className="h-3 w-3" />
              Timeout
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(consolidatedText, `message-${message.id}`)}
            className="h-6 w-6 p-0 hover:bg-slate-100"
            title="Copy message content"
          >
            {copiedId === `message-${message.id}` ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-slate-500" />
            )}
          </Button>
        </div>

        {/* Message content bubble */}
        <div
          className={`!rounded-2xl !px-6 !py-6 shadow-sm !border ${
            message.role === 'user'
              ? 'bg-blue-50 text-slate-800 ml-auto border-blue-200'
              : message.role === 'assistant'
                ? 'bg-slate-50 text-slate-800 border-green-200 shadow-sm'
                : message.role === 'system'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
          }`}
          style={{
            backgroundColor:
              message.role === 'user'
                ? '#eff6ff'
                : message.role === 'system' || message.role === 'status'
                  ? systemMessageHasErrors(message)
                    ? '#fee2e2'
                    : '#fefce8'
                  : message.role === 'assistant'
                    ? '#f0fdf4'
                    : '#f8fafc',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid',
            borderColor:
              message.role === 'user'
                ? '#bfdbfe'
                : message.role === 'system' || message.role === 'status'
                  ? systemMessageHasErrors(message)
                    ? '#fca5a5'
                    : '#fde68a'
                  : message.role === 'assistant'
                    ? '#bbf7d0'
                    : '#e2e8f0',
            ...(message.role === 'system' || message.role === 'status'
              ? {
                  maxHeight: '320px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                }
              : {}),
          }}
        >
          {/* Text content */}
          {consolidatedText && (
            <div className="prose prose-sm max-w-none">
              {message.role === 'assistant' ? (
                // Render assistant messages with markdown formatting
                <div className="markdown-content text-slate-700 text-base">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Headings
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-4 text-slate-900">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold mt-5 mb-3 text-slate-900">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-semibold mt-4 mb-2 text-slate-900">{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-base font-semibold mt-3 mb-2 text-slate-800">{children}</h4>
                      ),
                      // Paragraphs
                      p: ({ children }) => (
                        <p className="mb-3 leading-relaxed text-slate-700">{children}</p>
                      ),
                      // Bold text
                      strong: ({ children }) => (
                        <strong className="font-bold text-slate-900">{children}</strong>
                      ),
                      // Lists
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-4 space-y-2 text-slate-700">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-4 space-y-2 text-slate-700">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed ml-2">{children}</li>
                      ),
                      // Code blocks
                      code: ({ inline, children, ...props }) => {
                        if (inline) {
                          return (
                            <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className="block bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto my-3 text-sm font-mono whitespace-pre" {...props}>
                            {children}
                          </code>
                        );
                      },
                      // Pre (code block wrapper)
                      pre: ({ children }) => (
                        <pre className="my-3">{children}</pre>
                      ),
                      // Tables
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-slate-300">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-100">{children}</thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody>{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="border-b border-slate-300">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-slate-300 px-4 py-2 text-slate-700">{children}</td>
                      ),
                      // Horizontal rule
                      hr: () => (
                        <hr className="my-4 border-t-2 border-slate-300" />
                      ),
                      // Blockquote
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-slate-400 pl-4 italic my-3 text-slate-600">{children}</blockquote>
                      ),
                      // Links
                      a: ({ children, href }) => (
                        <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">{children}</a>
                      ),
                    }}
                  >
                    {consolidatedText}
                  </ReactMarkdown>
                </div>
              ) : consolidatedText.includes('```json') ? (
                // Render formatted JSON with code highlighting (for non-assistant messages)
                <div className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                  {consolidatedText.split(/(```json[\s\S]*?```)/g).map((part, index) => {
                    if (part.startsWith('```json') && part.endsWith('```')) {
                      const jsonContent = part.replace(/```json\n?/, '').replace(/\n?```$/, '');
                      return (
                        <div key={index} className="my-4">
                          <div className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">
                              <code>{jsonContent}</code>
                            </pre>
                          </div>
                        </div>
                      );
                    }
                    return <span key={index}>{part}</span>;
                  })}
                </div>
              ) : (
                // Regular text content (for non-assistant messages)
                <div className="whitespace-pre-wrap leading-relaxed m-0 text-slate-700 text-base">
                  {consolidatedText}
                </div>
              )}
            </div>
          )}

          {/* Other content (UI, linkouts, etc.) */}
          {otherContents.length > 0 && (
            <div className="mt-4 space-y-3">
              {otherContents.map((content, idx) => (
                <MessageContentRenderer key={`other-${idx}`} content={content} index={idx} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Avatar - only for user messages (right side) */}
      {message.role === 'user' && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
          <User className="h-5 w-5 text-blue-600" />
        </div>
      )}
    </div>
  );
}
