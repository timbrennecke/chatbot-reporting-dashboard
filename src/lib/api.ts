import { 
  Conversation, 
  ThreadsResponse, 
  ThreadsRequest, 
  AttributesResponse, 
  BulkAttributesRequest, 
  BulkAttributesResponse 
} from './types';

const API_BASE_URL = 'https://api.bot.check24.de';

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
  const url = `${API_BASE_URL}${endpoint}`;
  
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