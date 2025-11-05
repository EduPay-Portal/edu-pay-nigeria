import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Download, Filter, Phone, Users, UserCheck, Baby, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';

export default function ParentsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch parents with profiles and children
  const { data: parents, isLoading } = useQuery({
    queryKey: ['admin-parents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_profiles')
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email
          )
        `);

      if (error) throw error;

      // Get children count for each parent
      const parentsWithChildren = await Promise.all(
        (data || []).map(async (parent) => {
          const { count } = await supabase
            .from('student_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', parent.user_id);

          return { ...parent, childrenCount: count || 0 };
        })
      );

      return parentsWithChildren;
    },
  });

  // Calculate statistics
  const totalParents = parents?.length || 0;
  const activeParents = parents?.length || 0;
  const totalChildren = parents?.reduce((sum, parent) => sum + parent.childrenCount, 0) || 0;
  const avgChildren = totalParents > 0 ? totalChildren / totalParents : 0;

  // Filter parents based on search
  const filteredParents = parents?.filter(parent => {
    const profile = Array.isArray(parent.profiles) ? parent.profiles[0] : parent.profiles;
    const searchLower = searchQuery.toLowerCase();
    return (
      profile?.first_name?.toLowerCase().includes(searchLower) ||
      profile?.last_name?.toLowerCase().includes(searchLower) ||
      profile?.email?.toLowerCase().includes(searchLower) ||
      parent.occupation?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Parents Management</h1>
        <p className="text-muted-foreground">Manage parent profiles and linked children</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Parents"
          value={totalParents.toString()}
          icon={Users}
        />
        <StatCard
          title="Active Parents"
          value={activeParents.toString()}
          icon={UserCheck}
        />
        <StatCard
          title="Total Children"
          value={totalChildren.toString()}
          icon={Baby}
        />
        <StatCard
          title="Avg Children/Parent"
          value={avgChildren.toFixed(1)}
          icon={TrendingUp}
        />
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Parents</CardTitle>
              <CardDescription>View and manage parent records</CardDescription>
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
                Add Parent
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or occupation..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Parents Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading parents...</div>
          ) : filteredParents && filteredParents.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parent</TableHead>
                    <TableHead>Occupation</TableHead>
                    <TableHead>Children</TableHead>
                    <TableHead>Emergency Contact</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParents.map((parent) => {
                    const profile = Array.isArray(parent.profiles) ? parent.profiles[0] : parent.profiles;

                    return (
                      <TableRow key={parent.id}>
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
                        <TableCell>{parent.occupation || <span className="text-muted-foreground">Not specified</span>}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{parent.childrenCount} {parent.childrenCount === 1 ? 'child' : 'children'}</Badge>
                        </TableCell>
                        <TableCell>
                          {parent.emergency_contact ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {parent.emergency_contact}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{parent.notification_preference}</Badge>
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
              {searchQuery ? 'No parents found matching your search.' : 'No parents found.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
