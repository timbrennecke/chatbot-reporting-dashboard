/**
 * Shared categorization utilities for conversations and threads
 */

import { Message, Thread, Conversation } from './types';
import { TOPIC_KEYWORDS, INSPIRATION_EXACT_MESSAGES, INSPIRATION_PATTERN_MESSAGES } from './constants';

/**
 * Extract workflows from message content
 */
export function extractWorkflowsFromMessages(messages: Message[]): Set<string> {
  const workflows = new Set<string>();
  
  messages.forEach(message => {
    // Look for workflows in system/status messages
    if (message.role === 'system' || (message as any).role === 'status') {
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
  });
  
  return workflows;
}

/**
 * Extract workflows from a thread
 */
export function extractWorkflowsFromThread(thread: Thread): Set<string> {
  return extractWorkflowsFromMessages(thread.messages || []);
}

/**
 * Extract workflows from a conversation
 */
export function extractWorkflowsFromConversation(conversation: any): Set<string> {
  if (!conversation.messages) return new Set<string>();
  return extractWorkflowsFromMessages(conversation.messages);
}

/**
 * Get the first user message from a list of messages
 */
function getFirstUserMessage(messages: Message[]): Message | undefined {
  return messages
    .filter(m => m.role === 'user')
    .sort((a, b) => {
      const timeA = new Date(a.sentAt || a.createdAt || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.sentAt || b.createdAt || (b as any).created_at || 0).getTime();
      return timeA - timeB;
    })[0];
}

/**
 * Extract message text from a message
 */
function getMessageText(message: Message): string {
  return message.content
    .map(content => content.text || content.content || '')
    .join(' ')
    .trim();
}

/**
 * Check if a message matches inspiration category patterns
 */
function isInspirationMessage(messageText: string): boolean {
  // Check for exact message matches
  for (const exactMessage of INSPIRATION_EXACT_MESSAGES) {
    if (messageText.toLowerCase() === exactMessage.toLowerCase()) {
      return true;
    }
  }

  // Check for pattern-based messages
  for (const pattern of INSPIRATION_PATTERN_MESSAGES) {
    if (pattern.test(messageText)) {
      return true;
    }
  }

  return false;
}

/**
 * Categorize based on keywords
 */
function categorizeByKeywords(messageText: string): string | null {
  const messageTextLower = messageText.toLowerCase();

  // Check against all categories
  for (const [categoryName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (messageTextLower.includes(keyword.toLowerCase())) {
        return categoryName;
      }
    }
  }

  return null;
}

/**
 * Categorize a conversation based on its messages
 */
export function categorizeConversation(messages: Message[]): string | null {
  if (!messages || messages.length === 0) return null;

  // Extract workflows from messages
  const workflows = extractWorkflowsFromMessages(messages);
  
  // Special handling for workflow-based categories
  if (workflows.has('workflow-travel-agent')) {
    return 'Inspiration/Reiseberatung';
  }
  
  if (workflows.has('workflow-contact-customer-service')) {
    return 'Kundenberatung/Customer Support';
  }

  // Get first user message
  const firstUserMessage = getFirstUserMessage(messages);
  if (!firstUserMessage) return null;

  const messageText = getMessageText(firstUserMessage);
  if (!messageText) return null;

  // Check for inspiration message patterns
  if (isInspirationMessage(messageText)) {
    return 'Inspiration/Reiseberatung';
  }

  // Check against keywords
  return categorizeByKeywords(messageText);
}

/**
 * Categorize a thread
 */
export function categorizeThread(thread: Thread): string | null {
  if (!thread.messages || thread.messages.length === 0) return null;
  return categorizeConversation(thread.messages);
}

/**
 * Categorize any conversation object (with messages property)
 */
export function categorizeConversationObject(conversation: any): string | null {
  if (!conversation.messages) return null;
  return categorizeConversation(conversation.messages);
}

