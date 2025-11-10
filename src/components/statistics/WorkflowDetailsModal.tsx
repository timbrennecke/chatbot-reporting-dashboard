import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface WorkflowUsage {
  workflow: string;
  count: number;
  percentage: number;
}

interface WorkflowDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflows: WorkflowUsage[];
}

export function WorkflowDetailsModal({ isOpen, onClose, workflows }: WorkflowDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Workflow Details
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>
              {workflows.length} workflows found
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '24px',
          }}
        >
          {workflows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workflows.map((workflow, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                  }}
                >
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px' }}>
                    {workflow.workflow}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Occurrences</p>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                      {workflow.count}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Usage</p>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                      {workflow.percentage}%
                    </p>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(workflow.percentage, 100)}%`,
                        backgroundColor: '#111827',
                        borderRadius: '4px',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No workflows found
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
