/**
 * ThreadsOverview - Main component for displaying and managing threads
 * Refactored to use custom hooks and smaller components
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useThreadsData } from '../hooks/useThreadsData';
import { useThreadFilters, useFilteredThreads } from '../hooks/useThreadFilters';
import { useThreadSelection } from '../hooks/useThreadSelection';
import { useViewedThreads } from '../hooks/useViewedThreads';
import { useBulkOperations } from '../hooks/useBulkOperations';
import { useThreadAnalysis } from '../hooks/useThreadAnalysis';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';
import type { ThreadsOverviewProps, ConversationData } from '../lib/threadTypes';
import type { Thread } from '../lib/types';
import {
  DateRangeSelector,
  FilterPanel,
  BulkActions,
  ThreadsTable,
} from './threads/index';
import { ChunkStatusModal } from './statistics/index';

const ITEMS_PER_PAGE = 20;

export function ThreadsOverview({
  uploadedThreads,
  uploadedConversations = [],
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
    if (saved && typeof saved === 'string') return saved;
    
    // Default: 1 hour ago
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60 * 1000);
    return formatDateTimeLocal(startTime);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const saved = getEnvironmentSpecificItem('threads-search-end-date');
    if (saved && typeof saved === 'string') return saved;
    
    return formatDateTimeLocal(new Date());
  });

  // Chunk status modal
  const [showChunkStatus, setShowChunkStatus] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Fetched conversations map
  const [fetchedConversationsMap, setFetchedConversationsMap] = useState<Map<string, ConversationData>>(
    new Map()
  );

  // Custom hooks
  const { 
    threads, 
    loading, 
    error, 
    setError,
    loadingProgress, 
    chunkStatuses, 
    finalChunkStatuses,
    hasSearched,
    fetchThreads,
    buttonClicked,
  } = useThreadsData({ uploadedThreads, onThreadsChange });

  const filters = useThreadFilters();
  const filteredThreads = useFilteredThreads({ threads, filters });

  const { selectedThreads, toggleThreadSelection, toggleAllThreads, isAllSelected } = useThreadSelection();

  const { 
    viewedThreads, 
    viewedConversations, 
    markThreadAsViewed, 
    markConversationAsViewed,
    isThreadViewed,
    isConversationViewed,
  } = useViewedThreads(onConversationViewed);

  const { bulkLoading, bulkResults, bulkError, fetchBulkAttributes } = useBulkOperations();

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
  }, [filters.searchTerm, filters.selectedTools.size, filters.selectedWorkflows.size]);

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
  }, []);

  // Handle bulk attribute fetch
  const handleBulkAttributeFetch = useCallback(() => {
    const threadIds = Array.from(selectedThreads);
    fetchBulkAttributes(threadIds);
  }, [selectedThreads, fetchBulkAttributes]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreads.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
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
          onFetch={() => fetchThreads(startDate, endDate)}
          loading={loading}
          error={error}
          activeQuickFilter={activeQuickFilter}
          onQuickFilterClick={setTimeRange}
        />

        {/* Show filters only after search */}
        {(hasSearched || threads.length > 0) && (
          <>
            {/* Bulk Actions */}
            <BulkActions
              selectedCount={selectedThreads.size}
              onFetchAttributes={handleBulkAttributeFetch}
              bulkLoading={bulkLoading}
              bulkResults={bulkResults}
              bulkError={bulkError}
            />

            {/* Filter Panel */}
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
              activeFilterCount={filters.activeFilterCount}
              onClearFilters={filters.clearAllFilters}
              filteredThreadsCount={filteredThreads.length}
            />

            {/* Threads Table */}
            <ThreadsTable
              threads={filteredThreads}
              selectedThreads={selectedThreads}
              onToggleSelection={toggleThreadSelection}
              onToggleAll={() => toggleAllThreads(filteredThreads.map((t) => t.id))}
              isAllSelected={isAllSelected(filteredThreads.map((t) => t.id))}
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
          </>
        )}

        {/* Empty state */}
        {!loading && !hasSearched && threads.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-light text-gray-900 mb-2">No data yet</h3>
              <p className="text-sm text-gray-500">
                Select a date range and click "Search Threads" to get started.
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

