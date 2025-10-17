import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Thread } from '../lib/types';
import { TrendingUp, Info } from 'lucide-react';

interface IntentAnalysisProps {
  threads: Thread[];
}

interface TopicFrequency {
  topic: string;
  count: number;
  percentage: number;
  examples: string[];
}

// Define key topics/keywords to look for (German and English)
const TOPIC_KEYWORDS = {
  'Parkplätze/Parking': ['parkplatz', 'parkplätze', 'parken', 'parking', 'park', 'auto', 'car', 'fahrzeug', 'vehicle', 'stellplatz', 'garage', 'tiefgarage', 'wo kann ich parken', 'parkgebühren', 'kostenpflichtig parken', 'parkschein', 'parkuhr'],
  'Frühstück/Breakfast': ['frühstück', 'breakfast', 'morgenbuffet', 'buffet', 'morgen', 'morning', 'früh', 'early', 'kaffee', 'coffee', 'brötchen', 'bread', 'gibt es frühstück', 'frühstückszeiten', 'kontinentales frühstück', 'müsli', 'marmelade', 'butter', 'eier', 'speck'],
  'Öffnungszeiten/Opening Hours': ['öffnungszeit', 'öffnungszeiten', 'opening hours', 'geöffnet', 'öffnen', 'schließen', 'geschlossen', 'closed', 'wann', 'when', 'uhrzeit', 'time', 'bis wann', 'until when', 'ab wann', 'from when', 'wie lange geöffnet', 'öffnungszeiten heute', 'wann macht auf', 'wann macht zu'],
  'Preise/Prices': ['preis', 'preise', 'kosten', 'price', 'prices', 'cost', 'costs', 'wie viel', 'how much', 'was kostet', 'what costs', 'teuer', 'expensive', 'günstig', 'cheap', 'euro', 'dollar', 'geld', 'money', 'wie teuer', 'preiswert', 'bezahlen', 'zahlung', 'gebühr', 'tarif'],
  'Reservierung/Booking': ['reservierung', 'buchen', 'booking', 'reserve', 'buchung', 'reservation', 'verfügbar', 'available', 'frei', 'free', 'belegt', 'occupied', 'termin', 'appointment', 'platz', 'space', 'reservieren', 'vorbestellen', 'tisch reservieren', 'platz buchen'],
  'WLAN/WiFi': ['wlan', 'wifi', 'wi-fi', 'internet', 'password', 'passwort', 'netzwerk', 'network', 'verbindung', 'connection', 'online', 'zugang', 'access', 'internetverbindung', 'wlan passwort', 'wie komme ich ins internet', 'netz', 'empfang'],
  'Check-in/Check-out': ['check-in', 'check-out', 'checkin', 'checkout', 'anreise', 'abreise', 'einchecken', 'auschecken', 'ankunft', 'arrival', 'departure', 'schlüssel', 'key', 'karte', 'card', 'zimmerschlüssel', 'keycard', 'rezeption', 'empfang', 'wann kann ich einchecken'],
  'Restaurant/Essen': ['restaurant', 'essen', 'food', 'dinner', 'lunch', 'abendessen', 'mittagessen', 'küche', 'kitchen', 'speisekarte', 'menu', 'bestellen', 'order', 'trinken', 'drink', 'bar', 'café', 'kaffee', 'coffee', 'gastronomie', 'verpflegung', 'mahlzeit', 'snack', 'getränke', 'alkohol', 'bier', 'wein'],
  'Transport/Anfahrt': ['anfahrt', 'transport', 'bus', 'bahn', 'zug', 'taxi', 'directions', 'weg', 'route', 'fahren', 'drive', 'gehen', 'walk', 'entfernung', 'distance', 'wie komme ich', 'how do i get', 'flughafen', 'airport', 'bahnhof', 'station', 'öffentliche verkehrsmittel', 'u-bahn', 's-bahn', 'straßenbahn', 'bushaltestelle', 'fahrplan', 'verbindung'],
  'Stornierung/Cancellation': ['stornierung', 'stornieren', 'cancel', 'cancellation', 'absagen', 'rückgängig', 'undo', 'zurück', 'back', 'ändern', 'change', 'modify', 'umbuchen', 'rebook', 'stornogebühr', 'kostenlos stornieren', 'buchung ändern', 'termin verschieben'],
  'Zimmer/Room': ['zimmer', 'room', 'suite', 'bett', 'bed', 'schlafzimmer', 'bedroom', 'bad', 'bathroom', 'dusche', 'shower', 'balkon', 'balcony', 'aussicht', 'view', 'etage', 'floor', 'doppelzimmer', 'einzelzimmer', 'familienzimmer', 'klimaanlage', 'heizung', 'fernseher', 'minibar', 'safe', 'handtücher'],
  'Wellness/Spa': ['wellness', 'spa', 'sauna', 'pool', 'schwimmbad', 'massage', 'entspannung', 'relaxation', 'fitness', 'gym', 'sport', 'schwimmen', 'swimming', 'baden', 'bathing', 'wellnessbereich', 'fitnessraum', 'dampfbad', 'whirlpool', 'jacuzzi', 'beauty', 'kosmetik'],
  'Events/Veranstaltungen': ['event', 'veranstaltung', 'conference', 'meeting', 'feier', 'party', 'hochzeit', 'wedding', 'tagung', 'seminar', 'workshop', 'celebration', 'fest', 'festival', 'konferenz', 'business', 'geschäftlich', 'firmenfeier', 'geburtstag', 'jubiläum'],
  'Haustiere/Pets': ['hund', 'katze', 'haustier', 'pet', 'dog', 'cat', 'tier', 'animal', 'welpe', 'puppy', 'kätzchen', 'kitten', 'erlaubt', 'allowed', 'mitbringen', 'bring', 'haustiere erlaubt', 'hundefreundlich', 'katzenfreundlich', 'tierfreundlich', 'haustiergebühr'],
  'Fahrrad/Bicycle': ['fahrrad', 'bicycle', 'bike', 'rad', 'fahrräder', 'abstellen', 'parken', 'garage', 'fahrradgarage', 'fahrradkeller', 'fahrradständer', 'radfahren', 'cycling', 'mountainbike', 'e-bike', 'pedelec', 'fahrradverleih', 'fahrradtour', 'radweg'],
  'Inspiration/Reiseberatung': ['urlaub', 'vacation', 'reise', 'travel', 'hotel', 'destination', 'ziel', 'wohin', 'where to go', 'where can i', 'show me', 'zeig mir', 'great vacation', 'schöner urlaub', 'reiseberatung', 'travel advice', 'travel consultant', 'reiseziel', 'urlaubsziel', 'holiday destination', 'trip', 'ausflug', 'sightseeing', 'sehenswürdigkeiten', 'gibt es wälder', 'natur', 'landschaft', 'berge', 'seen', 'wandern', 'spazieren', 'umgebung', 'nähe', 'in der nähe', 'was gibt es hier zu sehen', 'lohnenswert', 'schön', 'empfehlung', 'empfehlungen', 'recommend', 'recommendation', 'suggestion', 'vorschlag', 'tipp', 'tipps', 'was können sie empfehlen', 'what do you recommend', 'beste', 'best', 'gut', 'good', 'aktivitäten', 'activities', 'was kann man machen', 'was gibt es hier', 'lohnt sich', 'interessant', 'besichtigen'],
  'Kundenberatung/Customer Support': ['hilfe', 'help', 'support', 'kundenservice', 'customer service', 'beratung', 'beraten', 'rückruf', 'callback', 'call back', 'zurückrufen', 'anrufen', 'call me', 'ruf mich an', 'nachricht', 'message', 'kontakt', 'contact', 'sprechen', 'talk', 'problem', 'issue', 'beschwerde', 'complaint', 'frage', 'question', 'können sie mir helfen', 'can you help me', 'ich brauche hilfe', 'i need help', 'assistance', 'unterstützung', 'service', 'mitarbeiter', 'staff', 'personal', 'ich hätte gerne', 'könnten sie', 'wäre es möglich'],
};

