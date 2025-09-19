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

export const getEnvironmentSpecificItem = (key: string): string | null => {
  return localStorage.getItem(getEnvironmentSpecificKey(key));
};

export const setEnvironmentSpecificItem = (key: string, value: string): void => {
  localStorage.setItem(getEnvironmentSpecificKey(key), value);
};

export const removeEnvironmentSpecificItem = (key: string): void => {
  localStorage.removeItem(getEnvironmentSpecificKey(key));
};

// Helper function to get API base URL based on environment
export const getApiBaseUrl = () => {
  const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
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
    timestamp: new Date().toISOString()
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
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
    
    console.log('🌐 Network error in online mode:', {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
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