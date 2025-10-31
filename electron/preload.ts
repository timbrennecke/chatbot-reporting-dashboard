import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs that match your current system exactly
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations - same interface as your JsonUpload
  uploadJsonFiles: () => ipcRenderer.invoke('upload-json-files'),
  
  // Search operations - same interface as your useConversationSearch
  searchConversationById: (conversationId: string, apiKey: string) => 
    ipcRenderer.invoke('search-conversation-by-id', conversationId, apiKey),
  
  // New: Keyword search for unlimited data
  searchConversationsByKeyword: (keyword: string, options?: any) =>
    ipcRenderer.invoke('search-conversations-by-keyword', keyword, options),
  
  // API data loading
  loadConversationsFromAPI: (startDate: string, endDate: string, apiKey: string) =>
    ipcRenderer.invoke('load-conversations-from-api', startDate, endDate, apiKey),
  
  // Data operations - same interface as your current system
  getUploadedData: () => ipcRenderer.invoke('get-uploaded-data'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  
  // NEW: Pagination for better performance
  getPaginatedThreads: (page: number, pageSize: number) => 
    ipcRenderer.invoke('get-paginated-threads', page, pageSize),
  getAllThreadsOptimized: () => ipcRenderer.invoke('get-all-threads-optimized'),
  getPaginatedConversations: (page: number, pageSize: number) =>
    ipcRenderer.invoke('get-paginated-conversations', page, pageSize),
  
  // Environment management - maintains your current system
  getEnvironmentData: (environment: string) => 
    ipcRenderer.invoke('get-environment-data', environment),
  setEnvironmentData: (environment: string, data: any) =>
    ipcRenderer.invoke('set-environment-data', environment, data),
  
  // Environment switching
  getCurrentEnvironment: () => ipcRenderer.invoke('get-current-environment'),
  setCurrentEnvironment: (environment: string) =>
    ipcRenderer.invoke('set-current-environment', environment),
  
  // Stats
  getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),
});

// Type declaration for your React components
declare global {
  interface Window {
    electronAPI: {
      uploadJsonFiles: () => Promise<{
        success: boolean;
        imported: number;
        errors: string[];
        uploadedData: any;
      } | null>;
      searchConversationById: (conversationId: string, apiKey: string) => Promise<{
        conversation: any | null;
        thread: any | null;
      }>;
      searchConversationsByKeyword: (keyword: string, options?: {
        limit?: number;
        offset?: number;
      }) => Promise<Array<{ conversation?: any; thread?: any }>>;
      loadConversationsFromAPI: (startDate: string, endDate: string, apiKey: string) => Promise<number>;
      getUploadedData: () => Promise<any>;
      clearAllData: () => Promise<void>;
      getPaginatedThreads: (page: number, pageSize: number) => Promise<{
        threads: any[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
      getAllThreadsOptimized: () => Promise<any[]>;
      getPaginatedConversations: (page: number, pageSize: number) => Promise<{
        conversations: any[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
      getEnvironmentData: (environment: string) => Promise<any>;
      setEnvironmentData: (environment: string, data: any) => Promise<void>;
      getCurrentEnvironment: () => Promise<string>;
      setCurrentEnvironment: (environment: string) => Promise<void>;
      getStorageStats: () => Promise<{
        totalConversations: number;
        totalThreads: number;
        totalAttributes: number;
        totalBulkAttributes: number;
        currentEnvironment: string;
        databaseSize: number;
        databasePath: string;
      }>;
    };
  }
}