export function IntentAnalysis({ threads }: IntentAnalysisProps) {
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

    // Extract first user messages
    const firstUserMessages = threads.map(thread => {
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

      return {
        threadId: thread.id,
        text: messageText,
        conversationId: thread.conversationId
      };
    }).filter(msg => msg.text.length > 0);

    // Count topic frequencies
    const topicCounts: { [key: string]: { count: number; examples: string[] } } = {};
    const uncategorizedMessages: string[] = [];

    firstUserMessages.forEach(message => {
      const messageText = message.text.toLowerCase();
      let messageMatched = false;

      Object.entries(TOPIC_KEYWORDS).forEach(([topicName, keywords]) => {
        const hasKeyword = keywords.some(keyword => 
          messageText.includes(keyword.toLowerCase())
        );

        if (hasKeyword) {
          messageMatched = true;
          if (!topicCounts[topicName]) {
            topicCounts[topicName] = { count: 0, examples: [] };
          }
          topicCounts[topicName].count++;
          
          // Store up to 2 examples per topic
          if (topicCounts[topicName].examples.length < 2) {
            const truncatedText = message.text.length > 60 
              ? message.text.substring(0, 60) + '...' 
              : message.text;
            topicCounts[topicName].examples.push(truncatedText);
          }
        }
      });

      // If message didn't match any category, add to uncategorized
      if (!messageMatched) {
        const truncatedText = message.text.length > 60 
          ? message.text.substring(0, 60) + '...' 
          : message.text;
        uncategorizedMessages.push(truncatedText);
      }
    });

    // Add "Others/Sonstiges" category if there are uncategorized messages
    if (uncategorizedMessages.length > 0) {
      topicCounts['Others/Sonstiges'] = {
        count: uncategorizedMessages.length,
        examples: uncategorizedMessages.slice(0, 2) // Take first 2 examples
      };
    }

    // Calculate percentages and create results
    const totalMessages = firstUserMessages.length;
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
            <div key={topic.topic} className="text-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group relative">
              <div className="text-lg font-bold text-gray-900">{topic.count}</div>
              <div className="text-xs text-gray-600 leading-tight">{topic.topic}</div>
              <div className="text-xs text-gray-500 mt-1">{topic.percentage}%</div>
              
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
