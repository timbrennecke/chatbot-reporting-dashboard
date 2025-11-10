import { Eye, EyeOff, Key, Power, Trash2 } from 'lucide-react';
import type React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface AppHeaderProps {
  environment: string;
  onEnvironmentChange: (env: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onApiKeyKeyDown: (e: React.KeyboardEvent) => void;
  showApiKey: boolean;
  onToggleApiKeyVisibility: () => void;
  hasOfflineData: boolean;
  onClearData: () => void;
  onServerShutdown: () => void;
}

export function AppHeader({
  environment,
  onEnvironmentChange,
  apiKey,
  onApiKeyChange,
  onApiKeyKeyDown,
  showApiKey,
  onToggleApiKeyVisibility,
  hasOfflineData,
  onClearData,
  onServerShutdown,
}: AppHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">🤖</div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#191970' }}>
                CHECK24 Bot Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Environment Dropdown */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Environment:</Label>
              <Select value={environment} onValueChange={onEnvironmentChange}>
                <SelectTrigger className="w-32" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div className="flex items-center gap-2">
              <Label htmlFor="dashboard-api-key" className="text-sm font-medium">
                API Key:
              </Label>
              <div className="relative">
                <Input
                  id="dashboard-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  onKeyDown={onApiKeyKeyDown}
                  placeholder="Enter API key"
                  className="w-48 text-sm"
                  style={{ paddingRight: '40px' }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-0 h-full w-8 hover:bg-transparent flex items-center justify-center"
                  onClick={onToggleApiKeyVisibility}
                >
                  {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
              {apiKey && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Key className="h-3 w-3" />
                  <span>Saved</span>
                </div>
              )}
            </div>

            {hasOfflineData && (
              <>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 bg-blue-100 text-blue-800"
                >
                  📴 Offline Mode Active
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearData}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Data
                </Button>
              </>
            )}

            {/* Close App Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onServerShutdown}
              className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600"
              title="Close the application"
            >
              <Power className="h-4 w-4" />
              Close App
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
