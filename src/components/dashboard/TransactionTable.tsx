import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Transaction } from '@/types/wallet';
import { format } from 'date-fns';

interface TransactionTableProps {
  transactions: Transaction[];
}

export const TransactionTable = ({ transactions }: TransactionTableProps) => {
  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'reversed':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getCategoryLabel = (category: Transaction['category']) => {
    return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No transactions yet
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
              <TableCell className="capitalize">{transaction.type}</TableCell>
              <TableCell>{getCategoryLabel(transaction.category)}</TableCell>
              <TableCell>{transaction.description || '-'}</TableCell>
              <TableCell className={transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                {transaction.type === 'credit' ? '+' : '-'}₦{transaction.amount.toLocaleString('en-NG')}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusColor(transaction.status)}>
                  {transaction.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};
