import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Thread } from '../lib/types';
import { TrendingUp, Info } from 'lucide-react';
import { TOPIC_KEYWORDS } from '../lib/constants';
import { categorizeThread } from '../lib/categorization';

interface IntentAnalysisProps {
  threads: Thread[];
  onTopicClick?: (topicName: string) => void;
}

interface TopicFrequency {
  topic: string;
  count: number;
  percentage: number;
  examples: string[];
}

export function IntentAnalysis({ threads, onTopicClick }: IntentAnalysisProps) {
  const [showKeywords, setShowKeywords] = useState(false);
  
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (showKeywords) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showKeywords]);
  
  const topicAnalysis = useMemo(() => {
    if (!threads || threads.length === 0) return [];

    // Use the shared categorization function for consistency
    const topicCounts: { [key: string]: { count: number; examples: string[] } } = {};

    threads.forEach(thread => {
      const category = categorizeThread(thread);
      if (!category) return;

      // Get first user message for examples
      const firstUserMessage = thread.messages
        ?.filter(m => m.role === 'user')
        ?.sort((a, b) => {
          const timeA = new Date(a.sentAt).getTime();
          const timeB = new Date(b.sentAt).getTime();
          return timeA - timeB;
        })[0];

      const messageText = firstUserMessage?.content
        ?.map(content => content.text || content.content || '')
        .join(' ')
        .trim() || '';

      if (!topicCounts[category]) {
        topicCounts[category] = { count: 0, examples: [] };
      }
      topicCounts[category].count++;
          
          // Store up to 2 examples per topic
      if (topicCounts[category].examples.length < 2 && messageText) {
        const truncatedText = messageText.length > 60 
          ? messageText.substring(0, 60) + '...' 
          : messageText;
        topicCounts[category].examples.push(truncatedText);
      }
    });

    // Calculate percentages and create results
    const totalMessages = threads.length;
    const results: TopicFrequency[] = Object.entries(topicCounts)
      .map(([topic, data]) => ({
        topic,
        count: data.count,
        percentage: totalMessages > 0 ? Math.round((data.count / totalMessages) * 100) : 0,
        examples: data.examples
      }))
      .filter(result => result.count > 0)
      .sort((a, b) => b.count - a.count);

    return results;
  }, [threads]);

  if (!threads || threads.length === 0) {
    return null;
  }

  const totalAnalyzed = threads.length;
  const topicsFound = topicAnalysis.length;

  if (topicsFound === 0) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Topic Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-500">No common topics found in {totalAnalyzed} chats.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Topic Analysis ({totalAnalyzed} chats, {topicsFound} topics)
          </CardTitle>
          <button
            onClick={() => setShowKeywords(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors"
            title="View Keywords"
          >
            <Info className="h-3 w-3" />
            Keywords
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {topicAnalysis.map((topic) => (
            <div 
              key={topic.topic} 
              className={`text-center p-3 bg-gray-50 rounded-lg hover:bg-blue-100 transition-colors group relative ${onTopicClick ? 'cursor-pointer hover:shadow-md' : ''}`}
              onClick={() => onTopicClick?.(topic.topic)}
              title={onTopicClick ? `Click to filter conversations by "${topic.topic}"` : undefined}
            >
              <div className="text-lg font-bold text-gray-900">{topic.count}</div>
              <div className="text-xs text-gray-600 leading-tight">{topic.topic}</div>
              <div className="text-xs text-gray-500 mt-1">{topic.percentage}%</div>
              {onTopicClick && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    
    {/* Keywords Popup Modal */}
    {showKeywords && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={() => setShowKeywords(false)}
      >
        <div 
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info className="h-5 w-5 text-blue-600" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Topic Analysis Keywords
              </h3>
            </div>
            <button
              onClick={() => setShowKeywords(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 8px',
                color: '#6b7280',
                borderRadius: '4px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px'
          }}>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#6b7280' }}>
              <p style={{ marginBottom: '8px' }}>
                <strong>📋 Transparency:</strong> Below are all the keywords used to categorize conversations. 
                Messages are matched against these keywords to determine their topic category.
              </p>
              <p style={{ margin: 0 }}>
                <strong>🔍 How it works:</strong> Each message is checked against all keyword lists. 
                If a message contains any keyword from a category, it gets assigned to that category.
              </p>
            </div>
            
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <pre style={{
                fontSize: '12px',
                color: '#374151',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                margin: 0
              }}>
{JSON.stringify(TOPIC_KEYWORDS, null, 2)}
              </pre>
            </div>
          </div>
          
          {/* Footer */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <button
              onClick={() => setShowKeywords(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
