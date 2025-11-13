import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ConversationDetail } from './components/ConversationDetail';
import { ConversationSearch } from './components/features/ConversationSearch';
import { AppHeader } from './components/layout/AppHeader';
import { SavedChats } from './components/SavedChats';
import { Statistics } from './components/Statistics';
import { ThreadsOverview } from './components/ThreadsOverview';
import { Button } from './components/ui/button';

import { useAppState } from './hooks/useAppState';
import { useConversationSearch } from './hooks/useConversationSearch';
import { useEnvironmentManager } from './hooks/useEnvironmentManager';
import {
  getEnvironmentSpecificItem,
  setEnvironmentSpecificItem,
  setGlobalOfflineMode,
} from './lib/api';
import type { UploadedData } from './lib/types';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    uploadedData,
    setUploadedData,
    selectedConversationId,
    setSelectedConversationId,
    selectedThread,
    setSelectedThread,
    showConversationOverlay,
    setShowConversationOverlay,
    environment,
    setEnvironment,
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    fetchedConversationsMap,
    setFetchedConversationsMap,
    threadOrder,
    setThreadOrder,
    currentThreads,
    setCurrentThreads,
    navigationContext,
    setNavigationContext,
    savedChats,
    setSavedChats,
    threadOrderRef,
    selectedConversationIdRef,
    currentThreadPositionRef,
    savedChatsOrderRef,
    currentSavedChatPositionRef,
  } = useAppState();

  const {
    conversationSearchId,
    setConversationSearchId,
    searchLoading,
    searchError,
    handleConversationSearch,
    handleSearchKeyDown,
  } = useConversationSearch();

  const { handleEnvironmentChange, handleApiKeyChange, handleApiKeyKeyDown } =
    useEnvironmentManager();

  // Notes state for async loading
  const [initialNotes, setInitialNotes] = useState<string>('');

  // Load notes when selectedConversationId changes
  useEffect(() => {
    const loadNotes = async () => {
      if (!selectedConversationId) {
        setInitialNotes('');
        return;
      }

      try {
        const savedNotes = getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes');
        if (savedNotes) {
          const notesData = JSON.parse(savedNotes);
          setInitialNotes(notesData[selectedConversationId] || '');
        } else {
          setInitialNotes('');
        }
      } catch (_error) {
        setInitialNotes('');
      }
    };

    loadNotes();
  }, [selectedConversationId]);

  // Prevent body scroll when conversation overlay is open
  useEffect(() => {
    if (showConversationOverlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [showConversationOverlay]);

  // Reset app state function
  const resetAppState = useCallback(() => {
    setSelectedConversationId(undefined);
    setSelectedThread(undefined);
    setConversationSearchId('');
    setShowConversationOverlay(false);
    setActiveTab('dashboard');
    setShowApiKey(false);
    threadOrderRef.current = [];
    selectedConversationIdRef.current = undefined;
    currentThreadPositionRef.current = -1;
    savedChatsOrderRef.current = [];
    currentSavedChatPositionRef.current = -1;
  }, [
    setSelectedConversationId,
    setSelectedThread,
    setConversationSearchId,
    setShowConversationOverlay,
    setActiveTab,
    setShowApiKey,
    currentSavedChatPositionRef,
    currentThreadPositionRef,
    savedChatsOrderRef,
    selectedConversationIdRef,
    threadOrderRef,
  ]);

  // Environment change handler
  const onEnvironmentChange = useCallback(
    (newEnvironment: string) => {
      handleEnvironmentChange(
        newEnvironment,
        setEnvironment,
        setApiKey,
        setUploadedData,
        setSavedChats,
        resetAppState
      ).catch((err) => {
        console.error('Error changing environment:', err);
      });
    },
    [
      handleEnvironmentChange,
      setEnvironment,
      setApiKey,
      setUploadedData,
      setSavedChats,
      resetAppState,
    ]
  );

  // API key handlers
  const onApiKeyChange = useCallback(
    (newApiKey: string) => {
      handleApiKeyChange(newApiKey, setApiKey);
    },
    [handleApiKeyChange, setApiKey]
  );

  const onApiKeyKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleApiKeyKeyDown(e, apiKey, setApiKey);
    },
    [handleApiKeyKeyDown, apiKey, setApiKey]
  );

  // Data management - merge data in memory
  const _handleDataUploaded = useCallback(
    async (data: UploadedData) => {
      setUploadedData((prevData) => {
        const merged: UploadedData = {
          conversations: [...(prevData.conversations || []), ...(data.conversations || [])],
          threadsResponse: data.threadsResponse
            ? {
                threads: [
                  ...(prevData.threadsResponse?.threads || []),
                  ...(data.threadsResponse.threads || []),
                ],
              }
            : prevData.threadsResponse,
          attributesResponses: [
            ...(prevData.attributesResponses || []),
            ...(data.attributesResponses || []),
          ],
          bulkAttributesResponses: [
            ...(prevData.bulkAttributesResponses || []),
            ...(data.bulkAttributesResponses || []),
          ],
        };

        // Clean up empty arrays
        if (merged.conversations?.length === 0) delete merged.conversations;
        if (merged.attributesResponses?.length === 0) delete merged.attributesResponses;
        if (merged.bulkAttributesResponses?.length === 0) delete merged.bulkAttributesResponses;

        // Enable offline mode if we have data
        const hasAnyData =
          (merged.conversations?.length || 0) > 0 ||
          !!merged.threadsResponse ||
          (merged.attributesResponses?.length || 0) > 0 ||
          (merged.bulkAttributesResponses?.length || 0) > 0;
        setGlobalOfflineMode(hasAnyData);

        // Save to localStorage
        try {
          setEnvironmentSpecificItem('chatbot-dashboard-data', JSON.stringify(merged));
        } catch (_error) {}

        return merged;
      });

      // Auto-switch to dashboard
      if (data.threadsResponse?.threads?.length || data.conversations?.length) {
        setActiveTab('dashboard');
        if (data.conversations?.length) {
          setSelectedConversationId(data.conversations[0].id);
        }
      }
    },
    [setUploadedData, setActiveTab, setSelectedConversationId]
  );

  const handleDataCleared = useCallback(() => {
    setUploadedData({});
    setSelectedConversationId(undefined);
    setSelectedThread(undefined);
    setGlobalOfflineMode(false);

    try {
      setEnvironmentSpecificItem('chatbot-dashboard-data', '{}');
    } catch (_error) {}
  }, [setUploadedData, setSelectedConversationId, setSelectedThread]);

  // Conversation search handler
  const onConversationFound = useCallback(
    (conversation: any, thread?: any) => {
      setSelectedConversationId(conversation.id);
      if (thread) {
        setSelectedThread(thread);
      }
      setShowConversationOverlay(true);
    },
    [setSelectedConversationId, setSelectedThread, setShowConversationOverlay]
  );

  const onSearch = useCallback(() => {
    handleConversationSearch(apiKey, onConversationFound);
  }, [handleConversationSearch, apiKey, onConversationFound]);

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleSearchKeyDown(e, apiKey, onConversationFound);
    },
    [handleSearchKeyDown, apiKey, onConversationFound]
  );

  // Server shutdown handler
  const handleServerShutdown = useCallback(async () => {
    try {
      if (!window.confirm('Are you sure you want to close the application?')) {
        return;
      }

      await fetch('/api/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      alert('Closing application...');

      try {
        window.close();
      } catch (_closeError) {
        alert('Please close this browser tab manually to complete the shutdown.');
      }
    } catch (_error) {
      try {
        window.close();
      } catch (_closeError) {}
    }
  }, []);

  // Check if we have offline data
  const hasOfflineData =
    (uploadedData.conversations?.length || 0) > 0 ||
    !!uploadedData.threadsResponse ||
    (uploadedData.attributesResponses?.length || 0) > 0 ||
    (uploadedData.bulkAttributesResponses?.length || 0) > 0;

  // Extract threads from uploaded data
  const uploadedThreads = uploadedData.threadsResponse?.threads.map((t) => t.thread) || [];
  const uploadedConversation =
    selectedConversationId &&
    uploadedData.conversations?.find((c) => c.id === selectedConversationId);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        environment={environment}
        onEnvironmentChange={onEnvironmentChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        onApiKeyKeyDown={onApiKeyKeyDown}
        showApiKey={showApiKey}
        onToggleApiKeyVisibility={() => setShowApiKey(!showApiKey)}
        hasOfflineData={hasOfflineData}
        onClearData={handleDataCleared}
        onServerShutdown={handleServerShutdown}
      />

      {/* Navigation Tabs */}
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'conversation-search', label: 'Search Conversation' },
              { id: 'saved-chats', label: 'Saved Chats' },
              { id: 'statistics', label: 'Statistics' },
            ].map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={{ marginLeft: index > 0 ? '24px' : '0' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <ThreadsOverview
              key={`threads-${environment}`}
              uploadedThreads={uploadedThreads}
              uploadedConversations={uploadedData.conversations || []}
              onThreadSelect={(thread) => {
                setSelectedThread(thread);
                setSelectedConversationId(thread.conversationId);
                setShowConversationOverlay(true);
              }}
              onConversationSelect={(conversationId, position) => {
                setSelectedConversationId(conversationId);
                setShowConversationOverlay(true);
                setNavigationContext('threads');
                if (position !== undefined) {
                  currentThreadPositionRef.current = position;
                }
              }}
              onFetchedConversationsChange={setFetchedConversationsMap}
              onThreadOrderChange={(order) => {
                setThreadOrder(order);
                threadOrderRef.current = order;
              }}
              onConversationViewed={async (conversationId) => {
                try {
                  const existingViewed = getEnvironmentSpecificItem(
                    'chatbot-dashboard-viewed-conversations'
                  );
                  const viewedSet = existingViewed
                    ? new Set(JSON.parse(existingViewed))
                    : new Set();
                  viewedSet.add(conversationId);
                  setEnvironmentSpecificItem(
                    'chatbot-dashboard-viewed-conversations',
                    JSON.stringify(Array.from(viewedSet))
                  );
                } catch (_error) {}
              }}
              onThreadsChange={setCurrentThreads}
              savedConversationIds={savedChats}
            />
          )}

          {activeTab === 'conversation-search' && (
            <ConversationSearch
              conversationSearchId={conversationSearchId}
              onConversationSearchIdChange={setConversationSearchId}
              onSearch={onSearch}
              onSearchKeyDown={onSearchKeyDown}
              searchLoading={searchLoading}
              searchError={searchError}
              apiKey={apiKey}
            />
          )}

          {activeTab === 'saved-chats' && (
            <SavedChats
              savedConversationIds={[...savedChats]}
              uploadedConversations={uploadedData.conversations || []}
              uploadedThreads={uploadedThreads}
              fetchedConversationsMap={fetchedConversationsMap}
              onConversationSelect={(conversationId, position, sortedOrder) => {
                setSelectedConversationId(conversationId);
                setShowConversationOverlay(true);
                setNavigationContext('saved-chats');

                const savedChatsArray = sortedOrder || [...savedChats];
                savedChatsOrderRef.current = savedChatsArray;

                if (position !== undefined) {
                  currentSavedChatPositionRef.current = position;
                }
              }}
              onUnsaveChat={(conversationId) => {
                const newSavedChats = new Set(savedChats);
                newSavedChats.delete(conversationId);
                setSavedChats(newSavedChats);

                try {
                  setEnvironmentSpecificItem(
                    'chatbot-dashboard-saved-chats',
                    JSON.stringify([...newSavedChats])
                  );
                } catch (_error) {}
              }}
              onClearAllSaved={() => {
                setSavedChats(new Set());
                try {
                  setEnvironmentSpecificItem('chatbot-dashboard-saved-chats', JSON.stringify([]));
                } catch (_error) {}
              }}
              onNotesChange={async (conversationId, notes) => {
                try {
                  const savedNotes =
                    (getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes')) ||
                    '{}';
                  const notesData = JSON.parse(savedNotes);

                  if (notes.trim()) {
                    notesData[conversationId] = notes;
                  } else {
                    delete notesData[conversationId];
                  }

                  setEnvironmentSpecificItem(
                    'chatbot-dashboard-saved-chat-notes',
                    JSON.stringify(notesData)
                  );
                } catch (_error) {}
              }}
              onConversationFetched={(conversation) => {
                setFetchedConversationsMap((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(conversation.id, conversation);
                  return newMap;
                });
              }}
            />
          )}

          {activeTab === 'statistics' && (
            <Statistics
              threads={uploadedThreads}
              uploadedConversations={uploadedData.conversations || []}
            />
          )}
        </div>
      </main>

      {/* Conversation Detail Overlay */}
      {showConversationOverlay && (
        <div id="conversation-overlay" className="fixed inset-0 bg-background z-50 overflow-y-auto">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConversationOverlay(false)}
                className="flex items-center gap-2"
              >
                ← Back to Dashboard
              </Button>
            </div>

            <ConversationDetail
              conversationId={selectedConversationId}
              uploadedConversation={uploadedConversation}
              hasAnyUploadedConversations={(uploadedData.conversations?.length || 0) > 0}
              selectedThread={selectedThread}
              onThreadSelect={(threadId) => {
                const thread = uploadedThreads.find((t) => t.id === threadId);
                if (thread) {
                  setSelectedThread(thread);
                }
              }}
              onPreviousConversation={async () => {
                if (!selectedConversationId) return;

                if (navigationContext === 'saved-chats') {
                  // Use saved chats navigation
                  const savedChatsOrder = savedChatsOrderRef.current;
                  if (savedChatsOrder.length === 0) return;
                  const currentIndex = savedChatsOrder.indexOf(selectedConversationId);
                  if (currentIndex > 0) {
                    const previousConversationId = savedChatsOrder[currentIndex - 1];
                    setSelectedConversationId(previousConversationId);

                    // Mark the new conversation as viewed
                    try {
                      const existingViewed = getEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations'
                      );
                      const viewedSet = existingViewed
                        ? new Set(JSON.parse(existingViewed))
                        : new Set();
                      viewedSet.add(previousConversationId);
                      setEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations',
                        JSON.stringify(Array.from(viewedSet))
                      );
                    } catch (_error) {}

                    // Find and set the thread for the new conversation
                    const associatedThread = currentThreads.find(
                      (thread) => thread.conversationId === previousConversationId
                    );
                    if (associatedThread) {
                      setSelectedThread(associatedThread);
                    }
                  }
                } else {
                  // Use threads navigation
                  if (threadOrder.length === 0) return;
                  const currentIndex = threadOrder.indexOf(selectedConversationId);
                  if (currentIndex > 0) {
                    const previousConversationId = threadOrder[currentIndex - 1];
                    setSelectedConversationId(previousConversationId);

                    // Mark the new conversation as viewed
                    try {
                      const existingViewed = getEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations'
                      );
                      const viewedSet = existingViewed
                        ? new Set(JSON.parse(existingViewed))
                        : new Set();
                      viewedSet.add(previousConversationId);
                      setEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations',
                        JSON.stringify(Array.from(viewedSet))
                      );
                    } catch (_error) {}

                    // Find and set the thread for the new conversation
                    const associatedThread = currentThreads.find(
                      (thread) => thread.conversationId === previousConversationId
                    );
                    if (associatedThread) {
                      setSelectedThread(associatedThread);
                    }
                  }
                }
              }}
              onNextConversation={async () => {
                if (!selectedConversationId) return;

                if (navigationContext === 'saved-chats') {
                  // Use saved chats navigation
                  const savedChatsOrder = savedChatsOrderRef.current;
                  if (savedChatsOrder.length === 0) return;
                  const currentIndex = savedChatsOrder.indexOf(selectedConversationId);
                  if (currentIndex >= 0 && currentIndex < savedChatsOrder.length - 1) {
                    const nextConversationId = savedChatsOrder[currentIndex + 1];
                    setSelectedConversationId(nextConversationId);

                    // Mark the new conversation as viewed
                    try {
                      const existingViewed = getEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations'
                      );
                      const viewedSet = existingViewed
                        ? new Set(JSON.parse(existingViewed))
                        : new Set();
                      viewedSet.add(nextConversationId);
                      setEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations',
                        JSON.stringify(Array.from(viewedSet))
                      );
                    } catch (_error) {}

                    // Find and set the thread for the new conversation
                    const associatedThread = currentThreads.find(
                      (thread) => thread.conversationId === nextConversationId
                    );
                    if (associatedThread) {
                      setSelectedThread(associatedThread);
                    }
                  }
                } else {
                  // Use threads navigation
                  if (threadOrder.length === 0) return;
                  const currentIndex = threadOrder.indexOf(selectedConversationId);
                  if (currentIndex >= 0 && currentIndex < threadOrder.length - 1) {
                    const nextConversationId = threadOrder[currentIndex + 1];
                    setSelectedConversationId(nextConversationId);

                    // Mark the new conversation as viewed
                    try {
                      const existingViewed = getEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations'
                      );
                      const viewedSet = existingViewed
                        ? new Set(JSON.parse(existingViewed))
                        : new Set();
                      viewedSet.add(nextConversationId);
                      setEnvironmentSpecificItem(
                        'chatbot-dashboard-viewed-conversations',
                        JSON.stringify(Array.from(viewedSet))
                      );
                    } catch (_error) {}

                    // Find and set the thread for the new conversation
                    const associatedThread = currentThreads.find(
                      (thread) => thread.conversationId === nextConversationId
                    );
                    if (associatedThread) {
                      setSelectedThread(associatedThread);
                    }
                  }
                }
              }}
              hasPreviousConversation={(() => {
                if (!selectedConversationId) return false;

                if (navigationContext === 'saved-chats') {
                  const savedChatsOrder = savedChatsOrderRef.current;
                  if (savedChatsOrder.length === 0) return false;
                  const currentIndex = savedChatsOrder.indexOf(selectedConversationId);
                  return currentIndex > 0;
                } else {
                  if (threadOrder.length === 0) return false;
                  const currentIndex = threadOrder.indexOf(selectedConversationId);
                  return currentIndex > 0;
                }
              })()}
              hasNextConversation={(() => {
                if (!selectedConversationId) return false;

                if (navigationContext === 'saved-chats') {
                  const savedChatsOrder = savedChatsOrderRef.current;
                  if (savedChatsOrder.length === 0) return false;
                  const currentIndex = savedChatsOrder.indexOf(selectedConversationId);
                  return currentIndex >= 0 && currentIndex < savedChatsOrder.length - 1;
                } else {
                  if (threadOrder.length === 0) return false;
                  const currentIndex = threadOrder.indexOf(selectedConversationId);
                  return currentIndex >= 0 && currentIndex < threadOrder.length - 1;
                }
              })()}
              onConversationFetched={(conversation) => {
                setFetchedConversationsMap((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(conversation.id, conversation);
                  return newMap;
                });
              }}
              isSaved={selectedConversationId ? savedChats.has(selectedConversationId) : false}
              onToggleSave={(conversationId) => {
                if (savedChats.has(conversationId)) {
                  const newSavedChats = new Set(savedChats);
                  newSavedChats.delete(conversationId);
                  setSavedChats(newSavedChats);
                  try {
                    setEnvironmentSpecificItem(
                      'chatbot-dashboard-saved-chats',
                      JSON.stringify([...newSavedChats])
                    );
                  } catch (_error) {}
                } else {
                  const newSavedChats = new Set(savedChats);
                  newSavedChats.add(conversationId);
                  setSavedChats(newSavedChats);
                  try {
                    setEnvironmentSpecificItem(
                      'chatbot-dashboard-saved-chats',
                      JSON.stringify([...newSavedChats])
                    );
                  } catch (_error) {}
                }
              }}
              initialNotes={initialNotes}
              onNotesChange={async (conversationId, notes) => {
                try {
                  const savedNotes =
                    (getEnvironmentSpecificItem('chatbot-dashboard-saved-chat-notes')) ||
                    '{}';
                  const notesData = JSON.parse(savedNotes);

                  if (notes.trim()) {
                    notesData[conversationId] = notes;
                  } else {
                    delete notesData[conversationId];
                  }

                  setEnvironmentSpecificItem(
                    'chatbot-dashboard-saved-chat-notes',
                    JSON.stringify(notesData)
                  );
                } catch (_error) {}
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
