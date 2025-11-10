import { useMemo } from 'react';
import { extractWorkflowsFromConversation } from '../lib/categorization';

interface ToolUsage {
  name: string;
  count: number;
  avgResponseTime: number;
  responseTimes: number[];
}

interface WorkflowUsage {
  workflow: string;
  count: number;
  percentage: number;
}

export function useToolAndWorkflowAnalysis(fetchedConversations: any[]) {
  const toolStats = useMemo(() => {
    const toolMap = new Map<string, { count: number; responseTimes: number[] }>();

    fetchedConversations.forEach((conversation, convIndex) => {
      conversation.messages?.forEach((message: any, msgIndex: number) => {
        const messageToolsInThisMessage = new Set<string>();

        // Look for tools in system/status messages first
        if (message.role === 'system' || message.role === 'status') {
          if (Array.isArray(message.content)) {
            message.content.forEach((content: any) => {
              if (content.text || content.content) {
                const text = (content.text || content.content || '').toString();

                // Look for "**Tool Name:**" pattern
                const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
                for (const match of text.matchAll(toolNamePattern)) {
                  const toolName = match[1];
                  if (toolName && toolName.length > 1) {
                    messageToolsInThisMessage.add(toolName);
                  }
                }

                // Look for "Tool Call Initiated" and similar patterns
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
                      messageToolsInThisMessage.add(toolName);
                    }
                  }
                });
              }
            });
          }
        }

        // Look for tools in ALL message content (comprehensive patterns)
        if (Array.isArray(message.content)) {
          message.content.forEach((content: any, contentIndex: number) => {
            // 1. Check for tool_use property
            if (content.tool_use?.name) {
              messageToolsInThisMessage.add(content.tool_use.name);
            }

            // 2. Check for tool_call property
            if (content.tool_call?.name) {
              messageToolsInThisMessage.add(content.tool_call.name);
            }

            // 3. Check for tool_name when kind is tool_use
            if (content.kind === 'tool_use' && content.tool_name) {
              messageToolsInThisMessage.add(content.tool_name);
            }

            // 4. Check for type === 'tool_use' pattern
            if (content.type === 'tool_use' && content.name) {
              messageToolsInThisMessage.add(content.name);
            }

            // 5. Check for nested tool.name pattern
            if (content.tool?.name) {
              messageToolsInThisMessage.add(content.tool.name);
            }

            // 6. Check for function_call pattern
            if (content.function_call?.name) {
              messageToolsInThisMessage.add(content.function_call.name);
            }

            // 7. Check text content for tool patterns
            if (content.text || content.content) {
              const text = (content.text || content.content || '').toString();
              const initiatedPatterns = [
                /Tool\s*Call\s*Initiated[^`\w]*`([^`]+)`/gi,
                /Tool\s*Call\s*(?:Initiated|Completed)[:\s]*([A-Za-z0-9_\-.]+)/gi,
                /Calling\s+tool[:\s]*`([^`]+)`/gi,
                /Using\s+tool[:\s]*`([^`]+)`/gi,
              ];
              initiatedPatterns.forEach((pattern) => {
                for (const m of text.matchAll(pattern)) {
                  const candidate = (m[1] || '').trim();
                  const toolName = candidate.replace(/^['"`]+|['"`]+$/g, '');
                  if (toolName && toolName.length > 1) {
                    messageToolsInThisMessage.add(toolName);
                  }
                }
              });
            }

          });
        }

        // Check for message-level tool_calls
        if (message.tool_calls) {
          message.tool_calls.forEach((tool: any) => {
            if (tool.function?.name) {
              messageToolsInThisMessage.add(tool.function.name);
            }
          });
        }

        // Add all tools found in this message to the map
        messageToolsInThisMessage.forEach((toolName) => {
          const existing = toolMap.get(toolName) || { count: 0, responseTimes: [] };
          existing.count++;

          // Calculate response time if possible
          const messageIndex = conversation.messages.indexOf(message);
          if (messageIndex > 0) {
            const prevMessage = conversation.messages[messageIndex - 1];
            const currentTime = new Date(
              message.sentAt || message.created_at || message.createdAt
            ).getTime();
            const prevTime = new Date(
              prevMessage.sentAt || prevMessage.created_at || prevMessage.createdAt
            ).getTime();
            const responseTime = (currentTime - prevTime) / 1000;
            if (responseTime > 0 && responseTime < 300) {
              existing.responseTimes.push(responseTime);
            }
          }

          toolMap.set(toolName, existing);
        });
      });
    });

    // Filter out system/internal tools that aren't user-facing
    const systemTools = ['setWorkflows', 'controlPage', 'display_links'];
    
    const tools: ToolUsage[] = Array.from(toolMap.entries())
      .filter(([name]) => !systemTools.includes(name))
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgResponseTime:
          data.responseTimes.length > 0
            ? Math.round(
                (data.responseTimes.reduce((sum, t) => sum + t, 0) / data.responseTimes.length) *
                  100
              ) / 100
            : 0,
        responseTimes: data.responseTimes,
      }))
      .sort((a, b) => b.count - a.count);

    return tools;
  }, [fetchedConversations]);

  const workflowStats = useMemo(() => {
    const workflowMap = new Map<string, number>();

    fetchedConversations.forEach((conversation) => {
      const workflows = extractWorkflowsFromConversation(conversation);
      
      workflows.forEach((workflow) => {
        workflowMap.set(workflow, (workflowMap.get(workflow) || 0) + 1);
      });
    });

    const totalWorkflows = fetchedConversations.length;
    const workflows: WorkflowUsage[] = Array.from(workflowMap.entries())
      .map(([workflow, count]) => ({
        workflow,
        count,
        percentage: totalWorkflows > 0 ? Math.round((count / totalWorkflows) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return workflows;
  }, [fetchedConversations]);

  // Contact tool detection
  const contactTools = useMemo(() => {
    const isContactTool = (toolName: string) => {
      // Check for contact-related keywords in tool names
      const lowerName = toolName.toLowerCase();
      const contactKeywords = [
        'send-message-to-customer-service',
        'callback',
        'contact',
        'customer-service',
        'support',
      ];
      
      return contactKeywords.some((keyword) => lowerName.includes(keyword));
    };

    const contactToolNames = toolStats
      .filter((tool) => isContactTool(tool.name))
      .map((t) => t.name);

    console.log('[Contact Tools] All available tools:', toolStats.map(t => t.name));
    console.log('[Contact Tools] Found contact tool names:', contactToolNames);
    console.log('[Contact Tools] Total conversations:', fetchedConversations.length);

    const conversationsWithContactTools = fetchedConversations.filter((conversation, convIdx) => {
      // Check if any tools used in this conversation match contact tools
      const hasContactTool = conversation.messages?.some((message: any) => {
        const foundTools = new Set<string>();

        // Extract all tools from this message using the same comprehensive logic
        if (Array.isArray(message.content)) {
          message.content.forEach((content: any) => {
            // Direct tool properties
            if (content.tool_use?.name) foundTools.add(content.tool_use.name);
            if (content.tool_call?.name) foundTools.add(content.tool_call.name);
            if (content.kind === 'tool_use' && content.tool_name) foundTools.add(content.tool_name);
            if (content.type === 'tool_use' && content.name) foundTools.add(content.name);
            if (content.tool?.name) foundTools.add(content.tool.name);
            if (content.function_call?.name) foundTools.add(content.function_call.name);

            // Also extract from text content for system/status messages
            if (content.text || content.content) {
              const text = (content.text || content.content || '').toString();

              // Look for "**Tool Name:**" pattern
              const toolNamePattern = /\*\*Tool Name:\*\*\s*`([^`]+)`/gi;
              for (const match of text.matchAll(toolNamePattern)) {
                const toolName = match[1];
                if (toolName && toolName.length > 1) {
                  foundTools.add(toolName);
                }
              }

              // Look for "Tool Call Initiated" and similar patterns
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
                    foundTools.add(toolName);
                  }
                }
              });
            }
          });
        }

        if (message.tool_calls) {
          message.tool_calls.forEach((tool: any) => {
            if (tool.function?.name) foundTools.add(tool.function.name);
          });
        }

        // Check if any found tool matches contact tools OR contains contact keywords
        const matchesContact = Array.from(foundTools).some((toolName) => 
          contactToolNames.includes(toolName) || isContactTool(toolName)
        );

        if (matchesContact && convIdx < 3) {
          console.log(`[Contact Tools] Conv ${convIdx} found contact tools:`, Array.from(foundTools).filter(t => isContactTool(t)));
        }

        return matchesContact;
      });
      
      return hasContactTool;
    });

    const kontaktquote =
      fetchedConversations.length > 0
        ? Math.round((conversationsWithContactTools.length / fetchedConversations.length) * 10000) /
          100
        : 0;

    console.log('[Contact Tools] Kontaktquote:', kontaktquote, 'Conversations:', conversationsWithContactTools.length, '/', fetchedConversations.length);

    return {
      contactToolNames,
      conversationsWithContactTools,
      kontaktquote,
    };
  }, [toolStats, fetchedConversations]);

  // Travel agent tool detection (including workflow-travel-agent workflow)
  const travelAgentTools = useMemo(() => {
    const isTravelAgentTool = (toolName: string) => {
      const travelKeywords = [
        'travel',
        'booking',
        'flight',
        'hotel',
        'reservation',
        'trip',
        'destination',
        'agent',
        'offer',
        'basket',
      ];
      return travelKeywords.some((keyword) => toolName.toLowerCase().includes(keyword));
    };

    const travelToolNames = toolStats
      .filter((tool) => isTravelAgentTool(tool.name))
      .map((t) => t.name);
    
    console.log('[Travel Agent Tools] Found travel tool names:', travelToolNames);

    const conversationsWithTravelAgentTools = fetchedConversations.filter((conversation) => {
      // First check for workflow-travel-agent
      const workflows = extractWorkflowsFromConversation(conversation);
      if (workflows.has('workflow-travel-agent')) {
        return true;
      }

      // Then check for travel agent tools
      return conversation.messages?.some((message: any) => {
        const foundTools = new Set<string>();

        // Extract all tools from this message using the same comprehensive logic
        if (Array.isArray(message.content)) {
          message.content.forEach((content: any) => {
            if (content.tool_use?.name) foundTools.add(content.tool_use.name);
            if (content.tool_call?.name) foundTools.add(content.tool_call.name);
            if (content.kind === 'tool_use' && content.tool_name) foundTools.add(content.tool_name);
            if (content.type === 'tool_use' && content.name) foundTools.add(content.name);
            if (content.tool?.name) foundTools.add(content.tool.name);
            if (content.function_call?.name) foundTools.add(content.function_call.name);
          });
        }

        if (message.tool_calls) {
          message.tool_calls.forEach((tool: any) => {
            if (tool.function?.name) foundTools.add(tool.function.name);
          });
        }

        // Check if any found tool matches travel agent tools OR contains travel keywords
        return Array.from(foundTools).some((toolName) => 
          travelToolNames.includes(toolName) || isTravelAgentTool(toolName)
        );
      });
    });

    const travelAgentQuote =
      fetchedConversations.length > 0
        ? Math.round(
            (conversationsWithTravelAgentTools.length / fetchedConversations.length) * 10000
          ) / 100
        : 0;

    console.log('[Travel Agent Tools] travelAgentQuote:', travelAgentQuote, 'Conversations:', conversationsWithTravelAgentTools.length, '/', fetchedConversations.length);

    return {
      travelToolNames,
      conversationsWithTravelAgentTools,
      travelAgentQuote,
    };
  }, [toolStats, fetchedConversations, extractWorkflowsFromConversation]);

  return {
    toolStats,
    workflowStats,
    contactTools,
    travelAgentTools,
  };
}
