import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Thread } from '../lib/types';
import { TrendingUp } from 'lucide-react';

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
  'Parkplätze/Parking': ['parkplatz', 'parkplätze', 'parken', 'parking', 'park'],
  'Frühstück/Breakfast': ['frühstück', 'breakfast', 'morgenbuffet', 'buffet'],
  'Empfehlungen/Recommendations': ['empfehlung', 'empfehlungen', 'recommend', 'suggestion', 'vorschlag', 'tipp', 'tipps'],
  'Öffnungszeiten/Opening Hours': ['öffnungszeit', 'öffnungszeiten', 'opening hours', 'geöffnet', 'öffnen', 'schließen'],
  'Preise/Prices': ['preis', 'preise', 'kosten', 'price', 'cost', 'wie viel', 'how much'],
  'Reservierung/Booking': ['reservierung', 'buchen', 'booking', 'reserve', 'buchung'],
  'WLAN/WiFi': ['wlan', 'wifi', 'internet', 'password', 'passwort'],
  'Check-in/Check-out': ['check-in', 'check-out', 'anreise', 'abreise', 'einchecken'],
  'Restaurant/Essen': ['restaurant', 'essen', 'food', 'dinner', 'lunch', 'abendessen', 'mittagessen'],
  'Transport/Anfahrt': ['anfahrt', 'transport', 'bus', 'bahn', 'zug', 'taxi', 'directions', 'weg'],
  'Stornierung/Cancellation': ['stornierung', 'stornieren', 'cancel', 'cancellation', 'absagen'],
  'Zimmer/Room': ['zimmer', 'room', 'suite', 'bett', 'bed'],
  'Wellness/Spa': ['wellness', 'spa', 'sauna', 'pool', 'schwimmbad', 'massage'],
  'Events/Veranstaltungen': ['event', 'veranstaltung', 'conference', 'meeting', 'feier', 'party'],
  'Haustiere/Pets': ['hund', 'katze', 'haustier', 'pet', 'dog', 'cat', 'tier'],
};

export function IntentAnalysis({ threads }: IntentAnalysisProps) {
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

    firstUserMessages.forEach(message => {
      const messageText = message.text.toLowerCase();

      Object.entries(TOPIC_KEYWORDS).forEach(([topicName, keywords]) => {
        const hasKeyword = keywords.some(keyword => 
          messageText.includes(keyword.toLowerCase())
        );

        if (hasKeyword) {
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
    });

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
          <p className="text-sm text-gray-500">No common topics found in {totalAnalyzed} messages.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Topic Analysis ({totalAnalyzed} messages, {topicsFound} topics)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {topicAnalysis.slice(0, 12).map((topic, index) => (
            <div key={topic.topic} className="text-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="text-lg font-bold text-gray-900">{topic.count}</div>
              <div className="text-xs text-gray-600 leading-tight">{topic.topic}</div>
              <div className="text-xs text-gray-500 mt-1">{topic.percentage}%</div>
            </div>
          ))}
        </div>
        
        {topicAnalysis.length > 12 && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            + {topicAnalysis.length - 12} more topics found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
