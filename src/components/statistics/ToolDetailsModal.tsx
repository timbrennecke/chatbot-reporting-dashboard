import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ToolUsage {
  name: string;
  count: number;
  avgResponseTime: number;
  responseTimes: number[];
}

interface ToolDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolUsage[];
}

export function ToolDetailsModal({ isOpen, onClose, tools }: ToolDetailsModalProps) {
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
              Tool Details
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>
              {tools.length} tools found
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
          {tools.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tools.map((tool, index) => (
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
                    {tool.name}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Usage</p>
                      <p style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                        {tool.count}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Avg Response</p>
                      <p style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                        {tool.avgResponseTime}s
                      </p>
                    </div>
                    {tool.responseTimes.length > 0 && (
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Min / Max</p>
                        <p style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                          {Math.min(...tool.responseTimes).toFixed(2)}s / {Math.max(...tool.responseTimes).toFixed(2)}s
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No tools found
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
