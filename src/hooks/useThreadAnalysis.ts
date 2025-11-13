/**
 * Hook for analyzing threads (tools, workflows, errors, topics)
 */

import { useMemo } from 'react';
import { categorizeThread, extractWorkflowsFromThread } from '../lib/categorization';
import type { ToolWithCount, WorkflowWithCount } from '../lib/threadTypes';
import type { Thread } from '../lib/types';

interface UseThreadAnalysisReturn {
  toolsWithCounts: ToolWithCount[];
  workflowsWithCounts: WorkflowWithCount[];
  totalThreadsWithErrors: number;
  totalThreadsWithTimeouts: number;
  availableTopics: string[];
}

export function useThreadAnalysis(threads: Thread[]): UseThreadAnalysisReturn {
  // Extract tools with counts
  const toolsWithCounts = useMemo(() => {
    const toolThreadCounts = new Map<string, Set<string>>();

    threads.forEach((thread) => {
      const threadTools = new Set<string>();

      thread.messages.forEach((message) => {
        if (message.role === 'system' || message.role === 'status') {
          message.content.forEach((content) => {
            const text = (content.text || content.content || '').toString();

            // Pattern: **Tool Name:** `tool-name`
            const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
            for (const match of text.matchAll(toolNamePattern)) {
              const toolName = match[1];
              if (toolName && toolName.length > 1) {
                threadTools.add(toolName);
              }
            }

            // Pattern: Tool Call Initiated
            const initiatedPatterns = [
              /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
              /Tool\s*Call\s*Initiated[^A-Za-z0-9_-]*\(([^)]+)\)/gi,
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
          });
        }
      });

      threadTools.forEach((toolName) => {
        if (!toolThreadCounts.has(toolName)) {
          toolThreadCounts.set(toolName, new Set());
        }
        toolThreadCounts.get(toolName)?.add(thread.id);
      });
    });

    return Array.from(toolThreadCounts.entries())
      .map(([name, threadSet]) => ({ name, count: threadSet.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [threads]);

  // Extract workflows with counts using the shared categorization function
  const workflowsWithCounts = useMemo(() => {
    const workflowThreadCounts = new Map<string, Set<string>>();

    threads.forEach((thread) => {
      // Use the shared extractWorkflowsFromThread function for consistency
      const threadWorkflows = extractWorkflowsFromThread(thread);

      threadWorkflows.forEach((workflowName) => {
        if (!workflowThreadCounts.has(workflowName)) {
          workflowThreadCounts.set(workflowName, new Set());
        }
        workflowThreadCounts.get(workflowName)?.add(thread.id);
      });
    });

    return Array.from(workflowThreadCounts.entries())
      .map(([name, threadSet]) => ({ name, count: threadSet.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [threads]);

  // Count threads with errors
  const totalThreadsWithErrors = useMemo(() => {
    return threads.filter((thread) => {
      return thread.messages.some((message) => {
        if (message.role === 'system' || message.role === 'status') {
          return message.content.some((content) => {
            const text = content.text || content.content || '';
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
          });
        }
        return false;
      });
    }).length;
  }, [threads]);

  // Count threads with timeouts (30+ second gaps)
  const totalThreadsWithTimeouts = useMemo(() => {
    return threads.filter((thread) => {
      if (!thread.messages || thread.messages.length < 2) return false;

      const sortedMessages = [...thread.messages].sort((a, b) => {
        const timeA = new Date(a.created_at || a.createdAt || a.sentAt).getTime();
        const timeB = new Date(b.created_at || b.createdAt || b.sentAt).getTime();
        return timeA - timeB;
      });

      for (let i = 1; i < sortedMessages.length; i++) {
        const prevMessage = sortedMessages[i - 1];
        const currentMessage = sortedMessages[i];

        const prevTime = new Date(
          prevMessage.created_at || prevMessage.createdAt || prevMessage.sentAt
        ).getTime();
        const currentTime = new Date(
          currentMessage.created_at || currentMessage.createdAt || currentMessage.sentAt
        ).getTime();

        if (currentTime - prevTime >= 30000) {
          if (currentMessage.role === 'user') {
            continue;
          }
          return true;
        }
      }

      return false;
    }).length;
  }, [threads]);

  // Extract available topics
  const availableTopics = useMemo(() => {
    const topicsSet = new Set<string>();
    threads.forEach((thread) => {
      const category = categorizeThread(thread);
      if (category && category !== 'Other') {
        topicsSet.add(category);
      }
    });
    return Array.from(topicsSet).sort();
  }, [threads]);

  return {
    toolsWithCounts,
    workflowsWithCounts,
    totalThreadsWithErrors,
    totalThreadsWithTimeouts,
    availableTopics,
  };
}
