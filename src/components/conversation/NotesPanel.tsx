import { FileText, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface NotesPanelProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function NotesPanel({ notes, onNotesChange, onClose, onSave }: NotesPanelProps) {
  return (
    <div className="absolute top-full left-0 mt-2 w-72 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between gap-2 mb-2 bg-white">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-700" />
            <span className="text-sm font-semibold text-gray-800">
              {notes.trim() ? 'Edit Notes' : 'Add Notes'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <Textarea
          placeholder="Add notes about this conversation..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="text-sm resize-none bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 w-full"
          rows={4}
        />
      </div>

      {/* Button Footer */}
      <div className="flex justify-end gap-2 px-3 py-2 bg-gray-100 border-t-2 border-gray-300">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="text-xs bg-white border-gray-400 hover:bg-gray-50 px-2 py-1"
        >
          Cancel
        </Button>
        <Button variant="default" size="sm" onClick={onSave} className="text-xs px-2 py-1">
          Save
        </Button>
      </div>
    </div>
  );
}
