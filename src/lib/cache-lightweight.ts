import { Thread, Conversation } from './types';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from './api';

// Ultra-lightweight thread summary for caching
interface ThreadSummary {
  i: string; // id (shortened key)
  c: string; // conversationId (shortened key)
  t: string; // createdAt timestamp (shortened key)
  u: number; // uiCount (shortened key)
  l: number; // linkoutCount (shortened key)
  e: boolean; // hasErrors (shortened key)
}

interface LightweightThreadCacheEntry {
  startTimestamp: string;
  endTimestamp: string;
  threadSummaries: ThreadSummary[];
  fetchedAt: number;
  expiresAt: number;
}

interface ConversationCacheEntry {
  conversation: Conversation;
  fetchedAt: number;
  expiresAt: number;
}

export class LightweightCache {
  private static THREAD_CACHE_KEY = 'chatbot-dashboard-lightweight-thread-cache';
  private static CONVERSATION_CACHE_KEY = 'chatbot-dashboard-conversation-cache';
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static MAX_CACHE_ENTRIES = 3; // Allow a few more entries
  private static MAX_THREADS_PER_CACHE = 10000; // Much higher limit - can handle large datasets
  
  // Convert full thread to lightweight summary
  private static threadToSummary(thread: Thread): ThreadSummary {
    const uiCount = thread.messages.reduce(
      (acc, msg) => acc + msg.content.filter(c => c.kind === 'ui').length, 
      0
    );
    const linkoutCount = thread.messages.reduce(
      (acc, msg) => acc + msg.content.filter(c => c.kind === 'linkout').length, 
      0
    );
    
    // Check for errors in system messages
    const hasErrors = thread.messages.some(message => {
      if (message.role === 'system') {
        return message.content.some(content => {
          const text = content.text || content.content || '';
          const errorPatterns = [
            /Agent execution error/gi,
            /Error:/gi,
            /Failed:/gi,
            /Exception:/gi,
            /Timeout/gi
          ];
          return errorPatterns.some(pattern => pattern.test(text));
        });
      }
      return false;
    });

    return {
      i: thread.id,
      c: thread.conversationId,
      t: thread.createdAt,
      u: uiCount,
      l: linkoutCount,
      e: hasErrors
    };
  }

  // Convert summary back to minimal thread (for display purposes)
  private static summaryToMinimalThread(summary: ThreadSummary): Thread {
    // Create minimal messages array with UI/linkout counts for display
    const messages = [];
    
    // Add dummy messages to represent UI events and linkouts for filtering/display
    for (let i = 0; i < summary.u; i++) {
      messages.push({
        id: `ui-${i}`,
        role: 'assistant' as const,
        content: [{ kind: 'ui' as const }],
        sentAt: summary.t
      });
    }
    
    for (let i = 0; i < summary.l; i++) {
      messages.push({
        id: `linkout-${i}`,
        role: 'assistant' as const,
        content: [{ kind: 'linkout' as const }],
        sentAt: summary.t
      });
    }
    
    // Add error message if thread has errors
    if (summary.e) {
      messages.push({
        id: 'error-msg',
        role: 'system' as const,
        content: [{ kind: 'text' as const, text: 'Error: Cached thread had errors' }],
        sentAt: summary.t
      });
    }
    
    // Ensure at least one message exists for compatibility
    if (messages.length === 0) {
      messages.push({
        id: 'placeholder',
        role: 'assistant' as const,
        content: [{ kind: 'text' as const, text: 'Cached thread data' }],
        sentAt: summary.t
      });
    }
    
    return {
      id: summary.i,
      conversationId: summary.c,
      createdAt: summary.t,
      messages
    };
  }

  // Thread caching methods
  static getThreadCache(): LightweightThreadCacheEntry[] {
    try {
      const cached = getEnvironmentSpecificItem(this.THREAD_CACHE_KEY);
      if (!cached) return [];
      
      const entries: LightweightThreadCacheEntry[] = JSON.parse(cached);
      const now = Date.now();
      
      // Filter out expired entries
      const validEntries = entries.filter(entry => entry.expiresAt > now);
      
      // Save back the cleaned cache if we removed expired entries
      if (validEntries.length !== entries.length) {
        this.saveThreadCache(validEntries);
      }
      
      return validEntries;
    } catch (error) {
      console.error('Failed to load lightweight thread cache:', error);
      return [];
    }
  }

