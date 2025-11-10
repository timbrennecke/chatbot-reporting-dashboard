import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ConversationsChartProps {
  data: Array<{
    date: Date;
    formattedDate: string;
    conversations: number;
  }>;
}

export function ConversationsChart({ data }: ConversationsChartProps) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#111827" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#111827" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              padding: '8px 12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="conversations"
            stroke="#111827"
            strokeWidth={1.5}
            fillOpacity={1}
            fill="url(#colorConversations)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
