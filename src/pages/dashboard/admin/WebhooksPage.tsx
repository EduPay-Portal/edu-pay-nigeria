import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WebhookEvent {
  id: string;
  event_type: string;
  paystack_reference: string;
  payload: any;
  signature_valid: boolean;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}

export default function WebhooksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'processed' | 'pending' | 'error'>('all');
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch webhook events
  const { data: events, isLoading } = useQuery({
    queryKey: ['webhook-events', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('paystack_webhook_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus === 'processed') {
        query = query.eq('processed', true).is('error_message', null);
      } else if (filterStatus === 'pending') {
        query = query.eq('processed', false).is('error_message', null);
      } else if (filterStatus === 'error') {
        query = query.not('error_message', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookEvent[];
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Reprocess webhook mutation
  const reprocessMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('paystack-webhook-reprocess', {
        body: { event_id: eventId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
      toast.success('Webhook reprocessed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reprocess webhook: ${error.message}`);
    },
  });

  const filteredEvents = events?.filter((event) =>
    event.paystack_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.event_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const stats = {
    total: events?.length || 0,
    processed: events?.filter(e => e.processed && !e.error_message).length || 0,
    pending: events?.filter(e => !e.processed && !e.error_message).length || 0,
    errors: events?.filter(e => e.error_message).length || 0,
  };

  const getStatusBadge = (event: WebhookEvent) => {
    if (event.error_message) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    }
    if (event.processed) {
      return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" />Processed</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
  };

  const handleViewDetails = (event: WebhookEvent) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Webhook Events</h1>
        <p className="text-muted-foreground">Monitor and manage Paystack webhook notifications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Events Log</CardTitle>
          <CardDescription>Real-time log of all Paystack webhook notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search by reference or event type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['webhook-events'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No events match your search' : 'No webhook events received yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signature</TableHead>
                  <TableHead>Received At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">{event.paystack_reference}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.event_type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(event)}</TableCell>
                    <TableCell>
                      {event.signature_valid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(event.created_at), 'MMM dd, yyyy HH:mm:ss')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(event)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {event.error_message && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reprocessMutation.mutate(event.id)}
                            disabled={reprocessMutation.isPending}
                          >
                            {reprocessMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Event Details</DialogTitle>
            <DialogDescription>
              Reference: {selectedEvent?.paystack_reference}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <Tabs defaultValue="payload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payload">Payload</TabsTrigger>
                <TabsTrigger value="info">Information</TabsTrigger>
              </TabsList>
              <TabsContent value="payload" className="space-y-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </TabsContent>
              <TabsContent value="info" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Event Type</div>
                    <div className="text-sm mt-1">{selectedEvent.event_type}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <div className="mt-1">{getStatusBadge(selectedEvent)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Signature Valid</div>
                    <div className="text-sm mt-1">
                      {selectedEvent.signature_valid ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Valid
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="h-4 w-4" />
                          Invalid
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedEvent.error_message && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        Error Message
                      </div>
                      <div className="text-sm mt-1 text-red-600">{selectedEvent.error_message}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Received At</div>
                    <div className="text-sm mt-1">
                      {format(new Date(selectedEvent.created_at), 'MMMM dd, yyyy HH:mm:ss')}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
