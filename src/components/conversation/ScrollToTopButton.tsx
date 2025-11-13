import { ArrowUp } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ScrollToTopButtonProps {
  show: boolean;
  onClick: () => void;
}

/**
 * Floating button that appears when user scrolls down
 * Uses React Portal to render at document root to avoid clipping
 */
export function ScrollToTopButton({ show, onClick }: ScrollToTopButtonProps) {
  if (!show) return null;
  
  const buttonElement = (
    <button
      onClick={onClick}
      style={{ 
        position: 'fixed',
        bottom: '32px',
        right: '120px',
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        color: '#1f2937',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
      }}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ArrowUp style={{ width: '24px', height: '24px', strokeWidth: 2.5 }} />
    </button>
  );

  // Render at document root using Portal to bypass any parent overflow/clipping
  return createPortal(buttonElement, document.body);
}

