import type { Message, MessageContent } from '../lib/types';

/**
 * Count messages excluding UI events and linkouts
 */
export function countMessagesExcludingUI(messages: Message[]): number {
  return messages.filter((msg) => {
    if (!msg.content) return true;
    if (!Array.isArray(msg.content)) return true;

    // If all content items are UI/linkout events, exclude this message
    const hasNonUIContent = msg.content.some((content: MessageContent) => {
      return content.kind !== 'ui_event' && content.kind !== 'linkout';
    });

    return hasNonUIContent;
  }).length;
}

/**
 * Count only user and assistant messages (excluding system messages)
 */
export function countUserAndAssistantMessages(messages: Message[]): number {
  return messages.filter((msg) => msg.role === 'user' || msg.role === 'assistant').length;
}

/**
 * Check if a system message contains error information
 */
export function systemMessageHasErrors(message: Message): boolean {
  if (!message.content) return false;

  // Convert content to text for error checking
  let messageText = '';

  if (typeof message.content === 'string') {
    messageText = message.content;
  } else if (Array.isArray(message.content)) {
    messageText = message.content
      .map((c: MessageContent) => c.text || c.content || JSON.stringify(c))
      .join(' ');
  }

  // Check for error indicators in the message
  const errorPatterns = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bfailure\b/i,
    /\bexception\b/i,
    /\bwarning\b/i,
    /\btimeout\b/i,
    /\brefused\b/i,
    /\bunexpected\b/i,
    /\binvalid\b/i,
    /\bincorrect\b/i,
    /\bcannot\b/i,
    /\bcouldn't\b/i,
    /\bcan't\b/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(messageText));
}

/**
 * Find the matching closing brace for JSON parsing
 */
function findJsonEnd(str: string, startIndex: number): number {
  let braceCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

/**
 * Sanitize JSON string by removing/replacing invalid control characters
 */
function sanitizeJsonString(jsonStr: string): string {
  // First, handle basic unescaping
  const result = jsonStr
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\f/g, '\f')
    .replace(/\\b/g, '\b');

  // Process character by character to properly handle quoted content
  let sanitized = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    const charCode = char.charCodeAt(0);

    if (escaped) {
      sanitized += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      sanitized += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      sanitized += char;
      continue;
    }

    // Handle control characters
    if (charCode < 32 || charCode === 127) {
      if (inString) {
        // Inside a string, escape control characters properly
        switch (charCode) {
          case 8:
            sanitized += '\\b';
            break;
          case 9:
            sanitized += '\\t';
            break;
          case 10:
            sanitized += '\\n';
            break;
          case 12:
            sanitized += '\\f';
            break;
          case 13:
            sanitized += '\\r';
            break;
          default:
            // For other control characters, use unicode escape
            sanitized += `\\u${charCode.toString(16).padStart(4, '0')}`;
            break;
        }
      } else {
        // Outside strings, just remove control characters (except newlines, tabs)
        if (charCode === 10 || charCode === 13 || charCode === 9) {
          sanitized += char;
        }
        // Otherwise skip the character
      }
    } else {
      sanitized += char;
    }
  }

  return sanitized;
}

/**
 * Check if a string has valid JSON structure
 */
function hasValidJsonStructure(str: string): boolean {
  // Must start with { and end with }
  if (!str.trim().startsWith('{') || !str.trim().endsWith('}')) return false;

  // Should have some basic JSON patterns
  const hasJsonPatterns = /["']\s*:\s*["'[{]/.test(str) || /["']\s*:\s*\w/.test(str);
  return hasJsonPatterns;
}

/**
 * Format JSON embedded in text with syntax highlighting
 */
export function formatJsonInText(text: string): { hasJson: boolean; formattedText: string } {
  let formattedText = text;
  let hasJson = false;

  // First, check if we already have formatted JSON blocks and skip them
  if (formattedText.includes('```json')) {
    return { hasJson: true, formattedText };
  }

  // Look for JSON starting with { and containing escaped quotes
  let searchIndex = 0;
  while (true) {
    const startIndex = formattedText.indexOf('{\\', searchIndex);
    if (startIndex === -1) break;

    const endIndex = findJsonEnd(formattedText, startIndex);
    if (endIndex === -1) {
      searchIndex = startIndex + 1;
      continue;
    }

    const jsonString = formattedText.substring(startIndex, endIndex + 1);

    // Only process if it looks like a substantial JSON object
    if (jsonString.length > 50 && jsonString.includes('\\"')) {
      if (!hasValidJsonStructure(jsonString)) {
        // Skip this - it's probably not actually JSON
        searchIndex = startIndex + 1;
        continue;
      }

      try {
        // Sanitize the JSON string to handle control characters
        const sanitizedJson = sanitizeJsonString(jsonString);

        // Try to parse the sanitized JSON
        const parsedJson = JSON.parse(sanitizedJson);
        // Format it nicely with 2-space indentation
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        // Replace the original match with the formatted version
        formattedText = formattedText.replace(
          jsonString,
          `\n\n\`\`\`json\n${formattedJson}\n\`\`\`\n\n`
        );
        hasJson = true;
        // Continue searching after the replacement
        searchIndex = startIndex + formattedJson.length;
      } catch (_error) {
        // If parsing still fails, format as a code block without trying to parse
        const displayText = jsonString
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '  ')
          .replace(/\\r/g, '\r')
          // Remove all control characters that could cause issues
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        formattedText = formattedText.replace(
          jsonString,
          `\n\n\`\`\`text\n${displayText}\n\`\`\`\n\n`
        );
        hasJson = true;
        searchIndex = startIndex + displayText.length;
      }
    } else {
      searchIndex = startIndex + 1;
    }
  }

  return { hasJson, formattedText };
}

/**
 * Process message text content and combine fragments
 */
export function processMessageText(content: MessageContent[]): string {
  const textContents = content.filter((c) => c.kind === 'text');

  if (textContents.length === 0) return '';

  if (textContents.length === 1) {
    // Single text item - use it directly
    const text = textContents[0].text || textContents[0].content || '';
    return text;
  }
  // Multiple text items - they might be fragments that need to be joined properly
  const combinedText = textContents
    .map((item) => item.text || item.content || '')
    .filter((text) => text.length > 0)
    .join(''); // Try joining without spaces first

  return combinedText;
}

/**
 * Consolidate message content by combining text and applying JSON formatting
 */
export function consolidateMessageContent(content: MessageContent[]): {
  consolidatedText: string;
  otherContents: MessageContent[];
} {
  const _textContents = content.filter((c) => c.kind === 'text');
  const otherContents = content.filter((c) => c.kind !== 'text');

  let consolidatedText = processMessageText(content);

  // Apply JSON formatting if the text contains JSON
  const { formattedText } = formatJsonInText(consolidatedText);
  consolidatedText = formattedText;

  return { consolidatedText, otherContents };
}
