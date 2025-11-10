import { useEffect, useState } from 'react';
import { getEnvironmentSpecificItem } from '../lib/api';

export function useApiKey(): {
  apiKey: string;
  setApiKey: (key: string) => void;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
} {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const savedApiKey = await getEnvironmentSpecificItem('chatbot-dashboard-api-key');
        if (savedApiKey) {
          setApiKey(savedApiKey);
        }
      } catch (_error) {
        // Silently fail - user can enter API key manually
      }
    };
    loadApiKey();
  }, []);

  return {
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
  };
}
