import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Key,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
// Hooks
import { useApiKey } from '../hooks/useApiKey';
import { useContextData } from '../hooks/useContextData';
import { useScrollToTop } from '../hooks/useScrollToTop';
import {
  useConversationAnalytics,
  useFilteredMessages,
  useTimeoutDetection,
} from '../hooks/useConversationAnalytics';
import { useConversationFetch } from '../hooks/useConversationFetch';
import type { Conversation, Message, Thread } from '../lib/types';
import { formatTimestamp } from '../lib/utils';
import { countUserAndAssistantMessages } from '../utils/conversationUtils';
// Components
import {
  BookmarkButton,
  CategoryBadge,
  CopyButton,
  FloatingNavigationButtons,
  MessageBubble,
  NavigationButtons,
  ScrollToTopButton,
} from './conversation';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ConversationDetailProps {
  conversation?: Conversation;
  conversationId?: string;
  uploadedConversation?: Conversation;
  selectedThread?: Thread;
  onThreadSelect?: (threadId: string) => void;
  error?: string;
  isOfflineMode?: boolean;
  hasAnyUploadedConversations?: boolean;
  onPreviousConversation?: () => void;
  onNextConversation?: () => void;
  hasPreviousConversation?: boolean;
  hasNextConversation?: boolean;
  onConversationFetched?: (conversation: Conversation) => void;
  isSaved?: boolean;
  onToggleSave?: (conversationId: string) => void;
  initialNotes?: string;
  onNotesChange?: (conversationId: string, notes: string) => void;
}

