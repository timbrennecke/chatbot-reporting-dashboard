import React, { useCallback, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, FileText, CheckCircle, XCircle, Clipboard, RefreshCw, Trash2 } from 'lucide-react';
import { validateJsonStructure, detectJsonType } from '../lib/utils';
import { UploadedData } from '../lib/types';

interface JsonUploadProps {
  onDataUploaded: (data: UploadedData) => void;
  onDataCleared?: () => void;
}

interface FileStatus {
  name: string;
  type: string | null;
  valid: boolean;
  error?: string;
  data?: any;
}

export function JsonUpload({ onDataUploaded, onDataCleared }: JsonUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [processing, setProcessing] = useState(false);

  const processJsonData = useCallback((jsonText: string, sourceName: string): { status: FileStatus; uploadedData: UploadedData } => {
    const uploadedData: UploadedData = {};
    
    try {
      const data = JSON.parse(jsonText);
      const detectedType = detectJsonType(data);
      
      if (!detectedType) {
        return {
          status: {
            name: sourceName,
            type: null,
            valid: false,
            error: 'Unknown JSON structure - does not match any expected API response format',
          },
          uploadedData: {}
        };
      }

      const validation = validateJsonStructure(data, detectedType);
      
      if (!validation.valid) {
        return {
          status: {
            name: sourceName,
            type: detectedType,
            valid: false,
            error: validation.error,
          },
          uploadedData: {}
        };
      }

      // Store valid data
      switch (detectedType) {
        case 'conversation':
          uploadedData.conversations = [data];
          break;
        case 'threads':
          uploadedData.threadsResponse = data;
          break;
        case 'attributes':
          uploadedData.attributesResponses = [data];
          break;
        case 'bulkAttributes':
          uploadedData.bulkAttributesResponses = [data];
          break;
      }

      return {
        status: {
          name: sourceName,
          type: detectedType,
          valid: true,
          data,
        },
        uploadedData
      };
    } catch (error) {
      return {
        status: {
          name: sourceName,
          type: null,
          valid: false,
          error: `JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        uploadedData: {}
      };
    }
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    const statuses: FileStatus[] = [];
    const combinedUploadedData: UploadedData = {};

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.json')) {
        statuses.push({
          name: file.name,
          type: null,
          valid: false,
          error: 'File must be a JSON file',
        });
        continue;
      }

      try {
        const text = await file.text();
        const { status, uploadedData } = processJsonData(text, file.name);
        statuses.push(status);

        // Combine uploaded data
        if (status.valid) {
          if (uploadedData.conversations) {
            if (!combinedUploadedData.conversations) combinedUploadedData.conversations = [];
            combinedUploadedData.conversations.push(...uploadedData.conversations);
          }
          if (uploadedData.threadsResponse) {
            combinedUploadedData.threadsResponse = uploadedData.threadsResponse;
          }
          if (uploadedData.attributesResponses) {
            if (!combinedUploadedData.attributesResponses) combinedUploadedData.attributesResponses = [];
            combinedUploadedData.attributesResponses.push(...uploadedData.attributesResponses);
          }
          if (uploadedData.bulkAttributesResponses) {
            if (!combinedUploadedData.bulkAttributesResponses) combinedUploadedData.bulkAttributesResponses = [];
            combinedUploadedData.bulkAttributesResponses.push(...uploadedData.bulkAttributesResponses);
          }
        }
      } catch (error) {
        statuses.push({
          name: file.name,
          type: null,
          valid: false,
          error: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    setFileStatuses(statuses);
    setUploading(false);

    // If we have any valid data, pass it to the parent
    const validFiles = statuses.filter(s => s.valid);
    if (validFiles.length > 0) {
      onDataUploaded(combinedUploadedData);
    }
  }, [onDataUploaded, processJsonData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const handleManualJsonUpload = useCallback(() => {
    if (!manualJson.trim()) {
      return;
    }

    setProcessing(true);
    const { status, uploadedData } = processJsonData(manualJson, `Manual JSON Paste ${new Date().toLocaleTimeString()}`);
    
    // Accumulate file statuses instead of replacing
    setFileStatuses(prev => [...prev, status]);
    
    if (status.valid) {
      onDataUploaded(uploadedData);
      // Clear the textarea after successful processing
      setManualJson('');
    }
    
    setProcessing(false);
  }, [manualJson, processJsonData, onDataUploaded]);

  const handleClearAll = useCallback(() => {
    setFileStatuses([]);
    setManualJson('');
    onDataCleared?.();
  }, [onDataCleared]);

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'conversation': return 'bg-blue-100 text-blue-800';
      case 'threads': return 'bg-green-100 text-green-800';
      case 'attributes': return 'bg-yellow-100 text-yellow-800';
      case 'bulkAttributes': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload JSON Data
        </CardTitle>
        <CardDescription>
          Upload JSON files or paste JSON content that matches the API response schemas for offline analysis.
          Supported types: Conversation, Threads, Attributes, Bulk Attributes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <Clipboard className="h-4 w-4" />
              Paste JSON
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="mb-4">
                Drag and drop JSON files here, or{' '}
                <label className="text-primary cursor-pointer hover:underline">
                  browse files
                  <input
                    type="file"
                    multiple
                    accept=".json"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              </p>
              <p className="text-sm text-muted-foreground">
                Accepts multiple .json files
              </p>
            </div>

            {uploading && (
              <Alert>
                <AlertDescription>Processing files...</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="manualJson">JSON Content</Label>
              <Textarea
                id="manualJson"
                placeholder={`Paste your JSON here, for example:
{
  "id": "01990f50-2c0a-76ff-8d8d-d13648d6bb15",
  "title": "Welcome to CHECK24",
  "createdAt": "2025-09-03T11:22:17.957Z",
  "lastMessageAt": "2025-09-03T11:25:31.143Z",
  "messages": [...],
  "threadIds": [...]
}`}
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
                disabled={processing}
                className="font-mono text-sm h-64 resize-none overflow-y-auto"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleManualJsonUpload}
                  disabled={processing || !manualJson.trim()}
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Process JSON
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setManualJson('')}
                  disabled={processing || !manualJson.trim()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {processing && (
              <Alert>
                <AlertDescription>Processing JSON content...</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        {fileStatuses.length > 0 && (
          <div className="space-y-2">
            <h4>Processing Results:</h4>
            {fileStatuses.map((status, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {status.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">{status.name}</span>
                  {status.type && (
                    <Badge className={getTypeColor(status.type)}>
                      {status.type}
                    </Badge>
                  )}
                </div>
                {status.error && (
                  <span className="text-sm text-red-600 max-w-md truncate">
                    {status.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {fileStatuses.some(s => s.valid) && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully processed {fileStatuses.filter(s => s.valid).length} valid JSON input(s).
              Data is now available for analysis in the dashboard.
            </AlertDescription>
          </Alert>
        )}

        {(fileStatuses.length > 0 || fileStatuses.some(s => s.valid)) && (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearAll}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}