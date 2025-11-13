/**
 * Compact filter panel with horizontal button layout
 */

import { ChevronDown, Filter, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ToolWithCount, WorkflowWithCount } from '../../lib/threadTypes';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface FilterPanelProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  hasUiFilter: boolean;
  onHasUiFilterChange: (value: boolean) => void;
  showErrorsOnly: boolean;
  onShowErrorsOnlyChange: (value: boolean) => void;
  showTimeoutsOnly: boolean;
  onShowTimeoutsOnlyChange: (value: boolean) => void;
  totalThreadsWithErrors: number;
  totalThreadsWithTimeouts: number;
  selectedTopic: string;
  onSelectedTopicChange: (value: string) => void;
  availableTopics: string[];
  toolsWithCounts: ToolWithCount[];
  selectedTools: Set<string>;
  onToggleTool: (tool: string) => void;
  workflowsWithCounts: WorkflowWithCount[];
  selectedWorkflows: Set<string>;
  onToggleWorkflow: (workflow: string) => void;
  minMessages: number | '';
  maxMessages: number | '';
  minDuration: number | '';
  maxDuration: number | '';
  minResponseTime: number | '';
  maxResponseTime: number | '';
  onMinMessagesChange: (value: number | '') => void;
  onMaxMessagesChange: (value: number | '') => void;
  onMinDurationChange: (value: number | '') => void;
  onMaxDurationChange: (value: number | '') => void;
  onMinResponseTimeChange: (value: number | '') => void;
  onMaxResponseTimeChange: (value: number | '') => void;
  messageSearchEnabled: boolean;
  onMessageSearchEnabledChange: (value: boolean) => void;
  messageSearchTerm: string;
  onMessageSearchTermChange: (value: string) => void;
  messageRoles: Set<'user' | 'assistant'>;
  onToggleMessageRole: (role: 'user' | 'assistant') => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  filteredThreadsCount: number;
}

