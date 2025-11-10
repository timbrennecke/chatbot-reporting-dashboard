import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface NavigationButtonsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function NavigationButtons({
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious}
        className={`flex items-center gap-1 px-3 py-2 h-auto ${
          !hasPrevious ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'
        }`}
        title="Previous Chat"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-sm font-medium">Previous Chat</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onNext}
        disabled={!hasNext}
        className={`flex items-center gap-1 px-3 py-2 h-auto ${
          !hasNext ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'
        }`}
        title="Next Chat"
      >
        <span className="text-sm font-medium">Next Chat</span>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
