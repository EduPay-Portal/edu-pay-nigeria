import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const addStudentSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  admissionNumber: z.string().min(1, "Admission number is required"),
  classLevel: z.string().min(1, "Class level is required"),
  section: z.string().optional(),
  schoolFees: z.string().regex(/^\d+$/, "Must be a valid number").optional(),
  parentId: z.string().nullable(),
});

type AddStudentFormValues = z.infer<typeof addStudentSchema>;

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<AddStudentFormValues>({
    resolver: zodResolver(addStudentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      admissionNumber: '',
      classLevel: '',
      section: '',
      schoolFees: '',
      parentId: null,
    },
  });

  // Fetch parents for dropdown
  const { data: parents } = useQuery({
    queryKey: ['parents-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_profiles')
        .select(`
          user_id,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddStudentFormValues) => {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.admissionNumber, // Use admission number as default password
        email_confirm: true,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'student',
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // Create student profile
      const { error: profileError } = await supabase
        .from('student_profiles')
        .insert({
          user_id: authData.user.id,
          admission_number: data.admissionNumber,
          class_level: data.classLevel,
          section: data.section || null,
          school_fees: data.schoolFees ? parseFloat(data.schoolFees) : null,
          parent_id: data.parentId || null,
        });

      if (profileError) throw profileError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success('Student created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create student');
      console.error('Create error:', error);
    },
  });

  const onSubmit = (data: AddStudentFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Create a new student account. The admission number will be used as the default password.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="student@school.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="admissionNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ADM001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="classLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Level</FormLabel>
                    <FormControl>
                      <Input placeholder="JSS 1, SS 2, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="A, B, C" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schoolFees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Fees (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="50000" {...field} />
                    </FormControl>
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
                  <FormLabel>Linked Parent (Optional)</FormLabel>
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
                          <SelectItem key={parent.user_id} value={parent.user_id}>
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Student
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}