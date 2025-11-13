import { useEffect, useState } from 'react';

/**
 * Hook to track scroll position and provide scroll-to-top functionality
 * Automatically detects the scrolling container (overlay or window)
 */
export function useScrollToTop(threshold = 300) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Find the conversation overlay container (if it exists)
    const overlayContainer = document.getElementById('conversation-overlay');
    const scrollContainer = overlayContainer || window;
    
    const handleScroll = () => {
      // Get scroll position from overlay or window
      const scrollPosition = overlayContainer 
        ? overlayContainer.scrollTop 
        : window.scrollY || document.documentElement.scrollTop;
      
      const shouldShow = scrollPosition > threshold;
      setShowButton(shouldShow);
    };

    // Listen to scroll events on the appropriate container
    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Check initial scroll position
    handleScroll();
    
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    // Find the conversation overlay container
    const overlayContainer = document.getElementById('conversation-overlay');
    
    if (overlayContainer) {
      // Scroll the overlay container
      overlayContainer.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      // Fallback to window scroll
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return { showButton, scrollToTop };
}

