interface AdvancedMetricsProps {
  stats: {
    totalUserMessages: number;
    totalAssistantMessages: number;
    avgMessagesPerConversation: number;
    conversationsWithErrors: number;
    errorPercentage: number;
    avgTimeToFirstResponseSeconds: number;
    kontaktquote: number;
    conversationsWithContactTools: number;
    travelAgentQuote: number;
    conversationsWithTravelAgentTools: number;
  };
}

export function AdvancedMetrics({ stats }: AdvancedMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* User Messages Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">User Messages</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.totalUserMessages.toLocaleString()}
        </p>
      </div>

      {/* AI Responses Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">AI Responses</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.totalAssistantMessages.toLocaleString()}
        </p>
      </div>

      {/* Avg Messages per Chat Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Avg Messages per Chat</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.avgMessagesPerConversation}
        </p>
      </div>

      {/* Avg First Response Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Avg First Response</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.avgTimeToFirstResponseSeconds}
          <span className="text-xs text-gray-500 ml-2">s</span>
        </p>
      </div>

      {/* Contact Rate Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Contact Rate</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.kontaktquote}
          <span className="text-xs text-gray-500 ml-2">%</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">{stats.conversationsWithContactTools.toLocaleString()} chats</p>
      </div>

      {/* Travel Agent Rate Card */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Travel Agent Rate</p>
        <p className="text-2xl font-light text-gray-900">
          {stats.travelAgentQuote}
          <span className="text-xs text-gray-500 ml-2">%</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">{stats.conversationsWithTravelAgentTools.toLocaleString()} chats</p>
      </div>
    </div>
  );
}
