import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VirtualAccountStatus } from '@/components/admin/VirtualAccountStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Download, Filter, Users, UserCheck, Wallet, TrendingUp, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch students with profiles and wallets
  const { data: students, isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select(`
          *,
          profiles!student_profiles_user_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          wallets!wallets_user_id_fkey (
            balance,
            currency
          ),
          parent_profile:parent_id (
            first_name,
            last_name
          )
        `);

      if (error) throw error;
      return data;
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

  // Filter students based on search
  const filteredStudents = students?.filter(student => {
    const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
    const searchLower = searchQuery.toLowerCase();
    return (
      profile?.first_name?.toLowerCase().includes(searchLower) ||
      profile?.last_name?.toLowerCase().includes(searchLower) ||
      student.admission_number?.toLowerCase().includes(searchLower) ||
      student.class_level?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Students Management</h1>
        <p className="text-muted-foreground">Manage student profiles, wallets, and information</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Students</CardTitle>
              <CardDescription>View and manage student records</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm">
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Virtual Account</TableHead>
                    <TableHead>Wallet Balance</TableHead>
                    <TableHead>Debt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
                    const wallet = Array.isArray(student.wallets) ? student.wallets[0] : student.wallets;
                    const parent = Array.isArray(student.parent_profile) ? student.parent_profile[0] : student.parent_profile;

                    return (
                      <TableRow key={student.id}>
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
                            {student.is_member && (
                              <Badge variant="secondary" className="text-xs">Member</Badge>
                            )}
                            {student.is_boarder && (
                              <Badge variant="default" className="text-xs">Boarder</Badge>
                            )}
                            {!student.is_member && !student.is_boarder && (
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
                          <VirtualAccountStatus studentId={profile?.id || student.user_id} />
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{wallet?.balance?.toLocaleString() || '0'}
                        </TableCell>
                        <TableCell>
                          {student.debt && student.debt > 0 ? (
                            <div className="flex items-center gap-1 text-destructive font-semibold">
                              <ShieldAlert className="h-3 w-3" />
                              ₦{student.debt.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">View</Button>
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
    </div>
  );
}
