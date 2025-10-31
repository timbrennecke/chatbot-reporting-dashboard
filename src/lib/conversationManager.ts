import { getApiBaseUrl, getEnvironmentSpecificItem } from './api';

export interface ConversationSearchResult {
  id: string;
  messages: any[];
  created_at?: string;
  createdAt?: string;
  sentAt?: string;
  dateRange?: string;
  storedAt?: number;
}

export interface LoadProgress {
  current: number;
  total: number;
  phase: 'fetching' | 'storing' | 'complete';
  message: string;
}

export class AllConversationsManager {
  private dbName = 'all-conversations-v1';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  public isLoaded = false;
  public totalCount = 0;
  private currentDateRange: string | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.error('IndexedDB failed to open:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('dateRange', 'dateRange', { unique: false });
          store.createIndex('storedAt', 'storedAt', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          console.log('📦 Created conversations object store');
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
          console.log('📦 Created metadata object store');
        }
      };
    });
  }

  // Fetch conversations from API in batches
  private async fetchConversationsBatch(
    offset: number, 
    limit: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<any[]> {
    try {
      const apiKey = getEnvironmentSpecificItem('chatbot-dashboard-api-key');
      if (!apiKey?.trim()) {
        throw new Error('API key is required');
      }

      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          startTimestamp: startDate.toISOString(),
          endTimestamp: endDate.toISOString(),
          offset,
          limit
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const threads = data.threads?.map((item: any) => item.thread) || [];
      
      // Convert threads to conversation-like objects
      return threads.map((thread: any) => ({
        id: thread.conversationId || thread.id,
        conversationId: thread.conversationId,
        createdAt: thread.createdAt,
        created_at: thread.createdAt,
        messages: thread.messages || [],
        threadId: thread.id,
        threadCreatedAt: thread.createdAt
      }));
    } catch (error) {
      console.error('Failed to fetch conversations batch:', error);
      throw error;
    }
  }

  // Store batch of conversations in IndexedDB
  private async storeBatchInDB(conversations: any[], dateRange: string): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(['conversations'], 'readwrite');
    const store = transaction.objectStore('conversations');
    
    const promises = conversations.map(conv => {
      const conversationWithMeta = {
        ...conv,
        dateRange,
        storedAt: Date.now(),
        // Ensure we have a timestamp for indexing
        created_at: conv.created_at || conv.createdAt || conv.sentAt || new Date().toISOString()
      };
      
      return new Promise<void>((resolve, reject) => {
        const request = store.put(conversationWithMeta);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    
    await Promise.all(promises);
  }

  // Store metadata about the loaded dataset
  private async storeMetadata(dateRange: string, totalCount: number): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    
    return new Promise((resolve, reject) => {
      const request = store.put({
        key: `dataset-${dateRange}`,
        dateRange,
        totalCount,
        loadedAt: Date.now(),
        isComplete: true
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Check if data for date range is already loaded
  private async isDataLoaded(dateRange: string): Promise<{ loaded: boolean; count: number }> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      
      return new Promise((resolve) => {
        const request = store.get(`dataset-${dateRange}`);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.isComplete) {
            resolve({ loaded: true, count: result.totalCount });
          } else {
            resolve({ loaded: false, count: 0 });
          }
        };
        request.onerror = () => resolve({ loaded: false, count: 0 });
      });
    } catch (error) {
      console.error('Error checking if data is loaded:', error);
      return { loaded: false, count: 0 };
    }
  }

  // Clear existing data for date range
  private async clearDateRange(dateRange: string): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(['conversations', 'metadata'], 'readwrite');
    const conversationsStore = transaction.objectStore('conversations');
    const metadataStore = transaction.objectStore('metadata');
    
    // Clear conversations for this date range
    const index = conversationsStore.index('dateRange');
    const range = IDBKeyRange.only(dateRange);
    
    return new Promise((resolve, reject) => {
      const deleteRequest = index.openCursor(range);
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Clear metadata
          metadataStore.delete(`dataset-${dateRange}`);
          resolve();
        }
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  // Main method: Load all conversations for date range
  async loadAllConversations(
    startDate: Date, 
    endDate: Date,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<number> {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    // Check if already loaded
    const { loaded, count } = await this.isDataLoaded(dateRange);
    if (loaded) {
      console.log(`✅ Data already loaded: ${count} conversations`);
      this.isLoaded = true;
      this.totalCount = count;
      this.currentDateRange = dateRange;
      onProgress?.({
        current: count,
        total: count,
        phase: 'complete',
        message: `Using cached data: ${count} conversations`
      });
      return count;
    }

    console.log('🔄 Loading ALL conversations for date range:', dateRange);
    
    // Clear any existing data for this date range
    await this.clearDateRange(dateRange);
    
    const batchSize = 100;
    let offset = 0;
    let totalFetched = 0;
    let hasMore = true;
    
    onProgress?.({
      current: 0,
      total: 0,
      phase: 'fetching',
      message: 'Starting to fetch conversations...'
    });

    while (hasMore) {
      try {
        onProgress?.({
          current: totalFetched,
          total: totalFetched + batchSize, // Estimate
          phase: 'fetching',
          message: `Fetching conversations ${offset + 1}-${offset + batchSize}...`
        });

        // Fetch batch from API
        const batch = await this.fetchConversationsBatch(offset, batchSize, startDate, endDate);
        
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        onProgress?.({
          current: totalFetched,
          total: totalFetched + batch.length,
          phase: 'storing',
          message: `Storing batch of ${batch.length} conversations...`
        });

        // Store batch in IndexedDB
        await this.storeBatchInDB(batch, dateRange);
        
        totalFetched += batch.length;
        offset += batchSize;
        
        console.log(`📦 Stored batch: ${totalFetched} conversations`);
        
        // Yield to browser to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        console.error('Error fetching batch:', error);
        throw new Error(`Failed to load conversations: ${error.message}`);
      }
    }
    
    // Store metadata
    await this.storeMetadata(dateRange, totalFetched);
    
    this.totalCount = totalFetched;
    this.isLoaded = true;
    this.currentDateRange = dateRange;
    
    onProgress?.({
      current: totalFetched,
      total: totalFetched,
      phase: 'complete',
      message: `✅ Loaded ${totalFetched} conversations`
    });
    
    console.log(`✅ Loaded ALL ${totalFetched} conversations into IndexedDB`);
    return totalFetched;
  }

  // Search through all stored conversations
  async searchAllConversations(
    keyword: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<ConversationSearchResult[]> {
    if (!this.isLoaded || !this.currentDateRange) {
      throw new Error('Conversations not loaded yet. Please load conversations first.');
    }
    
    console.log(`🔍 Searching through ${this.totalCount} conversations for: "${keyword}"`);
    
    const db = await this.initDB();
    const transaction = db.transaction(['conversations'], 'readonly');
    const store = transaction.objectStore('conversations');
    const index = store.index('dateRange');
    
    const results: ConversationSearchResult[] = [];
    let searchedCount = 0;
    const searchTerm = keyword.toLowerCase();
    
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(this.currentDateRange);
      const cursor = index.openCursor(range);
      
      cursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          const conversation = cursor.value;
          searchedCount++;
          
          // Search in this conversation
          if (this.conversationMatchesKeyword(conversation, searchTerm)) {
            results.push(conversation);
          }
          
          // Progress update every 500 conversations
          if (searchedCount % 500 === 0) {
            onProgress?.(searchedCount, this.totalCount);
            console.log(`🔍 Searched ${searchedCount}/${this.totalCount} conversations, found ${results.length} matches`);
          }
          
          cursor.continue();
        } else {
          console.log(`✅ Search complete: ${results.length} matches found`);
          resolve(results);
        }
      };
      
      cursor.onerror = () => {
        console.error('Search failed:', cursor.error);
        reject(cursor.error);
      };
    });
  }

  // Check if conversation matches keyword
  private conversationMatchesKeyword(conversation: any, searchTerm: string): boolean {
    // Search in all message content
    return conversation.messages?.some((message: any) => {
      if (!message.content) return false;
      
      return message.content.some((content: any) => {
        const text = (content.text || content.content || '').toLowerCase();
        return text.includes(searchTerm);
      });
    }) || false;
  }

  // Get conversation by ID
  async getConversationById(id: string): Promise<ConversationSearchResult | null> {
    const db = await this.initDB();
    const transaction = db.transaction(['conversations'], 'readonly');
    const store = transaction.objectStore('conversations');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all conversations for current date range (use with caution - might be large)
  async getAllConversations(): Promise<ConversationSearchResult[]> {
    if (!this.isLoaded || !this.currentDateRange) {
      throw new Error('Conversations not loaded yet');
    }

    const db = await this.initDB();
    const transaction = db.transaction(['conversations'], 'readonly');
    const store = transaction.objectStore('conversations');
    const index = store.index('dateRange');
    
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(this.currentDateRange);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all stored data
  async clearAllData(): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(['conversations', 'metadata'], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('conversations').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('metadata').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
    
    this.isLoaded = false;
    this.totalCount = 0;
    this.currentDateRange = null;
    
    console.log('🗑️ Cleared all stored conversation data');
  }

  // Get storage usage info
  async getStorageInfo(): Promise<{ usedBytes: number; availableBytes: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usedBytes: estimate.usage || 0,
        availableBytes: estimate.quota || 0
      };
    }
    return { usedBytes: 0, availableBytes: 0 };
  }
}
