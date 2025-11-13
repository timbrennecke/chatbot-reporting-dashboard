/**
 * ThreadsOverview - Main component for displaying and managing threads
 * Refactored to use custom hooks and smaller components
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useThreadAnalysis } from '../hooks/useThreadAnalysis';
import { useFilteredThreads, useThreadFilters } from '../hooks/useThreadFilters';
import { useThreadsData } from '../hooks/useThreadsData';
import { useViewedThreads } from '../hooks/useViewedThreads';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';
import type { ConversationData, ThreadsOverviewProps } from '../lib/threadTypes';
import type { Thread } from '../lib/types';
import { IntentAnalysis } from './IntentAnalysis';
import { ChunkStatusModal } from './statistics/index';
import { DateRangeSelector, FilterPanel, ThreadsTable } from './threads/index';

const ITEMS_PER_PAGE = 20;

export function ThreadsOverview({
  uploadedThreads,
  onThreadSelect,
  onConversationSelect,
  onFetchedConversationsChange,
  onThreadOrderChange,
  onConversationViewed,
  onThreadsChange,
  savedConversationIds = new Set(),
}: ThreadsOverviewProps) {
  // Date range state
  const [startDate, setStartDate] = useState<string>(() => {
    const saved = getEnvironmentSpecificItem('threads-search-start-date');
    if (saved && typeof saved === 'string') {
      return saved;
    }

    // Default: 1 hour ago
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60 * 1000);
    return formatDateTimeLocal(startTime);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const saved = getEnvironmentSpecificItem('threads-search-end-date');
    if (saved && typeof saved === 'string') {
      return saved;
    }

    return formatDateTimeLocal(new Date());
  });

  // Chunk status modal
  const [showChunkStatus, setShowChunkStatus] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Fetched conversations map
  const [fetchedConversationsMap, _setFetchedConversationsMap] = useState<
    Map<string, ConversationData>
  >(new Map());

  // Custom hooks
  const { threads, loading, error, finalChunkStatuses, hasSearched, fetchThreads, loadingProgress, currentChunkStatuses } = useThreadsData(
    { uploadedThreads, onThreadsChange }
  );

  const filters = useThreadFilters();
  const filteredThreads = useFilteredThreads({ threads, filters });

  const { viewedThreads, viewedConversations, markThreadAsViewed, markConversationAsViewed } =
    useViewedThreads(onConversationViewed);

  const {
    toolsWithCounts,
    workflowsWithCounts,
    totalThreadsWithErrors,
    totalThreadsWithTimeouts,
    availableTopics,
  } = useThreadAnalysis(threads);

  // Notify parent of fetched conversations changes
  useEffect(() => {
    if (onFetchedConversationsChange) {
      onFetchedConversationsChange(fetchedConversationsMap);
    }
  }, [fetchedConversationsMap, onFetchedConversationsChange]);

  // Update thread order for navigation
  useEffect(() => {
    if (filteredThreads.length > 0 && onThreadOrderChange) {
      const uniqueConversationIds = Array.from(
        new Set(filteredThreads.map((thread) => thread.conversationId))
      );
      onThreadOrderChange(uniqueConversationIds);
    }
  }, [filteredThreads, onThreadOrderChange]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, []);

  // Save date range to storage
  useEffect(() => {
    if (startDate && typeof startDate === 'string') {
      setEnvironmentSpecificItem('threads-search-start-date', startDate);
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate && typeof endDate === 'string') {
      setEnvironmentSpecificItem('threads-search-end-date', endDate);
    }
  }, [endDate]);

  // Quick time range filter
  const setTimeRange = useCallback((hours: number) => {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setCurrentPage(1);
    setStartDate(formatDateTimeLocal(startTime));
    setEndDate(formatDateTimeLocal(now));
  }, []);

  // Get active quick filter
  const activeQuickFilter = useMemo(() => {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));

    const now = new Date();
    const isEndTimeNow = Math.abs(end.getTime() - now.getTime()) < 2 * 60 * 1000;

    if (isEndTimeNow) {
      const quickFilters = [1, 24, 72, 168];
      return quickFilters.includes(diffHours) ? diffHours : null;
    }

    return null;
  }, [startDate, endDate]);

  // Handle conversation view
  const handleConversationView = useCallback(
    (conversationId: string, threadId: string) => {
      markThreadAsViewed(threadId);
      markConversationAsViewed(conversationId);

      if (onThreadSelect) {
        const thread = threads.find((t) => t.id === threadId);
        if (thread) {
          onThreadSelect(thread);
        }
      }

      if (onConversationSelect) {
        const position = filteredThreads.findIndex((t) => t.conversationId === conversationId);
        onConversationSelect(conversationId, position >= 0 ? position : undefined);
      }
    },
    [
      threads,
      filteredThreads,
      markThreadAsViewed,
      markConversationAsViewed,
      onThreadSelect,
      onConversationSelect,
    ]
  );

  // Check if thread has errors
  const checkThreadHasError = useCallback((thread: Thread): boolean => {
    let hasErrorFound = false;
    let debugInfo: Array<{ message: string; content: string; pattern: string; matchedText?: string }> = [];

    thread.messages.some((message) => {
      if (message.role === 'system' || message.role === 'status') {
        return message.content.some((content) => {
          const text = content.text || content.content || '';
          
          // More specific error patterns to reduce false positives
          const errorPatterns = [
            { pattern: /Agent execution error/gi, name: 'Agent execution error' },
            { pattern: /\b(Error|Failed|Exception)\b\s+\S/gi, name: 'Error/Failed/Exception with message' },  // "Error something", "Failed something", "Exception something"
            { pattern: /\b(Connection|Network|Timeout)\s+error/gi, name: 'Connection/Network/Timeout error' },
            { pattern: /\bUnauthorized\b/gi, name: 'Unauthorized' },
            { pattern: /\bForbidden\b/gi, name: 'Forbidden' },
            { pattern: /\b404\b/gi, name: '404 Not Found' },
            { pattern: /\b500\b/gi, name: '500 Error' },
            { pattern: /\bPermission\s+denied/gi, name: 'Permission denied' },
          ];

          const found = errorPatterns.some((item) => {
            const match = text.match(item.pattern);
            if (match) {
              debugInfo.push({
                message: `Thread ${thread.id}`,
                content: text.slice(0, 150),
                pattern: item.name,
                matchedText: match[0],
              });
              hasErrorFound = true;
              return true;
            }
            return false;
          });

          return found;
        });
      }
      return false;
    });

    // Error detection complete

    return hasErrorFound;
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-light text-gray-900 tracking-tight">Threads Overview</h1>
          <p className="text-sm text-gray-500 mt-2">
            Search, filter, and analyze conversation threads
          </p>
        </div>

        {/* Date Range Selector */}
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onFetch={() => {
            setCurrentPage(1);
            fetchThreads(startDate, endDate);
          }}
          loading={loading}
          error={error}
          activeQuickFilter={activeQuickFilter}
          onQuickFilterClick={setTimeRange}
          loadingProgress={loadingProgress}
          chunkStatuses={currentChunkStatuses}
        />

        {/* Show topic analysis and filters only if we have threads */}
        {threads.length > 0 && (
          <>
            {/* Topic Analysis Cards */}
            <IntentAnalysis
              threads={threads}
              onTopicClick={(topic) => filters.setSelectedTopic(topic)}
              selectedTopic={filters.selectedTopic}
            />

            {/* Filter Panel and Threads Table in White Container */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
              {/* Filter Panel */}
              <div className="p-6">
                <FilterPanel
                  searchTerm={filters.searchTerm}
                  onSearchTermChange={filters.setSearchTerm}
                  hasUiFilter={filters.hasUiFilter}
                  onHasUiFilterChange={filters.setHasUiFilter}
                  showErrorsOnly={filters.showErrorsOnly}
                  onShowErrorsOnlyChange={filters.setShowErrorsOnly}
                  showTimeoutsOnly={filters.showTimeoutsOnly}
                  onShowTimeoutsOnlyChange={filters.setShowTimeoutsOnly}
                  totalThreadsWithErrors={totalThreadsWithErrors}
                  totalThreadsWithTimeouts={totalThreadsWithTimeouts}
                  selectedTopic={filters.selectedTopic}
                  onSelectedTopicChange={filters.setSelectedTopic}
                  availableTopics={availableTopics}
                  toolsWithCounts={toolsWithCounts}
                  selectedTools={filters.selectedTools}
                  onToggleTool={filters.toggleTool}
                  workflowsWithCounts={workflowsWithCounts}
                  selectedWorkflows={filters.selectedWorkflows}
                  onToggleWorkflow={filters.toggleWorkflow}
                  minMessages={filters.minMessages}
                  maxMessages={filters.maxMessages}
                  minDuration={filters.minDuration}
                  maxDuration={filters.maxDuration}
                  minResponseTime={filters.minResponseTime}
                  maxResponseTime={filters.maxResponseTime}
                  onMinMessagesChange={filters.setMinMessages}
                  onMaxMessagesChange={filters.setMaxMessages}
                  onMinDurationChange={filters.setMinDuration}
                  onMaxDurationChange={filters.setMaxDuration}
                  onMinResponseTimeChange={filters.setMinResponseTime}
                  onMaxResponseTimeChange={filters.setMaxResponseTime}
                  messageSearchEnabled={filters.messageSearchEnabled}
                  onMessageSearchEnabledChange={filters.setMessageSearchEnabled}
                  messageSearchTerm={filters.messageSearchTerm}
                  onMessageSearchTermChange={filters.setMessageSearchTerm}
                  messageRoles={filters.messageRoles}
                  onToggleMessageRole={filters.toggleMessageRole}
                  activeFilterCount={filters.activeFilterCount}
                  onClearFilters={filters.clearAllFilters}
                  filteredThreadsCount={filteredThreads.length}
                />
              </div>

              {/* Threads Table */}
              <div className="p-6 pt-0">
                <ThreadsTable
                  threads={filteredThreads}
                  viewedThreads={viewedThreads}
                  viewedConversations={viewedConversations}
                  conversationDataMap={fetchedConversationsMap}
                  savedConversationIds={savedConversationIds}
                  onConversationView={handleConversationView}
                  checkThreadHasError={checkThreadHasError}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </div>
          </>
        )}

        {/* Empty state - not searched yet */}
        {!loading && !hasSearched && threads.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-light text-gray-900 mb-2">Ready to search</h3>
              <p className="text-sm text-gray-500">
                Select a date range and click "Search Threads" to load conversations.
              </p>
            </div>
          </div>
        )}

        {/* Empty state - searched but no results */}
        {!loading && hasSearched && threads.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-light text-gray-900 mb-2">No threads found</h3>
              <p className="text-sm text-gray-500">
                The selected date range returned no results. Try adjusting your dates or clearing
                filters.
              </p>
            </div>
          </div>
        )}

        {/* Chunk Status Modal */}
        {showChunkStatus && (
          <ChunkStatusModal
            isOpen={showChunkStatus}
            onClose={() => setShowChunkStatus(false)}
            chunkStatuses={finalChunkStatuses}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to format date for datetime-local input
 */
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
