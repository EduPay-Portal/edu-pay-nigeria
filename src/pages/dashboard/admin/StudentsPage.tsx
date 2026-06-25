import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VirtualAccountStatus } from '@/components/admin/VirtualAccountStatus';
import { StudentDetailDialog } from '@/components/admin/StudentDetailDialog';
import { EditStudentDialog } from '@/components/admin/EditStudentDialog';
import { AddStudentDialog } from '@/components/admin/AddStudentDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, UserPlus, Download, Users, UserCheck, Wallet, TrendingUp,
  ShieldAlert, Eye, Pencil, AlertCircle, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { StudentFilters } from '@/components/admin/StudentFilters';
import { useBulkCreateVirtualAccounts } from '@/hooks/useBulkCreateVirtualAccounts';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));

type Filters = {
  classLevels: string[];
  membershipStatus: string[];
  boardingStatus: string[];
  hasDebt: boolean | null;
};

function buildStudentQuery(filters: Filters, searchQuery: string) {
  let q = supabase.from('student_profiles').select('*', { count: 'exact' });

  if (filters.classLevels.length > 0) q = q.in('class_level', filters.classLevels);
  if (filters.membershipStatus.length > 0) q = q.in('membership_status', filters.membershipStatus);
  if (filters.boardingStatus.length > 0) q = q.in('boarding_status', filters.boardingStatus);
  if (filters.hasDebt === true) q = q.gt('debt_balance', 0);
  if (filters.hasDebt === false) q = q.or('debt_balance.is.null,debt_balance.eq.0');

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const safe = trimmed.replace(/[%,()*]/g, '');
    q = q.or(
      `admission_number.ilike.%${safe}%,class_level.ilike.%${safe}%,registration_number.ilike.%${safe}%`
    );
  }
  return q;
}

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    classLevels: [],
    membershipStatus: [],
    boardingStatus: [],
    hasDebt: null,
  });

  const { isCreating, progress, errors, startBulkCreation } = useBulkCreateVirtualAccounts();

  // Reset page when filters/search/pageSize change
  useEffect(() => { setPage(1); }, [searchQuery, filters, pageSize]);

  // Server-side aggregate stats (independent of pagination)
  const { data: stats } = useQuery({
    queryKey: ['admin-students-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_student_stats' as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_students: Number(row?.total_students ?? 0),
        total_school_fees: Number(row?.total_school_fees ?? 0),
        total_wallet_balance: Number(row?.total_wallet_balance ?? 0),
        total_debt: Number(row?.total_debt ?? 0),
        va_count: Number(row?.va_count ?? 0),
      };
    },
  });

  // Paginated students query
  const { data: pageData, isLoading, isFetching, error: studentsError, refetch } = useQuery({
    queryKey: ['admin-students', page, pageSize, searchQuery, filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: studentData, count, error: studentError } = await buildStudentQuery(filters, searchQuery)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (studentError) {
        console.error('admin-students: student_profiles query failed', studentError);
        throw studentError;
      }
      if (!studentData || studentData.length === 0) {
        return { rows: [], count: count ?? 0 };
      }

      const userIds = studentData.map((s: any) => s.user_id);
      const parentIds = studentData.map((s: any) => s.parent_id).filter(Boolean) as string[];
      const allIds = Array.from(new Set([...userIds, ...parentIds]));

      const CHUNK = 100;
      const [profilesResults, walletsResults] = await Promise.all([
        Promise.all(chunk(allIds, CHUNK).map(ids =>
          supabase.from('profiles').select('id, first_name, last_name, email').in('id', ids))),
        Promise.all(chunk(userIds, CHUNK).map(ids =>
          supabase.from('wallets').select('user_id, balance, currency').in('user_id', ids))),
      ]);

      const pErr = profilesResults.find(r => r.error)?.error;
      const wErr = walletsResults.find(r => r.error)?.error;
      if (pErr) { console.error('profiles failed', pErr); throw pErr; }
      if (wErr) { console.error('wallets failed', wErr); throw wErr; }

      const profilesData = profilesResults.flatMap(r => r.data || []);
      const walletData = walletsResults.flatMap(r => r.data || []);
      const profileById = new Map(profilesData.map((p: any) => [p.id, p]));
      const walletByUser = new Map(walletData.map((w: any) => [w.user_id, w]));

      const rows = studentData.map((student: any) => ({
        ...student,
        profiles: profileById.get(student.user_id) || null,
        parent_profile: student.parent_id ? profileById.get(student.parent_id) || null : null,
        wallets: walletByUser.get(student.user_id) || null,
      }));

      return { rows, count: count ?? rows.length };
    },
  });

  const students = pageData?.rows ?? [];
  const totalCount = pageData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Stats from server (overall, not just current page)
  const totalStudents = stats?.total_students ?? 0;
  const totalSchoolFees = stats?.total_school_fees ?? 0;
  const totalBalance = stats?.total_wallet_balance ?? 0;
  const avgBalance = totalStudents > 0 ? totalBalance / totalStudents : 0;
  const studentsWithoutVA = Math.max(0, totalStudents - (stats?.va_count ?? 0));

  // Client-side name filter (operates only on current page rows)
  const filteredStudents = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return students;
    return students.filter((student: any) => {
      const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
      if (!profile) return true;
      return (
        profile.first_name?.toLowerCase().includes(trimmed) ||
        profile.last_name?.toLowerCase().includes(trimmed) ||
        profile.email?.toLowerCase().includes(trimmed) ||
        student.admission_number?.toLowerCase().includes(trimmed) ||
        student.class_level?.toLowerCase().includes(trimmed) ||
        student.registration_number?.toLowerCase().includes(trimmed)
      );
    });
  }, [students, searchQuery]);

  const availableClasses = useMemo(
    () => Array.from(new Set(students.map((s: any) => s.class_level).filter(Boolean) as string[])).sort(),
    [students]
  );

  const handleBulkCreateVA = async () => {
    try {
      await startBulkCreation();
      refetch();
    } catch (error) {
      console.error('Bulk creation failed:', error);
    }
  };

  // Export all matching students (respecting filters, ignoring pagination)
  const handleExportCredentials = async () => {
    setIsExporting(true);
    try {
      const PAGE = 1000;
      let from = 0;
      const allStudents: any[] = [];
      // First batch + count
      while (true) {
        const { data, error } = await buildStudentQuery(filters, searchQuery)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allStudents.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (allStudents.length === 0) {
        toast.error('No students to export');
        return;
      }

      const userIds = allStudents.map(s => s.user_id);
      const profilesResults = await Promise.all(
        chunk(userIds, 100).map(ids =>
          supabase.from('profiles').select('id, first_name, last_name, email').in('id', ids))
      );
      const pErr = profilesResults.find(r => r.error)?.error;
      if (pErr) throw pErr;
      const profileById = new Map(profilesResults.flatMap(r => r.data || []).map((p: any) => [p.id, p]));

      const csvData = allStudents.map(student => {
        const profile = profileById.get(student.user_id) as any;
        return {
          'First Name': profile?.first_name || '',
          'Last Name': profile?.last_name || '',
          'Email': profile?.email || '',
          'Password': student.admission_number || '',
          'Admission Number': student.admission_number || '',
          'Class': student.class_level || '',
          'Registration Number': student.registration_number || '',
        };
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `student_credentials_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allStudents.length} student credentials`);
    } catch (e: any) {
      console.error('export failed', e);
      toast.error(e?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const rangeFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Students Management</h1>
        <p className="text-muted-foreground">Manage student profiles, wallets, and information</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Students" value={totalStudents.toString()} icon={Users} />
        <StatCard title="Active Students" value={totalStudents.toString()} icon={UserCheck} />
        <StatCard
          title="Total School Fees"
          value={`₦${totalSchoolFees.toLocaleString()}`}
          icon={TrendingUp}
          description="Expected revenue"
        />
        <StatCard title="Total Balance" value={`₦${totalBalance.toLocaleString()}`} icon={Wallet} />
        <StatCard
          title="Avg Balance"
          value={`₦${avgBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
        />
      </div>

      {/* Bulk Virtual Account Creation */}
      {studentsWithoutVA > 0 && (
        <Alert className="border-warning bg-warning/10">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Virtual Accounts Not Created</AlertTitle>
          <AlertDescription className="space-y-4">
            <p className="text-sm text-foreground">
              <strong>{studentsWithoutVA}</strong> student{studentsWithoutVA !== 1 ? 's' : ''} do not have virtual accounts yet.
              Virtual accounts are required for receiving bank transfer payments from parents.
            </p>

            {!isCreating && progress.total === 0 && (
              <Button onClick={handleBulkCreateVA} className="w-full sm:w-auto">
                🏦 Create Virtual Accounts for All Students
              </Button>
            )}

            {isCreating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Creating virtual accounts...</span>
                  <span className="font-semibold">{progress.processed} / {progress.total}</span>
                </div>
                <Progress value={(progress.processed / progress.total) * 100} className="h-2" />
              </div>
            )}

            {!isCreating && progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-success font-semibold">✅ {progress.successful}</span>
                    <span className="text-muted-foreground">successful</span>
                  </div>
                  {progress.failed > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-destructive font-semibold">❌ {progress.failed}</span>
                      <span className="text-muted-foreground">failed</span>
                    </div>
                  )}
                </div>

                {errors.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View {errors.length} error{errors.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-destructive font-mono">
                          Student {err.student_id}: {err.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Students</CardTitle>
              <CardDescription>View and manage student records</CardDescription>
            </div>
            <div className="flex gap-2">
              <StudentFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableClasses={availableClasses}
              />
              <Button variant="outline" size="sm" onClick={handleExportCredentials} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Export Credentials
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to load students</AlertTitle>
              <AlertDescription>
                <div className="font-mono text-xs whitespace-pre-wrap break-all">
                  <div><strong>message:</strong> {(studentsError as any)?.message || String(studentsError)}</div>
                  {(studentsError as any)?.code && <div><strong>code:</strong> {(studentsError as any).code}</div>}
                  {(studentsError as any)?.details && <div><strong>details:</strong> {(studentsError as any).details}</div>}
                  {(studentsError as any)?.hint && <div><strong>hint:</strong> {(studentsError as any).hint}</div>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, admission number, class, or registration..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Students Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="relative">
              {isFetching && !isLoading && (
                <div className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground flex items-center gap-1 shadow">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating…
                </div>
              )}
              <div className="rounded-md border overflow-x-auto shadow-sm">
                <Table className="min-w-[1400px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-semibold">Student</TableHead>
                      <TableHead className="font-semibold">Admission No.</TableHead>
                      <TableHead className="font-semibold">Class</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Parent</TableHead>
                      <TableHead className="font-semibold">Virtual Account</TableHead>
                      <TableHead className="font-semibold">School Fees</TableHead>
                      <TableHead className="font-semibold">Wallet Balance</TableHead>
                      <TableHead className="font-semibold">Debt</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student: any) => {
                      const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
                      const wallet = Array.isArray(student.wallets) ? student.wallets[0] : student.wallets;
                      const parent = Array.isArray(student.parent_profile) ? student.parent_profile[0] : student.parent_profile;

                      return (
                        <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {profile?.first_name} {profile?.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground">{profile?.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{student.admission_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{student.class_level}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {student.membership_status === 'MEMBER' && (
                                <Badge variant="secondary" className="text-xs">Member</Badge>
                              )}
                              {student.boarding_status === 'BOARDER' && (
                                <Badge variant="default" className="text-xs">Boarder</Badge>
                              )}
                              {student.boarding_status === 'DAY' && (
                                <Badge variant="outline" className="text-xs">Day</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {parent ? `${parent.first_name} ${parent.last_name}` : (
                              <span className="text-muted-foreground">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <VirtualAccountStatus
                              studentId={profile?.id || student.user_id}
                              studentName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
                              studentEmail={profile?.email}
                            />
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            ₦{student.school_fees?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₦{wallet?.balance?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell>
                            {student.debt_balance && student.debt_balance > 0 ? (
                              <div className="flex items-center gap-1 text-destructive font-semibold">
                                <ShieldAlert className="h-3 w-3" />
                                ₦{student.debt_balance.toLocaleString()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setStudentToEdit(student);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{rangeFrom}</span>–
                  <span className="font-medium text-foreground">{rangeTo}</span> of{' '}
                  <span className="font-medium text-foreground">{totalCount}</span> students
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || isFetching}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm px-3 text-muted-foreground">
                      Page <span className="font-medium text-foreground">{page}</span> of{' '}
                      <span className="font-medium text-foreground">{totalPages}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isFetching}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || filters.classLevels.length || filters.membershipStatus.length || filters.boardingStatus.length || filters.hasDebt !== null
                ? 'No students found matching your filters.'
                : 'No students found.'}
            </div>
          )}
        </CardContent>
      </Card>

      <StudentDetailDialog
        student={selectedStudent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <EditStudentDialog
        student={studentToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => refetch()}
      />
      <AddStudentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
