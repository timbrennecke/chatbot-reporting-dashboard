import { Check, Copy } from 'lucide-react';
import { Button } from '../ui/button';

interface CopyButtonProps {
  text: string;
  id: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  title?: string;
}

export function CopyButton({ text, id, copiedId, onCopy, title = 'Copy' }: CopyButtonProps) {
  const isCopied = copiedId === id;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onCopy(text, id)}
      className="h-6 w-6 p-0 hover:bg-slate-100"
      title={title}
    >
      {isCopied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 text-slate-500" />
      )}
    </Button>
  );
}
