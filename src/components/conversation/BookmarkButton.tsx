import { Bookmark, BookmarkX, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { NotesPanel } from './NotesPanel';

interface BookmarkButtonProps {
  isSaved: boolean;
  onToggleSave: () => void;
  showNotesPanel: boolean;
  setShowNotesPanel: (show: boolean) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSaveNotes: () => void;
}

export function BookmarkButton({
  isSaved,
  onToggleSave,
  showNotesPanel,
  setShowNotesPanel,
  notes,
  onNotesChange,
  onSaveNotes,
}: BookmarkButtonProps) {
  return (
    <div className="relative flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSave}
        className={`flex items-center gap-2 px-3 py-2 h-auto transition-all duration-200 rounded-md border ${
          isSaved
            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 bg-blue-50/50'
            : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100 border-slate-200'
        }`}
        title={isSaved ? 'Remove from saved chats' : 'Save chat with notes'}
      >
        {isSaved ? (
          <>
            <BookmarkX className="h-4 w-4" />
            <span className="text-sm font-medium">Saved</span>
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            <span className="text-sm font-medium">Save</span>
          </>
        )}
      </Button>

      {/* Small Notes Button - only show when saved */}
      {isSaved && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotesPanel(true)}
          className="flex items-center gap-1 px-2 py-1 h-auto text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-md"
          title="View/edit notes"
        >
          <FileText className="h-3 w-3" />
          <span>Notes</span>
        </Button>
      )}

      {/* Small Notes Popup */}
      {showNotesPanel && (
        <NotesPanel
          notes={notes}
          onNotesChange={onNotesChange}
          onClose={() => setShowNotesPanel(false)}
          onSave={onSaveNotes}
        />
      )}
    </div>
  );
}
