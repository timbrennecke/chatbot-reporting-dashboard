import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

interface FloatingNavigationButtonsProps {
  show: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

/**
 * Floating navigation buttons that appear when user scrolls down
 * Uses React Portal to render at document root to avoid clipping
 * Positioned at the center-bottom of the screen with Previous/Next buttons side-by-side
 */
export function FloatingNavigationButtons({
  show,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: FloatingNavigationButtonsProps) {
  if (!show) return null;

  const buttonBaseStyle = {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };

  const disabledStyle = {
    ...buttonBaseStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  const containerElement = (
    <div
      style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        zIndex: 999999,
      }}
    >
      {/* Navigation Buttons Row */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        {/* Previous Button */}
        <button
          onClick={hasPrevious ? onPrevious : undefined}
          disabled={!hasPrevious}
          style={hasPrevious ? buttonBaseStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasPrevious) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasPrevious) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
            }
          }}
          aria-label="Previous chat"
          title="Previous chat"
        >
          <ChevronLeft
            style={{
              width: '24px',
              height: '24px',
              strokeWidth: 2.5,
              color: hasPrevious ? '#1f2937' : '#9ca3af',
            }}
          />
        </button>

        {/* Next Button */}
        <button
          onClick={hasNext ? onNext : undefined}
          disabled={!hasNext}
          style={hasNext ? buttonBaseStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasNext) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasNext) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
            }
          }}
          aria-label="Next chat"
          title="Next chat"
        >
          <ChevronRight
            style={{
              width: '24px',
              height: '24px',
              strokeWidth: 2.5,
              color: hasNext ? '#1f2937' : '#9ca3af',
            }}
          />
        </button>
      </div>
    </div>
  );

  // Render at document root using Portal to bypass any parent overflow/clipping
  return createPortal(containerElement, document.body);
}

