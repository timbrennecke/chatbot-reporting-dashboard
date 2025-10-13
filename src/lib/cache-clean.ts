import { Thread, Conversation } from './types';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from './api';

interface ThreadCacheEntry {
  startTimestamp: string;
  endTimestamp: string;
  threads: Thread[];
  fetchedAt: number;
  expiresAt: number;
}

interface ConversationCacheEntry {
  conversation: Conversation;
  fetchedAt: number;
  expiresAt: number;
}

export class DataCache {
  private static THREAD_CACHE_KEY = 'chatbot-dashboard-thread-cache';
  private static CONVERSATION_CACHE_KEY = 'chatbot-dashboard-conversation-cache';
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static MAX_CACHE_ENTRIES = 5; // Reduced to prevent quota issues
  private static MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit to stay under localStorage quota

  // Thread caching methods
  static getThreadCache(): ThreadCacheEntry[] {
    try {
      const cached = getEnvironmentSpecificItem(this.THREAD_CACHE_KEY);
      if (!cached) return [];
      
      const entries: ThreadCacheEntry[] = JSON.parse(cached);
      const now = Date.now();
      
      // Filter out expired entries
      const validEntries = entries.filter(entry => entry.expiresAt > now);
      
      // Save back the cleaned cache if we removed expired entries
      if (validEntries.length !== entries.length) {
        this.saveThreadCache(validEntries);
      }
      
      return validEntries;
    } catch (error) {
      console.error('Failed to load thread cache:', error);
      return [];
    }
  }

