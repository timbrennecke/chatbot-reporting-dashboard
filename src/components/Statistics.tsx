import { useState } from 'react';
import { useToolAndWorkflowAnalysis } from '../hooks/useToolAndWorkflowAnalysis';
import { useStatisticsCalculations } from '../hooks/useStatisticsCalculations';
import { useStatisticsFetch } from '../hooks/useStatisticsFetch';
import { useDateRange } from '../hooks/useDateRange';
import type { Thread } from '../lib/types';
import type { ConversationData } from '../utils/statisticsUtils';
import {
  AdvancedMetrics,
  ChunkStatusModal,
  ConversationsChart,
  DateRangeFilter,
  ToolDetailsModal,
  ToolWorkflowSummary,
  WorkflowDetailsModal,
} from './statistics';

interface StatisticsProps {
  threads: Thread[];
  uploadedConversations?: ConversationData[];
}

export function Statistics({ threads, uploadedConversations = [] }: StatisticsProps) {
  const { startDate, setStartDate, endDate, setEndDate } = useDateRange();
  const { fetchedConversations, isLoading, error, loadingProgress, fetchConversationsForStats } =
    useStatisticsFetch();
  const { toolStats, workflowStats, contactTools, travelAgentTools } = useToolAndWorkflowAnalysis(fetchedConversations);

  const { conversationsPerDay, stats } = useStatisticsCalculations(
    threads,
    uploadedConversations,
    fetchedConversations,
    startDate,
    endDate,
    contactTools,
    travelAgentTools
  );

  // Modal state
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const [showChunkStatus, setShowChunkStatus] = useState(false);
  const [chunkStatuses, setChunkStatuses] = useState<Array<{ chunk: number; status: string; date: string }>>([]);

  const handleFetch = async () => {
    setChunkStatuses([]); // Reset chunk statuses
    await fetchConversationsForStats(startDate, endDate);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="px-8 py-12 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light text-gray-900 tracking-tight">Statistics</h1>
          <p className="text-sm text-gray-500 mt-2">Performance metrics and conversation analysis</p>
        </div>

        {/* Date Range Filter */}
        <div style={{ marginBottom: '60px' }}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onFetch={handleFetch}
            isLoading={isLoading}
            error={error}
            loadingProgress={loadingProgress}
            chunkStatuses={chunkStatuses}
            fetchStartTime={null}
          />
        </div>

        {/* Key Metrics Grid */}
        {stats.fetchedConversationsCount > 0 && (
          <div style={{ marginBottom: '80px' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Total Conversations */}
              <div className="md:col-span-2 p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">Total Conversations</p>
                <p className="text-2xl font-light text-gray-900 mb-1">{stats.fetchedConversationsCount.toLocaleString()}</p>
                <div style={{ width: '28px', height: '3px', backgroundColor: '#3b82f6', borderRadius: '2px', marginTop: '12px' }}></div>
              </div>

              {/* Contact Rate */}
              <div className="md:col-span-2 p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">Contact Rate</p>
                <p className="text-2xl font-light text-gray-900 mb-1">{stats.kontaktquote}%</p>
                <p className="text-xs text-gray-500 mb-3">{stats.conversationsWithContactTools} chats</p>
                <div style={{ width: '28px', height: '3px', backgroundColor: '#ef4444', borderRadius: '2px' }}></div>
              </div>

              {/* Error Rate */}
              <div className="md:col-span-2 p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">Error Rate</p>
                <p className="text-2xl font-light text-gray-900 mb-1">{stats.errorPercentage}%</p>
                <p className="text-xs text-gray-500 mb-3">{stats.conversationsWithErrors} errors</p>
                <div style={{ width: '28px', height: '3px', backgroundColor: '#dc2626', borderRadius: '2px' }}></div>
              </div>

              {/* Daily Average */}
              <div className="p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Avg/Day</p>
                <p className="text-2xl font-light text-gray-900">{stats.avgConversationsPerDay}</p>
              </div>

              {/* Active Days */}
              <div className="p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Active Days</p>
                <p className="text-2xl font-light text-gray-900">{stats.activeDays}</p>
              </div>

              {/* Peak Day */}
              <div className="p-6 rounded-lg border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Peak Day</p>
                <p className="text-2xl font-light text-gray-900">{stats.peakDay.conversations}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{stats.peakDay.formattedDate}</p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Metrics */}
        {stats.fetchedConversationsCount > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-900">Performance Metrics</h2>
            </div>
            <AdvancedMetrics stats={stats} />
          </div>
        )}

        {/* Tool & Workflow Analysis */}
        {stats.fetchedConversationsCount > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-900">Tools & Workflows</h2>
            </div>
            <ToolWorkflowSummary
              toolCount={toolStats.length}
              workflowCount={workflowStats.length}
              onShowToolDetails={() => setShowToolDetails(true)}
              onShowWorkflowDetails={() => setShowWorkflowDetails(true)}
            />
          </div>
        )}

        {/* Conversations Chart */}
        {conversationsPerDay.length > 0 && stats.fetchedConversationsCount > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium text-gray-900">Conversation Activity</h2>
              {chunkStatuses.length > 0 && (
                <button
                  onClick={() => setShowChunkStatus(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg"
                  style={{ 
                    backgroundColor: 'transparent',
                    transition: 'all 0.2s ease-in-out',
                    border: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Chunk Status ({chunkStatuses.length})
                </button>
              )}
            </div>
            <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
              <ConversationsChart data={conversationsPerDay} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && stats.fetchedConversationsCount === 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-light text-gray-900 mb-2">No data yet</h3>
              <p className="text-sm text-gray-500">
                Select a date range and click "Analyze Data" to see your statistics.
              </p>
            </div>
          </div>
        )}

        {/* Modals */}
        <ToolDetailsModal
          isOpen={showToolDetails}
          onClose={() => setShowToolDetails(false)}
          tools={toolStats}
        />
        <WorkflowDetailsModal
          isOpen={showWorkflowDetails}
          onClose={() => setShowWorkflowDetails(false)}
          workflows={workflowStats}
        />
        {showChunkStatus && (
          <ChunkStatusModal
            isOpen={showChunkStatus}
            onClose={() => setShowChunkStatus(false)}
            chunkStatuses={chunkStatuses}
          />
        )}
      </div>
    </div>
  );
}
