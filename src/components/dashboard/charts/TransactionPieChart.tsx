import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChartIcon } from 'lucide-react';

interface TransactionPieChartProps {
  creditAmount: number;
  debitAmount: number;
}

export const TransactionPieChart = ({ creditAmount, debitAmount }: TransactionPieChartProps) => {
  const data = [
    { name: 'Top-ups', value: creditAmount, color: 'hsl(var(--success))' },
    { name: 'Spending', value: debitAmount, color: 'hsl(var(--destructive))' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {(creditAmount === 0 && debitAmount === 0) ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <PieChartIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No Transaction Data</p>
            <p className="text-sm">Distribution will show once transactions occur</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
