import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { 
  Bookmark, 
  BookmarkX, 
  Search, 
  MessageSquare,
  Clock,
  ExternalLink,
  Copy,
  Trash2,
  Download
} from 'lucide-react';
import { Conversation, Thread } from '../lib/types';
import { formatTimestamp } from '../lib/utils';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem, api, getApiBaseUrl } from '../lib/api';

interface SavedChatsProps {
  savedConversationIds: string[];
  uploadedConversations?: Conversation[];
  uploadedThreads?: Thread[];
  fetchedConversationsMap?: Map<string, any>;
  onConversationSelect?: (conversationId: string, position?: number, sortedOrder?: string[]) => void;
  onUnsaveChat?: (conversationId: string) => void;
  onNotesChange?: (conversationId: string, notes: string) => void;
  onClearAllSaved?: () => void;
  onConversationFetched?: (conversation: any) => void;
}

interface SavedChatItem {
  conversationId: string;
  conversation?: Conversation;
  thread?: Thread;
  fetchedData?: any;
  title: string;
  createdAt: string;
  messageCount?: number;
  hasUI?: boolean;
  hasLinkout?: boolean;
  notes?: string;
}

export function SavedChats({
  savedConversationIds,
  uploadedConversations = [],
  uploadedThreads = [],
  fetchedConversationsMap = new Map(),
  onConversationSelect,
  onUnsaveChat,
  onNotesChange,
  onClearAllSaved,
  onConversationFetched
}: SavedChatsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Fetch missing conversation details
  useEffect(() => {
    const fetchMissingConversations = async () => {
      if (!savedConversationIds.length || !onConversationFetched) return;
      
      const missingConversationIds = savedConversationIds.filter(id => {
        // Check if we already have this conversation's details
        const hasUploadedConv = uploadedConversations.some(conv => conv.id === id);
        const hasUploadedThread = uploadedThreads.some(thread => thread.conversationId === id);
        const hasFetchedData = fetchedConversationsMap.has(id);
        
        return !hasUploadedConv && !hasUploadedThread && !hasFetchedData;
      });
      
      if (missingConversationIds.length === 0) return;
      
      console.log('🔍 Fetching missing conversation details for saved chats:', missingConversationIds.length, 'conversations');
      
      // Fetch conversations in parallel
      const fetchPromises = missingConversationIds.map(async (conversationId) => {
        try {
          const baseUrl = getApiBaseUrl();
          const response = await api.get(`${baseUrl}/conversation/${conversationId}`);
          if (response.data) {
            console.log('✅ Fetched conversation details for saved chat:', conversationId, response.data.title || 'No title');
            onConversationFetched(response.data);
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch conversation details for saved chat:', conversationId, error);
        }
      });
      
      await Promise.all(fetchPromises);
    };
    
    fetchMissingConversations();
  }, [savedConversationIds, uploadedConversations, uploadedThreads, fetchedConversationsMap, onConversationFetched]);
  
  // Notes state - environment-specific
  const [notes, setNotes] = useState<Map<string, string>>(() => {
    try {
      const savedNotes = getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes');
      if (savedNotes) {
        const notesData = JSON.parse(savedNotes);
        return new Map(Object.entries(notesData));
      }
    } catch (error) {
      console.error('Failed to load saved chat notes:', error);
    }
    return new Map();
  });

  // Save notes to localStorage
  const saveNotesToStorage = (notesMap: Map<string, string>) => {
    try {
      const notesObject = Object.fromEntries(notesMap);
      setEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes', JSON.stringify(notesObject));
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error);
    }
  };

  // Update notes for a specific conversation
  const updateNotes = (conversationId: string, noteText: string) => {
    const newNotes = new Map(notes);
    if (noteText.trim()) {
      newNotes.set(conversationId, noteText);
    } else {
      newNotes.delete(conversationId);
    }
    setNotes(newNotes);
    saveNotesToStorage(newNotes);
    onNotesChange?.(conversationId, noteText);
  };

  // Create saved chat items by combining data from all sources
  const savedChatItems = useMemo((): SavedChatItem[] => {
    return savedConversationIds.map(conversationId => {
      // Try to find conversation data from uploaded conversations
      const uploadedConversation = uploadedConversations.find(conv => conv.id === conversationId);
      
      // Try to find thread data from uploaded threads
      const uploadedThread = uploadedThreads.find(thread => thread.conversationId === conversationId);
      
      // Try to find fetched data
      const fetchedData = fetchedConversationsMap.get(conversationId);

      // Determine title and other metadata
      let title = 'Untitled Conversation';
      let createdAt = new Date().toISOString();
      let messageCount = 0;
      let hasUI = false;
      let hasLinkout = false;

      if (uploadedConversation) {
        title = uploadedConversation.title || `Conversation ${conversationId.slice(0, 8)}`;
        createdAt = uploadedConversation.createdAt || createdAt;
        messageCount = uploadedConversation.messages?.length || 0;
      } else if (uploadedThread) {
        title = `Thread ${conversationId.slice(0, 8)}`;
        createdAt = uploadedThread.createdAt || createdAt;
        messageCount = uploadedThread.messages?.length || 0;
        
        // Check for UI and linkout in thread messages
        hasUI = uploadedThread.messages?.some(msg => 
          msg.content?.some(content => content.type === 'ui')
        ) || false;
        hasLinkout = uploadedThread.messages?.some(msg => 
          msg.content?.some(content => content.type === 'linkout')
        ) || false;
      } else if (fetchedData) {
        title = fetchedData.title || `Conversation ${conversationId.slice(0, 8)}`;
        createdAt = fetchedData.createdAt || createdAt;
        messageCount = fetchedData.messages?.length || 0;
      } else {
        title = `Conversation ${conversationId.slice(0, 8)}`;
      }

      return {
        conversationId,
        conversation: uploadedConversation,
        thread: uploadedThread,
        fetchedData,
        title,
        createdAt,
        messageCount,
        hasUI,
        hasLinkout,
        notes: notes.get(conversationId) || ''
      };
    });
  }, [savedConversationIds, uploadedConversations, uploadedThreads, fetchedConversationsMap, notes]);

  // Filter saved chats based on search term
  const filteredSavedChats = useMemo(() => {
    if (!searchTerm.trim()) return savedChatItems;
    
    const searchLower = searchTerm.toLowerCase();
    return savedChatItems.filter(item =>
      item.title.toLowerCase().includes(searchLower) ||
      item.conversationId.toLowerCase().includes(searchLower) ||
      (item.notes && item.notes.toLowerCase().includes(searchLower))
    );
  }, [savedChatItems, searchTerm]);

  // Sort by creation date (most recent first)
  const sortedSavedChats = useMemo(() => {
    return [...filteredSavedChats].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [filteredSavedChats]);

  const handleConversationClick = (conversationId: string) => {
    // Find the position in the sorted order (matches display order)
    const position = sortedSavedChats.findIndex(item => item.conversationId === conversationId);
    // Create sorted conversation IDs array for navigation
    const sortedOrder = sortedSavedChats.map(item => item.conversationId);
    onConversationSelect?.(conversationId, position, sortedOrder);
  };

  const handleUnsaveClick = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the conversation
    
    // Clean up notes for this conversation
    const newNotes = new Map(notes);
    newNotes.delete(conversationId);
    setNotes(newNotes);
    saveNotesToStorage(newNotes);
    
    onUnsaveChat?.(conversationId);
  };

  // Copy conversation ID to clipboard
  const handleCopyId = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the conversation
    navigator.clipboard.writeText(conversationId).then(() => {
      setCopiedId(conversationId);
      setTimeout(() => setCopiedId(null), 2000); // Clear after 2 seconds
      console.log('Conversation ID copied to clipboard:', conversationId);
    }).catch(err => {
      console.error('Failed to copy conversation ID:', err);
    });
  };

  // Clear all saved chats
  const handleClearAll = () => {
    if (window.confirm(`Are you sure you want to remove all ${savedConversationIds.length} saved chats? This action cannot be undone.`)) {
      // Clear all notes as well
      setNotes(new Map());
      saveNotesToStorage(new Map());
      onClearAllSaved?.();
    }
  };

  // Export saved chats as CSV
  const handleExportCSV = () => {
    if (sortedSavedChats.length === 0) {
      alert('No saved chats to export.');
      return;
    }

    // Define CSV headers
    const headers = ['Title', 'Conversation ID', 'Created Date', 'Created Time', 'Notes'];
    
    // Convert data to CSV format
    const csvData = sortedSavedChats.map(item => {
      const createdDate = new Date(item.createdAt);
      const dateStr = createdDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      const timeStr = createdDate.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }); // HH:MM:SS format
      
      // Escape quotes and commas in text fields for CSV
      const escapeCSV = (text: string) => {
        if (text.includes('"') || text.includes(',') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };
      
      return [
        escapeCSV(item.title),
        escapeCSV(item.conversationId),
        dateStr,
        timeStr,
        escapeCSV(item.notes || '')
      ];
    });
    
    // Combine headers and data
    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD format
      link.setAttribute('download', `saved-chats-${timestamp}.csv`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Chats</h1>
          <p className="text-gray-600 mt-1">
            {savedConversationIds.length} saved conversation{savedConversationIds.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          {savedConversationIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 hover:border-green-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          
          {/* Clear All Button */}
          {savedConversationIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
          <Bookmark className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search saved chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Saved Chats Table */}
      {savedConversationIds.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved chats yet</h3>
              <p className="text-gray-600">
                Click the bookmark icon in any conversation to save it here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : sortedSavedChats.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching saved chats</h3>
              <p className="text-gray-600">
                Try adjusting your search terms.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Conversation</TableHead>
                  <TableHead className="w-[65%]">Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSavedChats.map((item, index) => (
                  <TableRow 
                    key={item.conversationId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleConversationClick(item.conversationId)}
                  >
                    {/* Conversation Column */}
                    <TableCell className="py-4">
                      <div className="space-y-2">
                        <div className="font-medium text-gray-900 truncate">
                          {item.title}
                        </div>
                        
                        {/* Full Conversation ID with Copy Button */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="select-all bg-gray-50 px-2 py-1 rounded border text-xs font-mono text-gray-700">
                            {item.conversationId}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleCopyId(item.conversationId, e)}
                            className={`h-6 w-6 p-0 transition-colors ${
                              copiedId === item.conversationId 
                                ? 'bg-green-100 hover:bg-green-100 text-green-600' 
                                : 'hover:bg-gray-100'
                            }`}
                            title={copiedId === item.conversationId ? "Copied!" : "Copy conversation ID"}
                          >
                            {copiedId === item.conversationId ? (
                              <span className="text-xs font-medium">✓</span>
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>

                        {/* Badges Row - Removed "Fetched" tag */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.hasUI && (
                            <Badge variant="secondary" className="text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              UI
                            </Badge>
                          )}
                          {item.hasLinkout && (
                            <Badge variant="secondary" className="text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Linkout
                            </Badge>
                          )}
                          {item.conversation && (
                            <Badge variant="outline" className="text-xs">
                              Uploaded
                            </Badge>
                          )}
                          {item.thread && (
                            <Badge variant="outline" className="text-xs">
                              Thread
                            </Badge>
                          )}
                        </div>

                        {/* Created and Messages Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimestamp(item.createdAt)}</span>
                          </div>
                          {item.messageCount > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              <span>{item.messageCount} messages</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Notes Column - Much Wider Now */}
                    <TableCell className="py-4 align-top" style={{ width: '65%', minWidth: '400px' }}>
                      <Textarea
                        placeholder="Add notes about this conversation..."
                        value={item.notes || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNotes(item.conversationId, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="resize-none text-sm"
                        style={{ 
                          height: '120px', 
                          width: '90%',
                          minWidth: '300px',
                          maxWidth: '90%'
                        }}
                        rows={5}
                      />
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="py-4 align-top">
                      <button 
                        onClick={(e) => handleUnsaveClick(item.conversationId, e)}
                        className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-gray-200 hover:border-red-200 flex items-center justify-center mt-1 transition-colors"
                        style={{
                          height: '48px',
                          width: '48px',
                          minHeight: '48px',
                          minWidth: '48px'
                        }}
                        title="Remove from saved chats"
                      >
                        <BookmarkX className="w-6 h-6" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
