import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

interface TopStudentsChartProps {
  data: Array<{ name: string; balance: number }>;
}

export const TopStudentsChart = ({ data }: TopStudentsChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Students by Balance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every(d => d.balance === 0) ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No Wallet Balances</p>
            <p className="text-sm">Top students will appear when wallets are funded</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
              />
              <Bar 
                dataKey="balance" 
                fill="hsl(var(--primary))" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
