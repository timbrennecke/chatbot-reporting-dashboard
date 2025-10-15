import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Search, RefreshCw } from 'lucide-react';

interface ConversationSearchProps {
  conversationSearchId: string;
  onConversationSearchIdChange: (id: string) => void;
  onSearch: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent) => void;
  searchLoading: boolean;
  searchError: string | null;
  apiKey: string;
}

export function ConversationSearch({
  conversationSearchId,
  onConversationSearchIdChange,
  onSearch,
  onSearchKeyDown,
  searchLoading,
  searchError,
  apiKey,
}: ConversationSearchProps) {
  const isDisabled = searchLoading || !conversationSearchId.trim() || !apiKey.trim();

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Conversation Search
              </h2>
              <p className="text-slate-600">
                Enter a conversation ID to fetch and view the conversation details
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="conversation-search" className="text-base font-medium">
                  Conversation ID
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="conversation-search"
                    type="text"
                    value={conversationSearchId}
                    onChange={(e) => onConversationSearchIdChange(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Paste your conversation ID here..."
                    className="flex-1 text-center text-lg py-3"
                    disabled={searchLoading}
                  />
                  <Button
                    onClick={onSearch}
                    disabled={isDisabled}
                    size="lg"
                    variant="outline"
                    className="px-4 py-3"
                    title="Search"
                  >
                    {searchLoading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button
                onClick={onSearch}
                disabled={isDisabled}
                size="lg"
                className="w-full bg-black hover:bg-black/90 text-white py-3 text-base font-medium"
              >
                {searchLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Conversation'
                )}
              </Button>
              
              {!apiKey.trim() && (
                <p className="text-sm text-amber-600">
                  Please set your API key in the header first
                </p>
              )}
              
              {searchError && (
                <Alert variant="destructive" className="text-left bg-red-100 border-red-300">
                  <AlertDescription className="text-red-800">
                    {searchError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