export function ConversationDetail({
  conversation,
  conversationId,
  uploadedConversation,
  selectedThread,
  onThreadSelect: _onThreadSelect,
  error,
  isOfflineMode = false,
  hasAnyUploadedConversations = false,
  onPreviousConversation,
  onNextConversation,
  hasPreviousConversation = false,
  hasNextConversation = false,
  onConversationFetched,
  isSaved = false,
  onToggleSave,
  initialNotes = '',
  onNotesChange,
}: ConversationDetailProps) {
  // State
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [paginationConversationId, setPaginationConversationId] = useState(() => {
    return conversationId || conversation?.id || selectedThread?.conversationId || '';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [notes, setNotes] = useState(initialNotes);

  // Scroll to top hook (threshold: 200px = show button after scrolling down a bit)
  const { showButton, scrollToTop } = useScrollToTop(200);

  // Custom hooks
  const { apiKey, showApiKey, setShowApiKey } = useApiKey();
  const {
    fetchLoading,
    fetchError,
    fetchedConversation,
    fetchResponse,
    showJsonOutput,
    setShowJsonOutput,
    handleFetchConversation,
  } = useConversationFetch({
    conversationId: paginationConversationId,
    apiKey,
    uploadedConversation,
    onConversationFetched,
  });

  const {
    contextData,
    contextLoading,
    contextError,
    showContextPopup,
    setShowContextPopup,
    fetchContextData,
    searchContextKeys,
    displayContextValue,
  } = useContextData(apiKey);

  // Handle ESC key to close context popup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showContextPopup) {
        setShowContextPopup(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showContextPopup, setShowContextPopup]);

  // Determine active conversation
  const activeConversation = useMemo(() => {
    if (selectedThread?.messages && selectedThread.messages.length > 0) {
      return {
        id: selectedThread.conversationId,
        title: `Thread ${selectedThread.id}`,
        createdAt: selectedThread.createdAt,
        lastMessageAt:
          selectedThread.messages[selectedThread.messages.length - 1]?.sentAt ||
          selectedThread.createdAt,
        messages: selectedThread.messages,
        threadIds: [selectedThread.id],
      };
    }
    return conversation || uploadedConversation || fetchedConversation;
  }, [conversation, uploadedConversation, fetchedConversation, selectedThread]);

  // Analytics and filtering
  const _analytics = useConversationAnalytics(activeConversation);
  const filteredMessages = useFilteredMessages(activeConversation, showSystemMessages);
  const hasTimeoutAfter = useTimeoutDetection(activeConversation);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_err) {
      // Silently fail
    }
  }, []);

  // Notes handlers
  const handleNotesChange = useCallback(
    (newNotes: string) => {
      setNotes(newNotes);
      if (paginationConversationId && onNotesChange) {
        onNotesChange(paginationConversationId, newNotes);
      }
    },
    [paginationConversationId, onNotesChange]
  );

  const handleSaveWithNotes = useCallback(() => {
    if (paginationConversationId && onToggleSave) {
      if (!isSaved) {
        onToggleSave(paginationConversationId);
        setShowNotesPanel(true);
      } else {
        onToggleSave(paginationConversationId);
        setShowNotesPanel(false);
      }
    }
  }, [paginationConversationId, onToggleSave, isSaved]);

  const handleSaveNotes = useCallback(() => {
    setShowNotesPanel(false);
  }, []);

  // Effects
  useEffect(() => {
    const shouldAutoFetch =
      paginationConversationId.trim() &&
      apiKey.trim() &&
      !uploadedConversation &&
      !fetchedConversation &&
      !fetchLoading &&
      !(selectedThread?.messages && selectedThread.messages.length > 0);

    if (shouldAutoFetch) {
      handleFetchConversation();
    }
  }, [
    paginationConversationId,
    apiKey,
    uploadedConversation,
    fetchedConversation,
    fetchLoading,
    selectedThread,
    handleFetchConversation,
  ]);

  useEffect(() => {
    const newId = conversationId || conversation?.id || selectedThread?.conversationId || '';
    if (newId && newId !== paginationConversationId) {
      setPaginationConversationId(newId);
    }
  }, [conversationId, conversation?.id, selectedThread?.conversationId, paginationConversationId]);

  useEffect(() => {
    const currentConversationId =
      conversationId ||
      conversation?.id ||
      selectedThread?.conversationId ||
      paginationConversationId;
    if (currentConversationId) {
      const event = new CustomEvent('conversationViewed', {
        detail: { conversationId: currentConversationId },
      });
      window.dispatchEvent(event);
    }
  }, [conversationId, conversation?.id, selectedThread?.conversationId, paginationConversationId]);

  useEffect(() => {
    const threadId = selectedThread?.id;
    if (threadId && apiKey.trim()) {
      fetchContextData(threadId, selectedThread.messages);
    }
  }, [selectedThread?.id, apiKey, fetchContextData, selectedThread.messages]);

  // Loading state
  if (!activeConversation && !selectedThread && !error && !isOfflineMode && !fetchLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conversation Detail</h1>
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Calculate conversation metrics
  const calculateDuration = (messages: Message[]) => {
    if (messages.length < 2) return 'N/A';
    const timestamps = messages
      .map((m) => new Date(m.created_at || m.createdAt || m.sentAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (timestamps.length < 2) return 'N/A';
    const duration = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
    const minutes = Math.round(duration / (1000 * 60));
    const seconds = Math.round(duration / 1000);
    return minutes > 0 ? `${minutes}m` : seconds > 0 ? `${seconds}s` : '<1s';
  };

  const calculateResponseTime = (messages: Message[]) => {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (userMessages.length === 0 || assistantMessages.length === 0) return 'N/A';
    const firstUser = userMessages
      .map((m) => ({
        ...m,
        timestamp: new Date(m.created_at || m.createdAt || m.sentAt),
      }))
      .filter((m) => !Number.isNaN(m.timestamp.getTime()))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
    const firstAssistant = assistantMessages
      .map((m) => ({
        ...m,
        timestamp: new Date(m.created_at || m.createdAt || m.sentAt),
      }))
      .filter((m) => !Number.isNaN(m.timestamp.getTime()))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
    if (!firstUser || !firstAssistant || firstAssistant.timestamp <= firstUser.timestamp)
      return 'N/A';
    const responseTime = firstAssistant.timestamp.getTime() - firstUser.timestamp.getTime();
    const seconds = Math.round(responseTime / 1000);
    return seconds > 0 ? `${seconds}s` : '<1s';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Conversation Detail</h1>
      </div>

      {/* Main Content */}
      {activeConversation && (
        <div className="space-y-6">
          {/* Conversation Header Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-slate-800">
                      {activeConversation.title && !activeConversation.title.startsWith('Thread ')
                        ? activeConversation.title
                        : 'Conversation Details'}
                    </CardTitle>
                    <CategoryBadge messages={activeConversation.messages || []} />
                  </div>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-2">
                      <CardDescription className="text-slate-600">
                        Conversation ID: {activeConversation.id}
                      </CardDescription>
                      <CopyButton
                        text={activeConversation.id}
                        id="conversation-id"
                        copiedId={copiedId}
                        onCopy={copyToClipboard}
                        title="Copy Conversation ID"
                      />
                    </div>
                    {selectedThread?.id && (
                      <div className="flex items-center gap-2">
                        <CardDescription className="text-slate-600">
                          Thread ID: {selectedThread.id}
                        </CardDescription>
                        <CopyButton
                          text={selectedThread.id}
                          id="thread-id"
                          copiedId={copiedId}
                          onCopy={copyToClipboard}
                          title="Copy Thread ID"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation and Bookmark */}
                <div className="flex items-start gap-6 mr-4">
                  <div className="flex items-center gap-3">
                    <NavigationButtons
                      onPrevious={onPreviousConversation}
                      onNext={onNextConversation}
                      hasPrevious={hasPreviousConversation}
                      hasNext={hasNextConversation}
                    />

                    {paginationConversationId && (
                      <BookmarkButton
                        isSaved={isSaved}
                        onToggleSave={handleSaveWithNotes}
                        showNotesPanel={showNotesPanel}
                        setShowNotesPanel={setShowNotesPanel}
                        notes={notes}
                        onNotesChange={handleNotesChange}
                        onSaveNotes={handleSaveNotes}
                      />
                    )}
                  </div>
                </div>

                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                  {countUserAndAssistantMessages(activeConversation.messages || [])} messages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary Section */}
              <div className="mb-6 pb-4 border-b border-slate-200">
                <Label className="text-slate-600 text-sm font-medium mb-2 block">Summary</Label>
                <p className="text-sm text-slate-700 font-semibold max-w-full break-words">
                  {displayContextValue(searchContextKeys(contextData, ['summary'])) || 'N/A'}
                </p>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label>Created</Label>
                    <p className="text-sm">{formatTimestamp(activeConversation.createdAt)}</p>
                  </div>
                  <div>
                    <Label>Last Message</Label>
                    <p className="text-sm">{formatTimestamp(activeConversation.lastMessageAt)}</p>
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <p className="text-sm">
                      {calculateDuration(activeConversation.messages || [])}
                    </p>
                  </div>
                  <div>
                    <Label>Response Time</Label>
                    <p className="text-sm">
                      {calculateResponseTime(activeConversation.messages || [])}
                    </p>
                  </div>
                </div>

                {/* Right Column - Context Data */}
                <div className="space-y-3 border-l border-slate-200 pl-6">
                  <div>
                    <Label className="text-slate-600 text-xs font-medium">Page ID</Label>
                    <p className="text-sm text-slate-700">
                      {displayContextValue(searchContextKeys(contextData, ['pageId', 'pageID']))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs font-medium">SSO</Label>
                    <p className="text-sm text-slate-700">
                      {displayContextValue(searchContextKeys(contextData, ['SSO', 'sso']))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs font-medium">Device Output</Label>
                    <p className="text-sm text-slate-700 break-words">
                      {displayContextValue(
                        searchContextKeys(contextData, ['deviceOutput', 'device_output', 'device'])
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs font-medium">App Version</Label>
                    <p className="text-sm text-slate-700">
                      {displayContextValue(
                        searchContextKeys(contextData, ['appVersion', 'version', 'app_version'])
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Timeline */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-slate-800">Message Timeline</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSystemMessages(!showSystemMessages)}
                    className={`flex items-center gap-2 ${
                      showSystemMessages
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    {showSystemMessages ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide System
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Show System
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContextPopup(true)}
                    disabled={!selectedThread?.id || contextLoading}
                    className="flex items-center gap-2"
                  >
                    {contextLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Show Context
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-slate-100/90 to-slate-200/60 rounded-lg relative">
              <div className="px-6 py-8 space-y-4">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No messages to display</p>
                    <p className="text-sm mt-2">
                      Try toggling "Show System" to see system messages
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      hasTimeout={hasTimeoutAfter.has(message.id)}
                      copiedId={copiedId}
                      onCopy={copyToClipboard}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fetch Conversation Section (when no active conversation) */}
      {!activeConversation && (isOfflineMode || !hasAnyUploadedConversations) && (
        <div className="max-w-2xl mx-auto mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {fetchLoading && <RefreshCw className="h-5 w-5 animate-spin" />}
                Fetch Conversation by ID
              </CardTitle>
              <CardDescription>
                {fetchLoading
                  ? `Loading conversation data for ${paginationConversationId}...`
                  : 'Enter your API key and conversation ID to fetch data directly from the API'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fetchLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching conversation data...</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative mt-1">
                      <Input
                        id="api-key"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        readOnly
                        disabled
                        placeholder="Set API key in dashboard header"
                        className="pr-10 bg-muted text-muted-foreground cursor-not-allowed"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                        disabled={!apiKey}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {apiKey ? (
                        <>
                          <Key className="h-3 w-3 inline mr-1" />
                          API key configured in dashboard
                        </>
                      ) : (
                        <>
                          <Key className="h-3 w-3 inline mr-1" />
                          Please set API key in dashboard header first
                        </>
                      )}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="conversation-id">Conversation ID</Label>
                    <Input
                      id="conversation-id"
                      value={paginationConversationId}
                      onChange={(e) => setPaginationConversationId(e.target.value)}
                      placeholder="Enter conversation ID"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    variant="default"
                    className="w-full bg-black hover:bg-black/90 text-white"
                    onClick={handleFetchConversation}
                    disabled={fetchLoading || !paginationConversationId.trim() || !apiKey.trim()}
                  >
                    {fetchLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      'Fetch'
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {fetchError && (
        <div className="max-w-4xl mx-auto mt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Collapsible JSON Output */}
      {fetchResponse && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Raw JSON Response</CardTitle>
                <CardDescription>View the raw API response data</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJsonOutput(!showJsonOutput)}
                className="flex items-center gap-2"
              >
                {showJsonOutput ? (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Hide JSON
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    Show JSON
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showJsonOutput && (
            <CardContent>
              <div className="relative">
                <div className="bg-muted/50 rounded-lg border overflow-auto p-4 max-h-80">
                  <pre className="text-sm text-muted-foreground font-mono whitespace-pre-wrap break-words">
                    {fetchResponse}
                  </pre>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Context Popup Overlay */}
      {showContextPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowContextPopup(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col w-[90%] sm:w-[500px] max-h-[85vh] border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 rounded-t-xl">
              <h2 className="text-lg font-semibold text-gray-900">Context Data</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContextPopup(false)}
                className="h-8 w-8 p-0 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-auto bg-gray-50">
              {contextError ? (
                <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{contextError}</span>
                  </div>
                </div>
              ) : contextData ? (
                <>
                  <div className="flex justify-between items-center mb-4 gap-4">
                    <h3 className="text-base font-medium text-gray-900 flex-shrink-0">JSON Response</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(contextData, null, 2), 'context-data')
                      }
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      {copiedId === 'context-data' ? (
                        <>
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 text-xs sm:text-sm">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span className="hidden sm:inline">Copy JSON</span>
                          <span className="sm:hidden">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
                    <div className="overflow-auto max-h-[calc(85vh-200px)] bg-white">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-gray-700 p-4 m-0">
                        {JSON.stringify(contextData, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500">No context data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTopButton show={showButton} onClick={scrollToTop} />

      {/* Floating Navigation Buttons */}
      <FloatingNavigationButtons
        show={showButton}
        onPrevious={onPreviousConversation}
        onNext={onNextConversation}
        hasPrevious={hasPreviousConversation}
        hasNext={hasNextConversation}
      />
    </div>
  );
}
