import { useState, useEffect, useRef, useCallback } from 'react';
import { UploadedData, Thread, Conversation } from '../lib/types';
import { 
  setGlobalOfflineMode, 
  getApiBaseUrl, 
  getEnvironmentSpecificItem, 
  setEnvironmentSpecificItem 
} from '../lib/api';

export function useAppState() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploadedData, setUploadedData] = useState<UploadedData>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [showConversationOverlay, setShowConversationOverlay] = useState(false);
  
  // Environment and API state
  const [environment, setEnvironment] = useState(() => {
    return localStorage.getItem('chatbot-dashboard-environment') || 'staging';
  });
  
  const [apiKey, setApiKey] = useState(() => {
    return getEnvironmentSpecificItem('chatbot-dashboard-api-key') || '';
  });
  
  const [showApiKey, setShowApiKey] = useState(false);

  // Navigation state
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [currentConversationIndex, setCurrentConversationIndex] = useState<number>(-1);
  const [fetchedConversationsMap, setFetchedConversationsMap] = useState<Map<string, any>>(new Map());
  const [threadOrder, setThreadOrder] = useState<string[]>([]);
  const [currentThreads, setCurrentThreads] = useState<Thread[]>([]);
  const [navigationContext, setNavigationContext] = useState<'threads' | 'saved-chats'>('threads');

  // Refs for navigation
  const threadOrderRef = useRef<string[]>([]);
  const selectedConversationIdRef = useRef<string | undefined>();
  const currentThreadPositionRef = useRef<number>(-1);
  const savedChatsOrderRef = useRef<string[]>([]);
  const currentSavedChatPositionRef = useRef<number>(-1);

  // Saved chats state
  const [savedChats, setSavedChats] = useState<Set<string>>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-saved-chats');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.error('Failed to load saved chats:', error);
      return new Set();
    }
  });

  // Load environment-specific data on mount
  useEffect(() => {
    try {
      const savedData = getEnvironmentSpecificItem('chatbot-dashboard-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setUploadedData(parsedData);
        
        const hasAnyData = (parsedData.conversations?.length || 0) > 0 || 
                          !!parsedData.threadsResponse || 
                          (parsedData.attributesResponses?.length || 0) > 0 || 
                          (parsedData.bulkAttributesResponses?.length || 0) > 0;
        setGlobalOfflineMode(hasAnyData);
      }
    } catch (error) {
      console.error('Failed to load environment-specific saved data:', error);
    }
  }, []);

  // Update global offline mode when uploaded data changes
  useEffect(() => {
    const hasAnyData = (uploadedData.conversations?.length || 0) > 0 || 
                      !!uploadedData.threadsResponse || 
                      (uploadedData.attributesResponses?.length || 0) > 0 || 
                      (uploadedData.bulkAttributesResponses?.length || 0) > 0;
    setGlobalOfflineMode(hasAnyData);
  }, [uploadedData]);

  // Keep selectedConversationId ref synchronized
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  return {
    // State
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
    allConversations,
    setAllConversations,
    currentConversationIndex,
    setCurrentConversationIndex,
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
    
    // Refs
    threadOrderRef,
    selectedConversationIdRef,
    currentThreadPositionRef,
    savedChatsOrderRef,
    currentSavedChatPositionRef,
  };
}
