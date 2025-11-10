import { categorizeConversation } from '../../lib/categorization';
import { CATEGORY_COLORS } from '../../lib/constants';
import type { Message } from '../../lib/types';

interface CategoryBadgeProps {
  messages: Message[];
}

export function CategoryBadge({ messages }: CategoryBadgeProps) {
  const category = categorizeConversation(messages);

  if (!category) return null;

  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Others/Sonstiges'];

  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-xl whitespace-nowrap border"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
      title={`Categorized as: ${category}`}
    >
      {category}
    </span>
  );
}
