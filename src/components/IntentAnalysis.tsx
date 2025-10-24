import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Thread } from '../lib/types';
import { TrendingUp, Info } from 'lucide-react';

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

// Define key topics/keywords to look for (German only)
const TOPIC_KEYWORDS = {
  'Parkplätze/Parking': ['parkplatz', 'parkplätze', 'parken', 'auto', 'fahrzeug', 'stellplatz', 'garage', 'tiefgarage', 'wo kann ich parken', 'parkgebühren', 'kostenpflichtig parken', 'parkschein', 'parkuhr'],
  'Frühstück/Breakfast': ['frühstück', 'morgenbuffet', 'buffet', 'morgen', 'kaffee', 'brötchen', 'gibt es frühstück', 'frühstückszeiten', 'kontinentales frühstück', 'müsli', 'marmelade', 'butter', 'eier', 'speck'],
  'Check-in/Öffnungszeiten': ['öffnungszeit', 'öffnungszeiten', 'geöffnet', 'öffnen', 'schließen', 'geschlossen', 'wann', 'uhrzeit', 'bis wann', 'ab wann', 'wie lange geöffnet', 'öffnungszeiten heute', 'wann macht auf', 'wann macht zu', 'check-in', 'check-out', 'checkin', 'checkout', 'anreise', 'abreise', 'einchecken', 'auschecken', 'eingecheckt', 'ankunft', 'schlüssel', 'zimmerschlüssel', 'keycard', 'rezeption', 'empfang', 'wann kann ich einchecken'],
  'Preise/Prices': ['preis', 'preise', 'kosten', 'wie viel', 'was kostet', 'teuer', 'günstig', 'euro', 'geld', 'wie teuer', 'preiswert', 'bezahlen', 'zahlung', 'gebühr', 'tarif'],
  'Reservierung/Booking': ['reservierung', 'buchen', 'buchung', 'verfügbar', 'frei', 'belegt', 'termin', 'platz', 'reservieren', 'vorbestellen', 'tisch reservieren', 'platz buchen', 'halbpension', 'kulanzgutschein', 'kulanzguthaben', 'gutschein', 'wie kann ich nach kostenloser stornierung filtern'],
  'WLAN/WiFi': ['wlan', 'wifi', 'wi-fi', 'internet', 'netzwerk', 'verbindung', 'online', 'zugang', 'internetverbindung', 'wlan passwort', 'wifi passwort', 'wie komme ich ins internet', 'netz', 'empfang'],
  'Restaurant/Essen': ['restaurant', 'essen', 'abendessen', 'mittagessen', 'küche', 'speisekarte', 'bestellen', 'trinken', 'bar', 'café', 'kaffee', 'gastronomie', 'verpflegung', 'mahlzeit', 'getränke', 'alkohol', 'bier', 'wein'],
  'Transport/Anfahrt': ['anfahrt', 'transport', 'bus', 'bahn', 'zug', 'taxi', 'weg', 'fahren', 'gehen', 'entfernung', 'wie komme ich', 'flughafen', 'bahnhof', 'öffentliche verkehrsmittel', 'u-bahn', 's-bahn', 'straßenbahn', 'bushaltestelle', 'fahrplan', 'verbindung'],
  'Stornierung/Cancellation': ['stornierung', 'stornieren', 'absagen', 'rückgängig', 'zurück', 'ändern', 'umbuchen', 'stornogebühr', 'kostenlos stornieren', 'buchung ändern', 'termin verschieben'],
  'Zimmer/Room': ['zimmer', 'bett', 'schlafzimmer', 'bad', 'dusche', 'balkon', 'aussicht', 'etage', 'doppelzimmer', 'einzelzimmer', 'familienzimmer', 'klimaanlage', 'heizung', 'fernseher', 'minibar', 'safe', 'handtücher'],
  'Wellness/Spa': ['wellness', 'spa', 'sauna', 'pool', 'schwimmbad', 'massage', 'entspannung', 'fitness', 'sport', 'schwimmen', 'baden', 'wellnessbereich', 'fitnessraum', 'dampfbad', 'whirlpool', 'jacuzzi', 'kosmetik'],
  'Events/Veranstaltungen': ['veranstaltung', 'feier', 'hochzeit', 'tagung', 'seminar', 'workshop', 'fest', 'festival', 'konferenz', 'geschäftlich', 'firmenfeier', 'geburtstag', 'jubiläum'],
  'Fahrrad/Bicycle': ['fahrrad', 'rad', 'fahrräder', 'abstellen', 'parken', 'garage', 'fahrradgarage', 'fahrradkeller', 'fahrradständer', 'radfahren', 'mountainbike', 'e-bike', 'pedelec', 'fahrradverleih', 'fahrradtour', 'radweg'],
  'Inspiration/Reiseberatung': ['urlaub', 'reise', 'hotel', 'ziel', 'wohin', 'zeig mir', 'schöner urlaub', 'reiseberatung', 'reiseziel', 'urlaubsziel', 'ausflug', 'sehenswürdigkeiten', 'gibt es wälder', 'natur', 'landschaft', 'berge', 'seen', 'wandern', 'spazieren', 'umgebung', 'nähe', 'in der nähe', 'was gibt es hier zu sehen', 'lohnenswert', 'schön', 'empfehlung', 'empfehlungen', 'vorschlag', 'tipp', 'tipps', 'was können sie empfehlen', 'beste', 'gut', 'aktivitäten', 'was kann man machen', 'was gibt es hier', 'lohnt sich', 'interessant', 'besichtigen'],
  'Kundenberatung/Customer Support': ['hilfe', 'kundenservice', 'beratung', 'beraten', 'rückruf', 'zurückrufen', 'anrufen', 'ruf mich an', 'nachricht', 'kontakt', 'sprechen', 'problem', 'beschwerde', 'frage', 'können sie mir helfen', 'ich brauche hilfe', 'unterstützung', 'mitarbeiter', 'personal', 'ich hätte gerne', 'könnten sie', 'wäre es möglich'],
  'Haustiere/Pets': ['haustiere', 'haustier', 'hund', 'hunde', 'katze', 'katzen', 'tier', 'tiere', 'mit hund', 'mit katze', 'erlaubt', 'mitbringen', 'tierfrei', 'hundefrei', 'katzenfrei']
};

