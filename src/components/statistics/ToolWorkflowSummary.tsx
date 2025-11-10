import { Button } from '../ui/button';

interface ToolWorkflowSummaryProps {
  toolCount: number;
  workflowCount: number;
  onShowToolDetails: () => void;
  onShowWorkflowDetails: () => void;
}

export function ToolWorkflowSummary({
  toolCount,
  workflowCount,
  onShowToolDetails,
  onShowWorkflowDetails,
}: ToolWorkflowSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Unique Tools Card */}
      <div className="rounded-lg border p-6 flex flex-col justify-between" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Unique Tools</p>
          <p className="text-2xl font-light text-gray-900 mb-6">{toolCount}</p>
        </div>
        <Button
          onClick={onShowToolDetails}
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs font-medium text-gray-700 border-gray-200"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.color = '#111827';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          View Tools
        </Button>
      </div>

      {/* Workflow Patterns Card */}
      <div className="rounded-lg border p-6 flex flex-col justify-between" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Workflow Patterns</p>
          <p className="text-2xl font-light text-gray-900 mb-6">{workflowCount}</p>
        </div>
        <Button
          onClick={onShowWorkflowDetails}
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs font-medium text-gray-700 border-gray-200"
          style={{ transition: 'all 0.2s ease-in-out' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.color = '#111827';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          View Workflows
        </Button>
      </div>
    </div>
  );
}
