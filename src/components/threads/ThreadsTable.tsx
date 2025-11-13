/**
 * Threads table component with pagination
 */

import type { Thread } from '../../lib/types';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../ui/table';
import { ThreadRow } from './ThreadRow';

interface ThreadsTableProps {
  threads: Thread[];
  viewedThreads: Set<string>;
  viewedConversations: Set<string>;
  conversationDataMap: Map<string, unknown>;
  savedConversationIds: Set<string>;
  onConversationView: (conversationId: string, threadId: string) => void;
  checkThreadHasError: (thread: Thread) => boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
}

export function ThreadsTable({
  threads,
  viewedThreads,
  viewedConversations,
  conversationDataMap,
  savedConversationIds,
  onConversationView,
  checkThreadHasError,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
}: ThreadsTableProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedThreads = threads.slice(startIndex, startIndex + itemsPerPage);

  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-light text-gray-900 mb-2">No threads found</h3>
          <p className="text-sm text-gray-500">Try adjusting your search criteria or filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        <div className="overflow-x-auto">
          <Table>
            <colgroup>
              <col style={{ width: '1fr', minWidth: '200px' }} />
              <col style={{ width: '360px', minWidth: '360px' }} />
              <col style={{ width: '170px', minWidth: '170px' }} />
              <col style={{ width: '60px', minWidth: '60px' }} />
              <col style={{ width: '70px', minWidth: '70px' }} />
              <col style={{ width: '90px', minWidth: '90px' }} />
              <col style={{ width: '90px', minWidth: '90px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="px-4">First User Message</TableHead>
                <TableHead className="px-4">Conversation ID</TableHead>
                <TableHead className="px-4">Created At</TableHead>
                <TableHead className="px-3 text-right">UI</TableHead>
                <TableHead className="px-3 text-right">Msgs</TableHead>
                <TableHead className="px-3 text-right">Duration</TableHead>
                <TableHead className="px-3 text-right">Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedThreads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isThreadViewed={viewedThreads.has(thread.id)}
                  isConversationViewed={viewedConversations.has(thread.conversationId)}
                  hasConversationData={conversationDataMap.has(thread.conversationId)}
                  isSaved={savedConversationIds.has(thread.conversationId)}
                  hasError={checkThreadHasError(thread)}
                  onConversationView={() => onConversationView(thread.conversationId, thread.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, threads.length)} of{' '}
            {threads.length} threads
          </div>
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious onClick={() => onPageChange(currentPage - 1)} />
                </PaginationItem>
              )}

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => onPageChange(pageNum)}
                      isActive={currentPage === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext onClick={() => onPageChange(currentPage + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
