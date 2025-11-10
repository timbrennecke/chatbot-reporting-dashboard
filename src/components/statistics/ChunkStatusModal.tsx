import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';

interface ChunkStatus {
  chunk: number;
  status: string;
  date: string;
}

interface ChunkStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunkStatuses: ChunkStatus[];
}

export function ChunkStatusModal({ isOpen, onClose, chunkStatuses }: ChunkStatusModalProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const successCount = chunkStatuses.filter((c) => c.status === '200').length;
  const failureCount = chunkStatuses.filter((c) => c.status !== '200').length;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '64rem',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
              Fetch Chunk Status
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.125rem' }}>
              HTTP status codes for each chunk ({chunkStatuses.length} chunks)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.375rem',
              color: '#6b7280',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flexGrow: 1,
            backgroundColor: '#f9fafb',
          }}
        >
          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Successful (200)</span>
              </div>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: '#10b981' }}>
                {successCount}
              </p>
            </div>
            <div
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Failed</span>
              </div>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: '#ef4444' }}>
                {failureCount}
              </p>
            </div>
          </div>

          {/* Chunk List */}
          {chunkStatuses.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {chunkStatuses.map((chunk, index) => {
                const isSuccess = chunk.status === '200';
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: 'white',
                      border: `1px solid ${isSuccess ? '#d1fae5' : '#fee2e2'}`,
                      backgroundColor: isSuccess ? '#f0fdf4' : '#fef2f2',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isSuccess ? '#10b981' : '#ef4444',
                        }}
                      />
                      <h3
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: isSuccess ? '#059669' : '#dc2626',
                        }}
                      >
                        Chunk {chunk.chunk}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Status Code</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isSuccess ? '#059669' : '#dc2626',
                            fontSize: '0.875rem',
                          }}
                        >
                          {chunk.status}
                        </span>
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.5rem 0' }} />
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Time Range</span>
                        <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500 }}>
                          {chunk.date}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>No chunk data available</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


