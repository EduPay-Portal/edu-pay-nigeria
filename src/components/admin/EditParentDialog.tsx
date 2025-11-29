import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parentProfileSchema } from "@/lib/validations/profiles";
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

interface EditParentDialogProps {
  parent: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ParentFormValues = z.infer<typeof parentProfileSchema>;

export function EditParentDialog({ parent, open, onOpenChange }: EditParentDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentProfileSchema),
    values: parent ? {
      occupation: parent.occupation || '',
      notificationPreference: parent.notification_preference || 'email',
      emergencyContact: parent.emergency_contact || '',
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ParentFormValues) => {
      const { error } = await supabase
        .from('parent_profiles')
        .update({
          occupation: data.occupation || null,
          notification_preference: data.notificationPreference,
          emergency_contact: data.emergencyContact || null,
        })
        .eq('user_id', parent.user_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-parents'] });
      toast.success('Parent profile updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to update parent profile');
      console.error('Update error:', error);
    },
  });

  const onSubmit = (data: ParentFormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open && !!parent} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Parent Profile</DialogTitle>
          <DialogDescription>
            Update parent information and preferences
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Teacher, Engineer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergencyContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl>
                    <Input placeholder="+234 XXX XXX XXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notificationPreference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Preference</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select notification preference" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}