  static saveThreadCache(entries: ThreadCacheEntry[]): void {
    try {
      // Limit cache size - keep most recent entries
      let limitedEntries = entries
        .sort((a, b) => b.fetchedAt - a.fetchedAt)
        .slice(0, this.MAX_CACHE_ENTRIES);
      
      // Check size and reduce if necessary
      let serialized = JSON.stringify(limitedEntries);
      while (serialized.length > this.MAX_STORAGE_SIZE && limitedEntries.length > 1) {
        limitedEntries = limitedEntries.slice(0, -1); // Remove oldest entry
        serialized = JSON.stringify(limitedEntries);
      }
      
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, serialized);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('Cache storage quota exceeded, clearing old cache data');
        this.clearAllCache();
      } else {
        console.error('Failed to save thread cache:', error);
      }
    }
  }

  static findCachedThreads(startTimestamp: string, endTimestamp: string): Thread[] | null {
    const cache = this.getThreadCache();
    
    // Look for exact match first
    const exactMatch = cache.find(entry => 
      entry.startTimestamp === startTimestamp && 
      entry.endTimestamp === endTimestamp
    );
    
    if (exactMatch) {
      console.log('🎯 Cache hit: Exact match');
      return exactMatch.threads;
    }

    // Look for a cached range that contains the requested range
    const containerMatch = cache.find(entry => {
      const entryStart = new Date(entry.startTimestamp).getTime();
      const entryEnd = new Date(entry.endTimestamp).getTime();
      const requestStart = new Date(startTimestamp).getTime();
      const requestEnd = new Date(endTimestamp).getTime();
      
      return entryStart <= requestStart && entryEnd >= requestEnd;
    });

    if (containerMatch) {
      console.log('🎯 Cache hit: Filtering from larger dataset');
      // Filter threads to match the requested time range
      const requestStart = new Date(startTimestamp).getTime();
      const requestEnd = new Date(endTimestamp).getTime();
      
      const filteredThreads = containerMatch.threads.filter(thread => {
        const threadTime = new Date(thread.createdAt).getTime();
        return threadTime >= requestStart && threadTime <= requestEnd;
      });
      
      return filteredThreads;
    }

    return null;
  }

  static cacheThreads(startTimestamp: string, endTimestamp: string, threads: Thread[]): void {
    const now = Date.now();
    const newEntry: ThreadCacheEntry = {
      startTimestamp,
      endTimestamp,
      threads,
      fetchedAt: now,
      expiresAt: now + this.CACHE_TTL
    };

    const cache = this.getThreadCache();
    
    // Remove any existing entry with the same time range
    const filteredCache = cache.filter(entry => 
      !(entry.startTimestamp === startTimestamp && entry.endTimestamp === endTimestamp)
    );
    
    // Add new entry
    filteredCache.push(newEntry);
    
    this.saveThreadCache(filteredCache);
    console.log('💾 Cached', threads.length, 'threads');
  }

  // Conversation caching methods
  static getConversationCache(): Map<string, ConversationCacheEntry> {
    try {
      const cached = getEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY);
      if (!cached) return new Map();
      
      const entries: Record<string, ConversationCacheEntry> = JSON.parse(cached);
      const now = Date.now();
      const validEntries = new Map<string, ConversationCacheEntry>();
      
      // Filter out expired entries
      Object.entries(entries).forEach(([id, entry]) => {
        if (entry.expiresAt > now) {
          validEntries.set(id, entry);
        }
      });
      
      // Save back cleaned cache if we removed expired entries
      if (validEntries.size !== Object.keys(entries).length) {
        this.saveConversationCache(validEntries);
      }
      
      return validEntries;
    } catch (error) {
      console.error('Failed to load conversation cache:', error);
      return new Map();
    }
  }

  static saveConversationCache(cache: Map<string, ConversationCacheEntry>): void {
    try {
      // Convert Map to object for JSON storage
      const entries = Object.fromEntries(cache);
      
      // Limit cache size - keep most recent entries
      let sortedEntries = Object.entries(entries)
        .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
        .slice(0, this.MAX_CACHE_ENTRIES * 3); // Reduced multiplier
      
      // Check size and reduce if necessary
      let serialized = JSON.stringify(Object.fromEntries(sortedEntries));
      while (serialized.length > this.MAX_STORAGE_SIZE && sortedEntries.length > 1) {
        sortedEntries = sortedEntries.slice(0, -1); // Remove oldest entry
        serialized = JSON.stringify(Object.fromEntries(sortedEntries));
      }
      
      setEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY, serialized);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('Conversation cache storage quota exceeded, clearing old cache data');
        this.clearAllCache();
      } else {
        console.error('Failed to save conversation cache:', error);
      }
    }
  }

  static getCachedConversation(conversationId: string): Conversation | null {
    const cache = this.getConversationCache();
    const entry = cache.get(conversationId);
    
    if (entry) {
      console.log('🎯 Conversation cache hit');
      return entry.conversation;
    }
    
    return null;
  }

  static cacheConversation(conversation: Conversation): void {
    const now = Date.now();
    const entry: ConversationCacheEntry = {
      conversation,
      fetchedAt: now,
      expiresAt: now + this.CACHE_TTL
    };

    const cache = this.getConversationCache();
    cache.set(conversation.id, entry);
    
    this.saveConversationCache(cache);
    console.log('💾 Cached conversation');
  }

  // Cache management methods
  static clearAllCache(): void {
    try {
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, '[]');
      setEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY, '{}');
      console.log('🗑️ Cleared all cache data');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static getCacheStats(): { threadEntries: number; conversationEntries: number; totalSize: string } {
    const threadCache = this.getThreadCache();
    const conversationCache = this.getConversationCache();
    
    // Rough size calculation (in characters, not exact bytes)
    const threadCacheSize = JSON.stringify(threadCache).length;
    const conversationCacheSize = JSON.stringify(Object.fromEntries(conversationCache)).length;
    const totalSize = threadCacheSize + conversationCacheSize;
    
    return {
      threadEntries: threadCache.length,
      conversationEntries: conversationCache.size,
      totalSize: `${Math.round(totalSize / 1024)}KB`
    };
  }

  // Check localStorage usage
  static getStorageUsage(): { used: number; available: number; percentage: number } {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Estimate localStorage limit (usually 5-10MB, we'll use 5MB as conservative estimate)
    const limit = 5 * 1024 * 1024;
    const available = Math.max(0, limit - used);
    const percentage = Math.round((used / limit) * 100);
    
    return { used, available, percentage };
  }

  // Simple debug function
  static debugCache(): void {
    console.log('🧪 CACHE DEBUG:');
    const stats = this.getCacheStats();
    console.log('Stats:', stats);
    
    const storageUsage = this.getStorageUsage();
    console.log('Storage usage:', `${Math.round(storageUsage.used / 1024)}KB (${storageUsage.percentage}%)`);
    
    const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
    console.log('Environment:', environment);
    
    const threadKey = `${this.THREAD_CACHE_KEY}-${environment}`;
    const conversationKey = `${this.CONVERSATION_CACHE_KEY}-${environment}`;
    
    const threadData = localStorage.getItem(threadKey);
    const conversationData = localStorage.getItem(conversationKey);
    
    console.log('Thread cache exists:', !!threadData);
    console.log('Conversation cache exists:', !!conversationData);
    
    if (storageUsage.percentage > 80) {
      console.warn('⚠️ localStorage usage is high, consider clearing cache');
    }
  }
}
