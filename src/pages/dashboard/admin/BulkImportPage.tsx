import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileUp, Play, AlertCircle, CheckCircle, Clock, Users, Loader2, RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { toast } from 'sonner';
import { CSVUploadCard } from '@/components/admin/CSVUploadCard';

interface StagingRecord {
  "SN": string;
  "NAMES": string;
  "SURNAME": string;
  "CLASS": string;
  "REG NO": string;
  "MEMBER/NMEMBER": string;
  "DAY/BOARDER": string;
  "SCHOOL FEES": string;
  "DEBTS": string;
  parent_email: string;
  parent_id?: string;
  student_id?: string;
  processed: boolean;
  error_message?: string;
  created_at: string;
}

export default function BulkImportPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'error'>('all');

  // Fetch staging records
  const { data: stagingRecords, isLoading, refetch } = useQuery({
    queryKey: ['bulk-import-staging'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students_import_staging')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as StagingRecord[];
    },
  });

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['bulk-import-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_import_staging_stats');
      if (error) throw error;
      return data[0];
    },
  });

  // Process all pending mutation
  const processAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bulk-create-students', {
        body: { mode: 'all' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.success_count} students successfully!`);
      if (data.error_count > 0) {
        toast.warning(`${data.error_count} students failed to process.`);
      }
      queryClient.invalidateQueries({ queryKey: ['bulk-import-staging'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-import-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to process: ${error.message}`);
    },
  });

  // Retry failed records mutation
  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      // First reset error records to pending
      const { error: resetError } = await supabase
        .from('students_import_staging')
        .update({ processed: false, error_message: null })
        .not('error_message', 'is', null);
      
      if (resetError) throw resetError;
      
      // Then process them
      const { data, error } = await supabase.functions.invoke('bulk-create-students', {
        body: { mode: 'all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Retried ${data.success_count} records successfully!`);
      if (data.error_count > 0) {
        toast.warning(`${data.error_count} still failed.`);
      }
      queryClient.invalidateQueries({ queryKey: ['bulk-import-staging'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-import-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Retry failed: ${error.message}`);
    },
  });

  const totalRecords = stats?.total_records || 0;
  const processedRecords = stats?.processed_records || 0;
  const pendingRecords = stats?.pending_records || 0;
  const errorRecords = stats?.error_records || 0;

  // Filter records based on selection
  const filteredRecords = stagingRecords?.filter(record => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !record.processed && !record.error_message;
    if (statusFilter === 'processed') return record.processed && record.student_id;
    if (statusFilter === 'error') return record.error_message;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bulk Import Management</h1>
        <p className="text-muted-foreground">Monitor and process student import batches</p>
      </div>

      {/* CSV Upload */}
      <CSVUploadCard onUploadComplete={() => {
        refetch();
        refetchStats();
      }} />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Records"
          value={totalRecords.toString()}
          icon={FileUp}
        />
        <StatCard
          title="Processed"
          value={processedRecords.toString()}
          icon={CheckCircle}
        />
        <StatCard
          title="Pending"
          value={pendingRecords.toString()}
          icon={Clock}
        />
        <StatCard
          title="Errors"
          value={errorRecords.toString()}
          icon={AlertCircle}
        />
      </div>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Process Import Batch</CardTitle>
              <CardDescription>
                Create user accounts and profiles from staging data
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => processAllMutation.mutate()}
                disabled={processAllMutation.isPending || pendingRecords === 0}
                size="sm"
              >
                {processAllMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Process All Pending ({pendingRecords})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryFailedMutation.mutate()}
                disabled={retryFailedMutation.isPending || errorRecords === 0}
              >
                {retryFailedMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Failed ({errorRecords})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Staging Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staging Records</CardTitle>
          <CardDescription>Preview of imported student data</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({totalRecords})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingRecords})</TabsTrigger>
              <TabsTrigger value="processed">Processed ({processedRecords})</TabsTrigger>
              <TabsTrigger value="error">Errors ({errorRecords})</TabsTrigger>
            </TabsList>
            
            <TabsContent value={statusFilter}>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading staging data...</div>
              ) : filteredRecords && filteredRecords.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Reg No</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Debt</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record, index) => {
                    const debt = parseFloat(record["DEBTS"] || "0") || 0;
                    const isMember = record["MEMBER/NMEMBER"] === "MEMBER";
                    const isBoarder = record["DAY/BOARDER"] === "BOARDER";
                    const parentName = `${record["SURNAME"]} Family`;
                    
                    return (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{record["SN"]}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {record["SURNAME"]}, {record["NAMES"]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record["CLASS"]}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{record["REG NO"]}</TableCell>
                      <TableCell>
                        <div className="text-sm">{parentName}</div>
                        <div className="text-xs text-muted-foreground">{record.parent_email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {debt > 0 ? (
                          <span className="text-destructive font-semibold">
                            ₦{debt.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {isMember && (
                            <Badge variant="secondary" className="text-xs">Member</Badge>
                          )}
                          {isBoarder && (
                            <Badge variant="default" className="text-xs">Boarder</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.error_message ? (
                          <div className="space-y-2">
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </Badge>
                            <p className="text-xs text-destructive max-w-[200px] truncate" title={record.error_message}>
                              {record.error_message}
                            </p>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs">
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Error Details - {record.SURNAME}, {record.NAMES}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-semibold">SN:</p>
                                    <p className="text-sm text-muted-foreground">{record.SN}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Registration Number:</p>
                                    <p className="text-sm text-muted-foreground">{record["REG NO"]}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Class:</p>
                                    <p className="text-sm text-muted-foreground">{record.CLASS}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Parent Email:</p>
                                    <p className="text-sm text-muted-foreground">{record.parent_email}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-destructive">Error Message:</p>
                                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md break-words">
                                      {record.error_message}
                                    </p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : record.processed && record.student_id ? (
                          <Badge variant="default" className="bg-green-500 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {statusFilter === 'all' ? '' : statusFilter} records found.</p>
                    {statusFilter === 'all' && <p className="text-sm">Import a CSV file to get started.</p>}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }
