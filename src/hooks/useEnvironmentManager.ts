import { useCallback } from 'react';
import { 
  setGlobalOfflineMode, 
  getEnvironmentSpecificItem, 
  setEnvironmentSpecificItem 
} from '../lib/api';

export function useEnvironmentManager() {
  const handleEnvironmentChange = useCallback((
    newEnvironment: string,
    setEnvironment: (env: string) => void,
    setApiKey: (key: string) => void,
    setUploadedData: (data: any) => void,
    setSavedChats: (chats: Set<string>) => void,
    resetAppState: () => void
  ) => {
    console.log('🌍 Environment changed to:', newEnvironment);
    
    // Save new environment to localStorage
    setEnvironment(newEnvironment);
    localStorage.setItem('chatbot-dashboard-environment', newEnvironment);
    
    // Load environment-specific data
    const newApiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key') || '';
    setApiKey(newApiKey);
    
    // Load environment-specific uploaded data
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
      } else {
        setUploadedData({});
        setGlobalOfflineMode(false);
      }
    } catch (error) {
      console.error('Failed to load environment-specific data:', error);
      setUploadedData({});
      setGlobalOfflineMode(false);
    }
    
    // Load environment-specific saved chats
    try {
      const savedChatsData = getEnvironmentSpecificItem('chatbot-dashboard-saved-chats');
      const newSavedChats = savedChatsData ? new Set(JSON.parse(savedChatsData)) : new Set();
      setSavedChats(newSavedChats);
      console.log('💾 Loaded environment-specific saved chats:', newSavedChats.size, 'chats');
    } catch (error) {
      console.error('Failed to load environment-specific saved chats:', error);
      setSavedChats(new Set());
    }
    
    // Reset current selection state
    resetAppState();
    
    console.log('✅ Switched to', newEnvironment, 'environment with preserved data');
  }, []);

  const handleApiKeyChange = useCallback((newApiKey: string, setApiKey: (key: string) => void) => {
    setApiKey(newApiKey);
    setEnvironmentSpecificItem('chatbot-dashboard-api-key', newApiKey);
    console.log('🔑 API key saved to environment-specific localStorage');
  }, []);

  const handleApiKeyKeyDown = useCallback((
    e: React.KeyboardEvent,
    apiKey: string,
    setApiKey: (key: string) => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApiKeyChange(apiKey, setApiKey);
    }
  }, [handleApiKeyChange]);

  return {
    handleEnvironmentChange,
    handleApiKeyChange,
    handleApiKeyKeyDown,
  };
}