export function FilterPanel({
  searchTerm,
  onSearchTermChange,
  hasUiFilter,
  onHasUiFilterChange,
  showErrorsOnly,
  onShowErrorsOnlyChange,
  showTimeoutsOnly,
  onShowTimeoutsOnlyChange,
  totalThreadsWithErrors,
  totalThreadsWithTimeouts,
  selectedTopic,
  onSelectedTopicChange,
  toolsWithCounts,
  selectedTools,
  onToggleTool,
  workflowsWithCounts,
  selectedWorkflows,
  onToggleWorkflow,
  minMessages,
  maxMessages,
  minDuration,
  maxDuration,
  minResponseTime,
  maxResponseTime,
  onMinMessagesChange,
  onMaxMessagesChange,
  onMinDurationChange,
  onMaxDurationChange,
  onMinResponseTimeChange,
  onMaxResponseTimeChange,
  messageSearchEnabled,
  onMessageSearchEnabledChange,
  messageSearchTerm,
  onMessageSearchTermChange,
  messageRoles,
  onToggleMessageRole,
  filteredThreadsCount,
}: FilterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const workflowsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
      if (workflowsRef.current && !workflowsRef.current.contains(event.target as Node)) {
        setWorkflowsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div>
      {/* Thread Count Display */}
      <div className="flex items-center justify-between pb-3 pt-3 px-4">
        <h3 className="text-lg font-medium text-gray-900">Threads ({filteredThreadsCount})</h3>
        {/* Selected Topic Badge */}
        {selectedTopic && (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm">
              Topic: {selectedTopic}
            </Badge>
            <button
              type="button"
              onClick={() => onSelectedTopicChange('')}
              className="text-gray-500 hover:text-gray-700"
              title="Clear topic filter"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search and Filter Buttons Row */}
      <div className="flex flex-wrap items-center gap-2 p-0">
        {/* Search Input */}
        <div className="w-[170px]">
          <Input
            placeholder="Search by thread ID or conversation ID"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Search Message Content Checkbox */}
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md h-9 bg-white">
          <Checkbox
            id="message-search"
            checked={messageSearchEnabled}
            onCheckedChange={(checked: boolean) => onMessageSearchEnabledChange(checked)}
          />
          <Label htmlFor="message-search" className="text-sm cursor-pointer">
            Search Message Content
          </Label>
        </div>

        {/* Has UI Components Checkbox */}
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md h-9 bg-white">
          <Checkbox
            id="has-ui-filter"
            checked={hasUiFilter}
            onCheckedChange={(checked: boolean) => onHasUiFilterChange(checked)}
          />
          <Label htmlFor="has-ui-filter" className="text-sm cursor-pointer">
            Has UI Components
          </Label>
        </div>

        {/* Advanced Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="h-9 bg-white"
        >
          <Filter className="h-4 w-4 mr-2" />
          Advanced Filters
          <ChevronDown
            className={`h-4 w-4 ml-2 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </Button>

        {/* Tools Dropdown */}
        {toolsWithCounts.length > 0 && (
          <div className="relative" ref={toolsRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setToolsOpen(!toolsOpen)}
              className="h-9 bg-white"
            >
              <Filter className="h-4 w-4 mr-2" />
              Tools
              {selectedTools.size > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {selectedTools.size}
                </Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 ml-2 transition-transform ${toolsOpen ? 'rotate-180' : ''}`}
              />
            </Button>
            {toolsOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-50 w-64 border border-gray-300 rounded-lg shadow-xl"
                style={{ backgroundColor: '#ffffff', maxHeight: '400px', overflowY: 'auto' }}
              >
                <div className="p-2" style={{ backgroundColor: '#ffffff' }}>
                  {toolsWithCounts.map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded w-full text-left"
                      style={{ backgroundColor: '#ffffff' }}
                      onClick={() => onToggleTool(tool.name)}
                    >
                      <Checkbox checked={selectedTools.has(tool.name)} />
                      <span className="text-sm flex-1">{tool.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {tool.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workflows Dropdown */}
        {workflowsWithCounts.length > 0 && (
          <div className="relative" ref={workflowsRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorkflowsOpen(!workflowsOpen)}
              className="h-9 bg-white"
            >
              <Filter className="h-4 w-4 mr-2" />
              Workflows
              {selectedWorkflows.size > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {selectedWorkflows.size}
                </Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 ml-2 transition-transform ${workflowsOpen ? 'rotate-180' : ''}`}
              />
            </Button>
            {workflowsOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-50 w-64 border border-gray-300 rounded-lg shadow-xl"
                style={{ backgroundColor: '#ffffff', maxHeight: '400px', overflowY: 'auto' }}
              >
                <div className="p-2" style={{ backgroundColor: '#ffffff' }}>
                  {workflowsWithCounts.map((workflow) => (
                    <button
                      key={workflow.name}
                      type="button"
                      className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded w-full text-left"
                      style={{ backgroundColor: '#ffffff' }}
                      onClick={() => onToggleWorkflow(workflow.name)}
                    >
                      <Checkbox checked={selectedWorkflows.has(workflow.name)} />
                      <span className="text-sm flex-1">{workflow.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {workflow.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show Errors Only Button */}
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md h-9 bg-white">
          <Checkbox
            id="show-errors-only"
            checked={showErrorsOnly}
            onCheckedChange={(checked: boolean) => onShowErrorsOnlyChange(checked)}
          />
          <Label htmlFor="show-errors-only" className="text-sm cursor-pointer">
            Show errors only
          </Label>
          {totalThreadsWithErrors > 0 && (
            <Badge variant="destructive" className="h-5 px-2 text-xs">
              {totalThreadsWithErrors}
            </Badge>
          )}
        </div>

        {/* Show Timeouts Only Button (optional) */}
        {totalThreadsWithTimeouts > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md h-9 bg-white">
            <Checkbox
              id="show-timeouts-only"
              checked={showTimeoutsOnly}
              onCheckedChange={(checked: boolean) => onShowTimeoutsOnlyChange(checked)}
            />
            <Label htmlFor="show-timeouts-only" className="text-sm cursor-pointer">
              Show timeouts only
            </Label>
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {totalThreadsWithTimeouts}
            </Badge>
          </div>
        )}
      </div>

      {/* Message Search Input - shown when checkbox is enabled */}
      {messageSearchEnabled && (
        <div className="py-3 space-y-3">
          <Input
            placeholder="Search within messages..."
            value={messageSearchTerm}
            onChange={(e) => onMessageSearchTermChange(e.target.value)}
            className="h-9 mt-3"
          />
          
          {/* Message Role Filters */}
          <div className="flex gap-3 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="search-user-messages"
                checked={messageRoles.has('user')}
                onCheckedChange={() => onToggleMessageRole('user')}
              />
              <Label htmlFor="search-user-messages" className="text-sm cursor-pointer">
                User messages
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="search-assistant-messages"
                checked={messageRoles.has('assistant')}
                onCheckedChange={() => onToggleMessageRole('assistant')}
              />
              <Label htmlFor="search-assistant-messages" className="text-sm cursor-pointer">
                Assistant messages
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {advancedOpen && (
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Advanced Filters</h4>
            <button
              type="button"
              onClick={() => setAdvancedOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            {/* Numeric Filters */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="min-messages" className="text-xs">
                  Min Messages
                </Label>
                <Input
                  id="min-messages"
                  type="number"
                  placeholder="0"
                  value={minMessages}
                  onChange={(e) =>
                    onMinMessagesChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label htmlFor="max-messages" className="text-xs">
                  Max Messages
                </Label>
                <Input
                  id="max-messages"
                  type="number"
                  placeholder="999"
                  value={maxMessages}
                  onChange={(e) =>
                    onMaxMessagesChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label htmlFor="min-duration" className="text-xs">
                  Min Duration (s)
                </Label>
                <Input
                  id="min-duration"
                  type="number"
                  placeholder="0"
                  value={minDuration}
                  onChange={(e) =>
                    onMinDurationChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label htmlFor="max-duration" className="text-xs">
                  Max Duration (s)
                </Label>
                <Input
                  id="max-duration"
                  type="number"
                  placeholder="999"
                  value={maxDuration}
                  onChange={(e) =>
                    onMaxDurationChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label htmlFor="min-response-time" className="text-xs">
                  Min Response (s)
                </Label>
                <Input
                  id="min-response-time"
                  type="number"
                  placeholder="0"
                  value={minResponseTime}
                  onChange={(e) =>
                    onMinResponseTimeChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label htmlFor="max-response-time" className="text-xs">
                  Max Response (s)
                </Label>
                <Input
                  id="max-response-time"
                  type="number"
                  placeholder="999"
                  value={maxResponseTime}
                  onChange={(e) =>
                    onMaxResponseTimeChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 h-8"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
