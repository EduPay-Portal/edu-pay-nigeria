import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { editStudentSchema, type EditStudentInput } from '@/lib/validations/profiles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditStudentDialogProps {
  student: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStudentDialog({ student, open, onOpenChange }: EditStudentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const profile = Array.isArray(student?.profiles) ? student.profiles[0] : student?.profiles;

  // Fetch available parents
  const { data: parents } = useQuery({
    queryKey: ['parents-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_profiles')
        .select(`
          id,
          user_id,
          profiles!parent_profiles_user_id_fkey (
            first_name,
            last_name,
            email
          )
        `);

      if (error) throw error;
      return data;
    },
    enabled: open && !!student,
  });

  const form = useForm<EditStudentInput>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      classLevel: student?.class_level || '',
      section: student?.section || '',
      schoolFees: student?.school_fees || 0,
      debtBalance: student?.debt_balance || 0,
      membershipStatus: student?.membership_status || null,
      boardingStatus: student?.boarding_status || null,
      parentId: student?.parent_id || null,
      registrationNumber: student?.registration_number || '',
    },
  });

  const onSubmit = async (data: EditStudentInput) => {
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          class_level: data.classLevel,
          section: data.section || null,
          school_fees: data.schoolFees,
          debt_balance: data.debtBalance,
          membership_status: data.membershipStatus,
          boarding_status: data.boardingStatus,
          parent_id: data.parentId || null,
          registration_number: data.registrationNumber || null,
        })
        .eq('id', student.id);

      if (error) throw error;

      toast.success('Student information updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error(error.message || 'Failed to update student information');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open && !!student} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>Edit Student Information</DialogTitle>
              <DialogDescription>
                {profile?.first_name} {profile?.last_name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="classLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Level *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., JSS 1, SSS 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., A, B" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schoolFees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Fees (₦)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="debtBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debt Balance (₦)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="membershipStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="NMEMBER">Non-Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="boardingStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Boarding Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAY">Day Student</SelectItem>
                        <SelectItem value="BOARDER">Boarder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Parent</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No parent</SelectItem>
                      {parents?.map((parent) => {
                        const parentProfile = Array.isArray(parent.profiles) 
                          ? parent.profiles[0] 
                          : parent.profiles;
                        return (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parentProfile?.first_name} {parentProfile?.last_name} ({parentProfile?.email})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
