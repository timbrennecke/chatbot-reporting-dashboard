import { 
  Conversation, 
  ThreadsResponse, 
  ThreadsRequest, 
  AttributesResponse, 
  BulkAttributesRequest, 
  BulkAttributesResponse 
} from './types';

// Helper functions for environment-specific localStorage
export const getEnvironmentSpecificKey = (key: string): string => {
  const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
  return `${key}-${environment}`;
};

export const getEnvironmentSpecificItem = async (key: string): Promise<string | null> => {
  return localStorage.getItem(getEnvironmentSpecificKey(key));
};

export const setEnvironmentSpecificItem = async (key: string, value: string): Promise<void> => {
  localStorage.setItem(getEnvironmentSpecificKey(key), value);
};

export const removeEnvironmentSpecificItem = async (key: string): Promise<void> => {
  localStorage.removeItem(getEnvironmentSpecificKey(key));
};

// Helper function to get API base URL based on environment
export const getApiBaseUrl = () => {
  const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
  // Use proxy paths for web mode
  return environment === 'production' ? '/api' : '/api-test';
};

const API_BASE_URL = '/api';

// Global offline mode flag
let isGlobalOfflineMode = false;

export const setGlobalOfflineMode = (offline: boolean) => {
  isGlobalOfflineMode = offline;
  console.log('🔒 Global offline mode set to:', offline);
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  timeoutMs: 60000, // 60 seconds timeout
};

// Helper function for exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// Helper function to create a timeout promise
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryAttempt: number = 0
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  // GLOBAL OFFLINE MODE BLOCK
  if (isGlobalOfflineMode) {
    console.log('🔒 API call blocked - offline mode active:', {
      endpoint,
      timestamp: new Date().toISOString()
    });
    throw new ApiError(
      'API calls are disabled while uploaded data is present. Please use offline data or clear all data to enable API mode.',
      undefined,
      endpoint
    );
  }
  
  // DEBUG: Log API calls in online mode
  console.log('🌐 API call allowed - online mode:', {
    endpoint,
    url,
    attempt: retryAttempt + 1,
    maxRetries: RETRY_CONFIG.maxRetries,
    timestamp: new Date().toISOString()
  });
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  try {
    // Create fetch promise with timeout
    const fetchPromise = fetch(url, {
      ...options,
      headers,
    });
    
    // Race between fetch and timeout
    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(RETRY_CONFIG.timeoutMs)
    ]);

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      // Check if this is a retryable error (5xx or 408 Request Timeout)
      const isRetryable = (response.status >= 500 && response.status < 600) || response.status === 408;
      
      if (isRetryable && retryAttempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(retryAttempt);
        console.log(`⏳ Retrying ${endpoint} in ${delay}ms (attempt ${retryAttempt + 1}/${RETRY_CONFIG.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiRequest<T>(endpoint, options, retryAttempt + 1);
      }
      
      throw new ApiError(
        errorMessage,
        response.status,
        endpoint,
        requestId || undefined
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Check if this is a network error that might be retryable
    const isNetworkError = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    );
    
    if (isNetworkError && retryAttempt < RETRY_CONFIG.maxRetries) {
      const delay = getRetryDelay(retryAttempt);
      console.log(`⏳ Retrying ${endpoint} after network error in ${delay}ms (attempt ${retryAttempt + 1}/${RETRY_CONFIG.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiRequest<T>(endpoint, options, retryAttempt + 1);
    }
    
    console.log('🌐 Network error in online mode:', {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempt: retryAttempt + 1,
      timestamp: new Date().toISOString()
    });
    
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      endpoint
    );
  }
}

export const api = {
  async getConversation(conversationId: string): Promise<Conversation> {
    return apiRequest<Conversation>(`/conversation/${conversationId}`);
  },

  async getThreads(request: ThreadsRequest): Promise<ThreadsResponse> {
    return apiRequest<ThreadsResponse>('/thread', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async triggerAttributes(threadId: string): Promise<AttributesResponse> {
    return apiRequest<AttributesResponse>('/attributes', {
      method: 'POST',
      body: JSON.stringify({ threadId }),
    });
  },

  async getBulkAttributes(request: BulkAttributesRequest): Promise<BulkAttributesResponse> {
    return apiRequest<BulkAttributesResponse>('/attributes/bulk', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};