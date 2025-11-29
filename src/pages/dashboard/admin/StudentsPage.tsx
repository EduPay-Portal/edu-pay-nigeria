import { useQuery } from '@tanstack/react-query';
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
import { Search, UserPlus, Download, Filter, Users, UserCheck, Wallet, TrendingUp, ShieldAlert, Eye, Pencil, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { StudentFilters } from '@/components/admin/StudentFilters';
import { useBulkCreateVirtualAccounts } from '@/hooks/useBulkCreateVirtualAccounts';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    classLevels: [] as string[],
    membershipStatus: [] as string[],
    boardingStatus: [] as string[],
    hasDebt: null as boolean | null,
  });

  const { isCreating, progress, errors, startBulkCreation } = useBulkCreateVirtualAccounts();

  // Fetch students with profiles and wallets
  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      // Fetch student profiles
      const { data: studentData, error: studentError } = await supabase
        .from('student_profiles')
        .select(`
          *,
          profiles!student_profiles_user_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          parent_profile:parent_id (
            first_name,
            last_name
          )
        `);

      if (studentError) throw studentError;
      if (!studentData) return [];

      // Fetch wallets separately
      const userIds = studentData.map(s => s.user_id);
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('user_id, balance, currency')
        .in('user_id', userIds);

      if (walletError) throw walletError;

      // Merge wallets with students
      return studentData.map(student => ({
        ...student,
        wallets: walletData?.find(w => w.user_id === student.user_id)
      }));
    },
  });

  // Calculate statistics
  const totalStudents = students?.length || 0;
  const activeStudents = students?.length || 0;
  const totalBalance = students?.reduce((sum, student) => {
    const wallet = Array.isArray(student.wallets) ? student.wallets[0] : student.wallets;
    return sum + (wallet?.balance || 0);
  }, 0) || 0;
  const avgBalance = totalStudents > 0 ? totalBalance / totalStudents : 0;
  const totalSchoolFees = students?.reduce((sum, student) => {
    return sum + (student.school_fees || 0);
  }, 0) || 0;

  // Count students without virtual accounts
  const { data: virtualAccountsCount } = useQuery({
    queryKey: ['va-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('student_id', { count: 'exact' });
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const studentsWithoutVA = totalStudents - (virtualAccountsCount || 0);

  const handleBulkCreateVA = async () => {
    try {
      await startBulkCreation();
      // Refresh students list to show new VA statuses
      refetch();
    } catch (error) {
      console.error('Bulk creation failed:', error);
    }
  };

  // Filter students based on search
  const filteredStudents = students?.filter(student => {
    const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
    const searchLower = searchQuery.toLowerCase();
    
    // Search filter
    const matchesSearch = 
      profile?.first_name?.toLowerCase().includes(searchLower) ||
      profile?.last_name?.toLowerCase().includes(searchLower) ||
      student.admission_number?.toLowerCase().includes(searchLower) ||
      student.class_level?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Class level filter
    if (filters.classLevels.length > 0 && !filters.classLevels.includes(student.class_level)) {
      return false;
    }

    // Membership filter
    if (filters.membershipStatus.length > 0 && !filters.membershipStatus.includes(student.membership_status)) {
      return false;
    }

    // Boarding filter
    if (filters.boardingStatus.length > 0 && !filters.boardingStatus.includes(student.boarding_status)) {
      return false;
    }

    // Debt filter
    if (filters.hasDebt !== null) {
      const hasDebt = student.debt_balance && student.debt_balance > 0;
      if (filters.hasDebt !== hasDebt) return false;
    }

    return true;
  });

  // Get unique class levels for filter
  const availableClasses = Array.from(new Set(students?.map(s => s.class_level).filter(Boolean) || [])).sort();

  // Export student credentials to CSV
  const handleExportCredentials = () => {
    if (!students || students.length === 0) {
      toast.error('No students to export');
      return;
    }

    const csvData = students.map(student => {
      const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
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
    
    toast.success(`Exported ${students.length} student credentials`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Students Management</h1>
        <p className="text-muted-foreground">Manage student profiles, wallets, and information</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Students"
          value={totalStudents.toString()}
          icon={Users}
        />
        <StatCard
          title="Active Students"
          value={activeStudents.toString()}
          icon={UserCheck}
        />
        <StatCard
          title="Total School Fees"
          value={`₦${totalSchoolFees.toLocaleString()}`}
          icon={TrendingUp}
          description="Expected revenue"
        />
        <StatCard
          title="Total Balance"
          value={`₦${totalBalance.toLocaleString()}`}
          icon={Wallet}
        />
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
              <Button 
                onClick={handleBulkCreateVA}
                className="w-full sm:w-auto"
              >
                🏦 Create Virtual Accounts for All Students
              </Button>
            )}

            {isCreating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Creating virtual accounts...</span>
                  <span className="font-semibold">
                    {progress.processed} / {progress.total}
                  </span>
                </div>
                <Progress 
                  value={(progress.processed / progress.total) * 100} 
                  className="h-2"
                />
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
              <Button variant="outline" size="sm" onClick={handleExportCredentials}>
                <Download className="h-4 w-4 mr-2" />
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, admission number, or class..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Students Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading students...</div>
          ) : filteredStudents && filteredStudents.length > 0 ? (
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
                  {filteredStudents.map((student) => {
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No students found matching your search.' : 'No students found.'}
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
      />

      <AddStudentDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
