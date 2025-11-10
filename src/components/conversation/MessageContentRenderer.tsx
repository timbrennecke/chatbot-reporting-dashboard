import { ExternalLink, MessageSquare, Zap } from 'lucide-react';
import type { MessageContent } from '../../lib/types';
import { Badge } from '../ui/badge';

interface MessageContentRendererProps {
  content: MessageContent;
  index: number;
}

export function MessageContentRenderer({ content, index }: MessageContentRendererProps) {
  const key = `${content.kind}-${index}`;

  switch (content.kind) {
    case 'ui':
      return (
        <div
          key={key}
          className="p-4 bg-purple-50/70 rounded-xl border border-purple-100 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-purple-600" />
            <Badge variant="secondary">UI Component</Badge>
          </div>
          <div className="text-sm space-y-1">
            {content.ui?.namespace && (
              <div>
                <strong>Namespace:</strong> {content.ui.namespace}
              </div>
            )}
            {content.ui?.identifier && (
              <div>
                <strong>Identifier:</strong> {content.ui.identifier}
              </div>
            )}
            {content.ui?.props && (
              <div className="mt-2">
                <strong>Props:</strong>
                <pre className="text-xs bg-purple-100 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(content.ui.props, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      );

    case 'linkout':
      return (
        <div key={key} className="p-4 bg-blue-50/70 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="h-4 w-4 text-blue-600" />
            <Badge variant="secondary">External Link</Badge>
          </div>
          <div className="text-sm">
            <strong>URL:</strong>
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline ml-2"
            >
              {content.url}
            </a>
          </div>
        </div>
      );

    default:
      return (
        <div key={key} className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-gray-600" />
            <Badge variant="outline">{content.kind}</Badge>
          </div>
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
        </div>
      );
  }
}
