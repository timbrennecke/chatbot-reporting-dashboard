import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Settings, 
  Play, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { AttributesResponse, BulkAttributesResponse } from '../lib/types';
import { formatTimestamp } from '../lib/utils';

interface AttributesViewProps {
  uploadedAttributes?: AttributesResponse[];
  uploadedBulkAttributes?: BulkAttributesResponse[];
}

export function AttributesView({ 
  uploadedAttributes = [], 
  uploadedBulkAttributes = [] 
}: AttributesViewProps) {
  const [singleThreadId, setSingleThreadId] = useState('');
  const [bulkThreadIds, setBulkThreadIds] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<AttributesResponse | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkAttributesResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Combine uploaded data with API results
  const allSingleResults = [...uploadedAttributes, ...(singleResult ? [singleResult] : [])];
  const allBulkResults = [...uploadedBulkAttributes, ...bulkResults];

  const handleSingleAttributes = async () => {
    if (!singleThreadId.trim()) {
      setError('Please enter a thread ID');
      return;
    }

    setSingleLoading(true);
    setError(null);

    try {
      const response = await api.triggerAttributes(singleThreadId.trim());
      setSingleResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`API Error (${err.endpoint}): ${err.message}${err.requestId ? ` [${err.requestId}]` : ''}`);
      } else {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBulkAttributes = async () => {
    const threadIds = bulkThreadIds
      .split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (threadIds.length === 0) {
      setError('Please enter at least one thread ID');
      return;
    }

    setBulkLoading(true);
    setError(null);

    try {
      const request = {
        threads: threadIds.map(threadId => ({ threadId })),
      };

      const response = await api.getBulkAttributes(request);
      setBulkResults(prev => [...prev, response]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Bulk API Error (${err.endpoint}): ${err.message}${err.requestId ? ` [${err.requestId}]` : ''}`);
      } else {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string, success: boolean) => {
    if (!success) {
      return <Badge variant="destructive">Failed</Badge>;
    }

    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Attributes Processing</h1>
        <p className="text-muted-foreground">
          Trigger and monitor attribute processing for threads
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-100 border-red-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Single Thread Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Single Thread Processing
          </CardTitle>
          <CardDescription>
            Process attributes for a single thread
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="singleThreadId">Thread ID</Label>
              <Input
                id="singleThreadId"
                placeholder="home/01990f50-31de-72fd-89a6-d08b5b3d9a8f"
                value={singleThreadId}
                onChange={(e) => setSingleThreadId(e.target.value)}
                disabled={singleLoading}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSingleAttributes} 
                disabled={singleLoading || !singleThreadId.trim()}
              >
                {singleLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Process
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Single Results Display */}
          {allSingleResults.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Single Processing Results:</h4>
              <div className="space-y-2">
                {allSingleResults.map((result, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.meta.status)}
                        <span>Thread: {singleThreadId}</span>
                      </div>
                      {getStatusBadge(result.meta.status, result.meta.success)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div>Success: {result.meta.success ? 'Yes' : 'No'}</div>
                      <div>Scheduled for: {formatTimestamp(result.meta.scheduledFor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Bulk Processing
          </CardTitle>
          <CardDescription>
            Process attributes for multiple threads at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bulkThreadIds">Thread IDs (one per line)</Label>
            <Textarea
              id="bulkThreadIds"
              placeholder={`home/01990f50-31de-72fd-89a6-d08b5b3d9a8f
internet/01990f50-31de-72fd-89a6-d08b5b3d9a8e
mobile/01990f50-31de-72fd-89a6-d08b5b3d9a8d`}
              value={bulkThreadIds}
              onChange={(e) => setBulkThreadIds(e.target.value)}
              disabled={bulkLoading}
              rows={5}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter one thread ID per line
            </p>
          </div>

          <Button 
            onClick={handleBulkAttributes} 
            disabled={bulkLoading || !bulkThreadIds.trim()}
            className="w-full"
          >
            {bulkLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing Bulk...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Process Bulk
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Results */}
      {allBulkResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Processing Results</CardTitle>
            <CardDescription>
              Results from bulk attribute processing requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {allBulkResults.map((bulkResult, bulkIndex) => (
                <div key={bulkIndex} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">
                    Bulk Request #{bulkIndex + 1}
                  </h4>

                  {/* Success Results */}
                  {bulkResult.results.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Successful ({bulkResult.results.length})
                      </h5>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Thread ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Scheduled For</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkResult.results.map((result, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-sm">
                                  {result.threadId.threadId}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(result.meta.status)}
                                    {getStatusBadge(result.meta.status, result.meta.success)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatTimestamp(result.meta.scheduledFor)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Error Results */}
                  {bulkResult.errors.length > 0 && (
                    <div>
                      <h5 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Errors ({bulkResult.errors.length})
                      </h5>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Thread ID</TableHead>
                              <TableHead>Error Code</TableHead>
                              <TableHead>Message</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkResult.errors.map((error, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-sm">
                                  {error.threadId.threadId}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive">{error.code}</Badge>
                                </TableCell>
                                <TableCell>{error.message}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Total Requests: {bulkResult.results.length + bulkResult.errors.length}</span>
                      <span>Success Rate: {((bulkResult.results.length / (bulkResult.results.length + bulkResult.errors.length)) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Panel */}
      <Card>
        <CardHeader>
          <CardTitle>About Attribute Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Single Processing:</strong> Triggers attribute processing for a single thread. 
              The API returns a scheduling confirmation with status and timing information.
            </p>
            <p>
              <strong>Bulk Processing:</strong> Processes multiple threads in a single request. 
              Returns separate results and errors arrays to handle partial failures gracefully.
            </p>
            <p>
              <strong>Status Meanings:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Pending:</strong> Processing has been scheduled but not yet started</li>
              <li><strong>Processing:</strong> Currently analyzing the thread content</li>
              <li><strong>Completed:</strong> Analysis finished successfully</li>
              <li><strong>Failed:</strong> Processing encountered an error</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}