  static saveThreadCache(entries: LightweightThreadCacheEntry[]): void {
    try {
      // Keep only most recent entries
      const limitedEntries = entries
        .sort((a, b) => b.fetchedAt - a.fetchedAt)
        .slice(0, this.MAX_CACHE_ENTRIES);
      
      let serialized = JSON.stringify(limitedEntries);
      
      // If still too large, progressively reduce until it fits
      let entriesToSave = limitedEntries;
      while (serialized.length > 3000000 && entriesToSave.length > 0) { // 3MB limit - much more generous
        // Remove the entry with the most threads first
        entriesToSave = entriesToSave.sort((a, b) => a.threadSummaries.length - b.threadSummaries.length);
        entriesToSave = entriesToSave.slice(0, -1); // Remove largest entry
        serialized = JSON.stringify(entriesToSave);
        
        if (entriesToSave.length < limitedEntries.length) {
          console.warn(`Lightweight cache still too large, reduced to ${entriesToSave.length} entries`);
        }
      }
      
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, serialized);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('Even lightweight cache exceeded quota, clearing all cache');
        this.clearAllCache();
      } else {
        console.error('Failed to save lightweight thread cache:', error);
      }
    }
  }

  static findCachedThreadSummaries(startTimestamp: string, endTimestamp: string): ThreadSummary[] | null {
    const cache = this.getThreadCache();
    
    if (cache.length === 0) {
      return null;
    }
    
    // Look for exact match first
    const exactMatch = cache.find(entry => 
      entry.startTimestamp === startTimestamp && 
      entry.endTimestamp === endTimestamp
    );
    
    if (exactMatch) {
      return exactMatch.threadSummaries;
    }

    // Look for a cached range that contains the requested range
    const requestStart = new Date(startTimestamp).getTime();
    const requestEnd = new Date(endTimestamp).getTime();
    
    const containerMatch = cache.find((entry, index) => {
      const entryStart = new Date(entry.startTimestamp).getTime();
      const entryEnd = new Date(entry.endTimestamp).getTime();
      
      return entryStart <= requestStart && entryEnd >= requestEnd;
    });

    if (containerMatch) {
      // Filter thread summaries to match the requested time range
      const requestStart = new Date(startTimestamp).getTime();
      const requestEnd = new Date(endTimestamp).getTime();
      
      const filteredSummaries = containerMatch.threadSummaries.filter(summary => {
        const threadTime = new Date(summary.t).getTime();
        return threadTime >= requestStart && threadTime <= requestEnd;
      });
      
      return filteredSummaries;
    }

    // If no container match, try a more lenient approach for recent queries
    
    const leniencyMs = 5 * 60 * 1000; // 5 minutes tolerance
    const leniencyHours = 2 * 60 * 60 * 1000; // 2 hours tolerance for range size differences
    
    const leniencyMatch = cache.find((entry, index) => {
      const entryStart = new Date(entry.startTimestamp).getTime();
      const entryEnd = new Date(entry.endTimestamp).getTime();
      
      // Allow some tolerance in start/end times and check if ranges overlap significantly
      const startClose = Math.abs(entryStart - requestStart) <= leniencyMs;
      const endClose = Math.abs(entryEnd - requestEnd) <= leniencyMs;
      const entryContainsRequest = (entryStart - leniencyHours) <= requestStart && (entryEnd + leniencyHours) >= requestEnd;
      const significantOverlap = (Math.min(entryEnd, requestEnd) - Math.max(entryStart, requestStart)) > 0;
      
      // Calculate what percentage of the request is covered by this entry
      const overlapStart = Math.max(entryStart, requestStart);
      const overlapEnd = Math.min(entryEnd, requestEnd);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const requestDuration = requestEnd - requestStart;
      const coveragePercent = (overlapDuration / requestDuration) * 100;
      
      // Only use lenient matching for near-complete matches (>80% coverage)
      // This prevents partial matches from being treated as full cache hits
      const isNearCompleteMatch = coveragePercent > 80 && (startClose || endClose || entryContainsRequest);
      
      return isNearCompleteMatch;
    });
    
    if (leniencyMatch) {
      // Filter thread summaries to match the requested time range
      const filteredSummaries = leniencyMatch.threadSummaries.filter(summary => {
        const threadTime = new Date(summary.t).getTime();
        return threadTime >= (requestStart - leniencyMs) && threadTime <= (requestEnd + leniencyMs);
      });
      
      console.log(`✂️ Lenient filtered ${filteredSummaries.length} threads from ${leniencyMatch.threadSummaries.length} cached summaries`);
      return filteredSummaries;
    }

    console.log('❌ No cache match found (strict or lenient)');
    return null;
  }

  // Check if cache can partially serve the request and identify missing ranges
  static analyzePartialCacheHit(startTimestamp: string, endTimestamp: string): {
    canPartiallyServe: boolean;
    cachedData: ThreadSummary[];
    missingRanges: { start: string; end: string }[];
    cacheEntry?: LightweightThreadCacheEntry;
  } {
    const cache = this.getThreadCache();
    const requestStart = new Date(startTimestamp).getTime();
    const requestEnd = new Date(endTimestamp).getTime();
    
    if (cache.length === 0) {
      return {
        canPartiallyServe: false,
        cachedData: [],
        missingRanges: [{ start: startTimestamp, end: endTimestamp }]
      };
    }
    
    // Find the best overlapping cache entry
    let bestEntry: LightweightThreadCacheEntry | null = null;
    let bestOverlap = 0;
    
    cache.forEach((entry, index) => {
      const entryStart = new Date(entry.startTimestamp).getTime();
      const entryEnd = new Date(entry.endTimestamp).getTime();
      
      // Calculate overlap
      const overlapStart = Math.max(entryStart, requestStart);
      const overlapEnd = Math.min(entryEnd, requestEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      
      console.log(`  Entry ${index}: ${new Date(entryStart).toLocaleString()} - ${new Date(entryEnd).toLocaleString()}`);
      console.log(`    Overlap: ${Math.round(overlap / (1000 * 60 * 60))}h (${Math.round((overlap / (requestEnd - requestStart)) * 100)}% of request)`);
      
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestEntry = entry;
      }
    });
    
    if (!bestEntry || bestOverlap === 0) {
      console.log('❌ No useful overlap found');
      return {
        canPartiallyServe: false,
        cachedData: [],
        missingRanges: [{ start: startTimestamp, end: endTimestamp }]
      };
    }
    
    const entryStart = new Date(bestEntry.startTimestamp).getTime();
    const entryEnd = new Date(bestEntry.endTimestamp).getTime();
    const overlapPercent = (bestOverlap / (requestEnd - requestStart)) * 100;
    
    // Only use partial cache if overlap is significant (>10% - lowered threshold)
    if (overlapPercent < 10) {
      console.log(`❌ Overlap too small (${Math.round(overlapPercent)}%), not worth partial cache`);
      return {
        canPartiallyServe: false,
        cachedData: [],
        missingRanges: [{ start: startTimestamp, end: endTimestamp }]
      };
    }
    
    console.log(`✅ Found useful cache overlap: ${Math.round(overlapPercent)}% coverage`);
    
    // Filter cached data to the overlapping period
    const overlapStart = Math.max(entryStart, requestStart);
    const overlapEnd = Math.min(entryEnd, requestEnd);
    
    const cachedData = bestEntry.threadSummaries.filter(summary => {
      const threadTime = new Date(summary.t).getTime();
      return threadTime >= overlapStart && threadTime <= overlapEnd;
    });
    
    // Calculate missing ranges
    const missingRanges: { start: string; end: string }[] = [];
    
    // Missing range before cached data
    if (requestStart < overlapStart) {
      missingRanges.push({
        start: startTimestamp,
        end: new Date(overlapStart).toISOString()
      });
    }
    
    // Missing range after cached data
    if (requestEnd > overlapEnd) {
      missingRanges.push({
        start: new Date(overlapEnd).toISOString(),
        end: endTimestamp
      });
    }
    
    // Analysis complete
    
    return {
      canPartiallyServe: true,
      cachedData,
      missingRanges,
      cacheEntry: bestEntry
    };
  }

  // Merge cached data with newly fetched data
  static mergeCachedAndNewData(cachedSummaries: ThreadSummary[], newThreads: Thread[]): ThreadSummary[] {
    
    // Convert new threads to summaries
    const newSummaries = newThreads.map(thread => this.threadToSummary(thread));
    
    // Combine and deduplicate by thread ID
    const allSummaries = [...cachedSummaries, ...newSummaries];
    const uniqueSummaries = allSummaries.filter((summary, index, array) => 
      array.findIndex(s => s.i === summary.i) === index
    );
    
    // Sort by creation date (most recent first)
    uniqueSummaries.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());
    
    console.log(`✅ Merged result: ${uniqueSummaries.length} unique threads (removed ${allSummaries.length - uniqueSummaries.length} duplicates)`);
    
    return uniqueSummaries;
  }

  static cacheThreads(startTimestamp: string, endTimestamp: string, threads: Thread[]): void {
    const now = Date.now();
    
    // Try to cache all threads first, only sample if storage becomes an issue
    let threadsToCache = threads;
    let shouldSample = false;
    
    // Convert all threads to summaries to check size
    const allSummaries = threads.map(thread => this.threadToSummary(thread));
    const testEntry = {
      startTimestamp,
      endTimestamp,
      threadSummaries: allSummaries,
      fetchedAt: now,
      expiresAt: now + this.CACHE_TTL
    };
    
    const testSize = JSON.stringify(testEntry).length;
    
    // Only sample if the cache entry would be larger than 2MB
    if (testSize > 2000000) {
      shouldSample = true;
    }
    
    if (shouldSample && threads.length > this.MAX_THREADS_PER_CACHE) {
      // Sort by creation date (most recent first) and take a representative sample
      const sortedThreads = [...threads].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Take recent threads + evenly distributed older threads
      const recentThreads = sortedThreads.slice(0, Math.floor(this.MAX_THREADS_PER_CACHE * 0.8)); // 80% recent
      const olderThreads = sortedThreads.slice(Math.floor(this.MAX_THREADS_PER_CACHE * 0.8));
      
      // Sample from older threads evenly
      const sampleStep = Math.max(1, Math.floor(olderThreads.length / Math.floor(this.MAX_THREADS_PER_CACHE * 0.2)));
      const sampledOlderThreads = olderThreads.filter((_, index) => index % sampleStep === 0)
        .slice(0, Math.floor(this.MAX_THREADS_PER_CACHE * 0.2));
      
      threadsToCache = [...recentThreads, ...sampledOlderThreads];
    }
    
    // Convert threads to lightweight summaries
    const threadSummaries = threadsToCache.map(thread => this.threadToSummary(thread));
    
    const newEntry: LightweightThreadCacheEntry = {
      startTimestamp,
      endTimestamp,
      threadSummaries,
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
  }

  // Convert cached summaries back to minimal threads for display
  static summariesToMinimalThreads(summaries: ThreadSummary[]): Thread[] {
    const threads = summaries.map(summary => this.summaryToMinimalThread(summary));
    
    // Only log navigation issues if there are problems
    if (threads.length > 0) {
      const conversationIds = threads.map(t => t.conversationId);
      const uniqueConversationIds = new Set(conversationIds);
      const hasValidIds = conversationIds.every(id => id && id.length > 0);
      
      // Only warn about invalid IDs, not duplicates (some conversations can have multiple threads)
      if (!hasValidIds) {
        console.warn('🚨 Navigation issue detected - Invalid conversation IDs:', {
          totalThreads: threads.length,
          uniqueConversations: uniqueConversationIds.size,
          hasValidIds,
          invalidIds: conversationIds.filter(id => !id || id.length === 0)
        });
      }
    }
    
    return threads;
  }

  // Conversation caching (unchanged, but with smaller limits)
  static getConversationCache(): Map<string, ConversationCacheEntry> {
    try {
      const cached = getEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY);
      if (!cached) return new Map();
      
      const entries: Record<string, ConversationCacheEntry> = JSON.parse(cached);
      const now = Date.now();
      const validEntries = new Map<string, ConversationCacheEntry>();
      
      Object.entries(entries).forEach(([id, entry]) => {
        if (entry.expiresAt > now) {
          validEntries.set(id, entry);
        }
      });
      
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
      const entries = Object.fromEntries(cache);
      
      // Keep only most recent 5 conversations
      const sortedEntries = Object.entries(entries)
        .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
        .slice(0, 5);
      
      setEnvironmentSpecificItem(
        this.CONVERSATION_CACHE_KEY, 
        JSON.stringify(Object.fromEntries(sortedEntries))
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('Conversation cache exceeded quota, clearing');
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
  }

  // Cache management
  static clearAllCache(): void {
    try {
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, '[]');
      setEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY, '{}');
      console.log('🗑️ Cleared all lightweight cache data');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static getCacheStats(): { threadEntries: number; conversationEntries: number; totalSize: string } {
    const threadCache = this.getThreadCache();
    const conversationCache = this.getConversationCache();
    
    const threadCacheSize = JSON.stringify(threadCache).length;
    const conversationCacheSize = JSON.stringify(Object.fromEntries(conversationCache)).length;
    const totalSize = threadCacheSize + conversationCacheSize;
    
    return {
      threadEntries: threadCache.length,
      conversationEntries: conversationCache.size,
      totalSize: `${Math.round(totalSize / 1024)}KB`
    };
  }

  static debugCache(): void {
    console.log('🧪 LIGHTWEIGHT CACHE DEBUG:');
    
    // Show environment info
    const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
    console.log('🌍 Environment:', environment);
    
    const stats = this.getCacheStats();
    console.log('📊 Stats:', stats);
    
    // Show actual localStorage keys and sizes
    const threadKey = `${this.THREAD_CACHE_KEY}-${environment}`;
    const conversationKey = `${this.CONVERSATION_CACHE_KEY}-${environment}`;
    
    const threadData = localStorage.getItem(threadKey);
    const conversationData = localStorage.getItem(conversationKey);
    
    console.log('🔑 Cache Keys:');
    console.log(`  Thread: ${threadKey} (${threadData ? `${Math.round(threadData.length / 1024)}KB` : 'empty'})`);
    console.log(`  Conversation: ${conversationKey} (${conversationData ? `${Math.round(conversationData.length / 1024)}KB` : 'empty'})`);
    
    // Show total localStorage usage
    let totalSize = 0;
    let dashboardSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const itemSize = localStorage[key].length + key.length;
        totalSize += itemSize;
        if (key.includes('chatbot-dashboard')) {
          dashboardSize += itemSize;
        }
      }
    }
    
    console.log('💾 Storage Usage:');
    console.log(`  Total localStorage: ${Math.round(totalSize / 1024)}KB`);
    console.log(`  Dashboard data: ${Math.round(dashboardSize / 1024)}KB`);
    console.log(`  Usage: ${Math.round((totalSize / (5 * 1024 * 1024)) * 100)}%`);
    
    const threadCache = this.getThreadCache();
    console.log('📋 Cache Entries:');
    threadCache.forEach((entry, index) => {
      const isSampled = entry.threadSummaries.length === this.MAX_THREADS_PER_CACHE;
      const entrySize = JSON.stringify(entry).length;
      console.log(`  Entry ${index}:`, {
        range: `${new Date(entry.startTimestamp).toLocaleDateString()} - ${new Date(entry.endTimestamp).toLocaleDateString()}`,
        summaries: entry.threadSummaries.length + (isSampled ? ' (sampled)' : ''),
        size: `${Math.round(entrySize / 1024)}KB`,
        age: `${Math.round((Date.now() - entry.fetchedAt) / 1000 / 60)}min ago`
      });
    });
    
    if (threadCache.length === 0) {
      console.log('  ❌ No cache entries found for current environment');
      console.log('  💡 Tip: Perform a search to populate the cache, then try subset queries');
    }
  }

  // Simple cache status for user feedback
  static getCacheStatus(): string {
    const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
    const cache = this.getThreadCache();
    
    if (cache.length === 0) {
      return `No cache for ${environment}`;
    }
    
    const totalThreads = cache.reduce((sum, entry) => sum + entry.threadSummaries.length, 0);
    return `${cache.length} entries, ${totalThreads} threads (${environment})`;
  }
}