// Exact message patterns for Inspiration/Reiseberatung category
const INSPIRATION_EXACT_MESSAGES = [
  'Beliebte Ziele für einen Wellnesstrip',
  'Welche Städte sind bekannt für ihr lebendiges Nachtleben?',
  'Reiseziele für einen Städtetrip',
  'Kinderfreundliche All-Inclusive-Resorts',
  'Rückzugsorte in den Bergen',
  'Reiseziele für Outdoor-Aktivitäten'
];

// Pattern-based messages for Inspiration/Reiseberatung (X = variable placeholder)
const INSPIRATION_PATTERN_MESSAGES = [
  /^Welche gut bewerteten Hotels in .+ kannst du mir empfehlen\?$/i,
  /^Welche Hotels in .+ haben einen Parkplatz\?$/i,
  /^Welche Veranstaltungen gibt es in .+ während meiner Reise\?$/i,
  /^Wie ist das Klima in .+ während meiner Reise\?$/i,
  /^Welche Hotels in .+ haben gut bewertetes Frühstück\?$/i
];

// Helper function to categorize a thread (shared logic for consistency)
function categorizeThread(thread: Thread): string | null {
  if (!thread.messages || thread.messages.length === 0) return null;

  // Extract workflows from thread
  const workflows = extractWorkflowsFromThread(thread);
  
  // Special handling for workflow-based categories
  if (workflows.has('workflow-travel-agent')) {
    return 'Inspiration/Reiseberatung';
  }
  
  if (workflows.has('workflow-contact-customer-service')) {
    return 'Kundenberatung/Customer Support';
  }

  // Get the first user message
  const firstUserMessage = thread.messages
    ?.filter(m => m.role === 'user')
    ?.sort((a, b) => {
      const timeA = new Date(a.sentAt).getTime();
      const timeB = new Date(b.sentAt).getTime();
      return timeA - timeB;
    })[0];

  if (!firstUserMessage) return null;

  const messageText = firstUserMessage?.content
    ?.map(content => content.text || content.content || '')
    .join(' ')
    .trim() || '';

  if (!messageText) return null;

  const messageTextLower = messageText.toLowerCase();

  // Check for exact message matches for Inspiration/Reiseberatung (even without workflow)
  for (const exactMessage of INSPIRATION_EXACT_MESSAGES) {
    if (messageText.toLowerCase() === exactMessage.toLowerCase()) {
      return 'Inspiration/Reiseberatung';
    }
  }

  // Check for pattern-based messages for Inspiration/Reiseberatung (even without workflow)
  for (const pattern of INSPIRATION_PATTERN_MESSAGES) {
    if (pattern.test(messageText)) {
      return 'Inspiration/Reiseberatung';
    }
  }

  // Check against all categories (excluding workflow-based ones) - first match wins
  for (const [categoryName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    // Skip workflow-based categories as they're handled above
    if (categoryName === 'Inspiration/Reiseberatung' || categoryName === 'Kundenberatung/Customer Support') {
      continue;
    }

    const hasKeyword = keywords.some(keyword => 
      messageTextLower.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      return categoryName;
    }
  }

  return 'Others/Sonstiges';
}

// Helper function to extract workflows from a thread
function extractWorkflowsFromThread(thread: Thread): Set<string> {
  const threadWorkflows = new Set<string>();
  
  thread.messages.forEach(message => {
    // Look for workflows in system/status messages
    if (message.role === 'system' || (message as any).role === 'status') {
      message.content.forEach(content => {
        if (content.text || content.content) {
          const text = content.text || content.content || '';
          
          // Look for "Workflows ausgewählt" pattern
          if (text.includes('Workflows ausgewählt')) {
            // Look for "* **Workflows:** `workflow-name1, workflow-name2`" pattern
            const workflowPattern = /\*\s*\*\*Workflows:\*\*\s*`([^`]+)`/gi;
            const matches = text.matchAll(workflowPattern);
            
            for (const match of matches) {
              const workflowsString = match[1];
              if (workflowsString) {
                // Split by comma and clean up workflow names
                const workflows = workflowsString.split(',').map(w => w.trim()).filter(w => w.length > 0);
                workflows.forEach(workflowName => {
                  if (workflowName.length > 1) {
                    threadWorkflows.add(workflowName);
                  }
                });
              }
            }
          }
          
          // Also look for standalone workflow mentions in system messages
          const standaloneWorkflowPattern = /workflow-[\w-]+/gi;
          const standaloneMatches = text.matchAll(standaloneWorkflowPattern);
          
          for (const match of standaloneMatches) {
            const workflowName = match[0];
            if (workflowName && workflowName.length > 1) {
              threadWorkflows.add(workflowName);
            }
          }
        }
      });
    }
  });
  
  return threadWorkflows;
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
