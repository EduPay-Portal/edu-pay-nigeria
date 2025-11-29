import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, Baby, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface ParentDetailDialogProps {
  parent: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParentDetailDialog({ parent, open, onOpenChange }: ParentDetailDialogProps) {
  if (!parent) return null;

  const profile = Array.isArray(parent.profiles) ? parent.profiles[0] : parent.profiles;

  // Fetch children
  const { data: children } = useQuery({
    queryKey: ['parent-children', parent.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          ),
          wallets:user_id (
            balance
          )
        `)
        .eq('parent_id', parent.user_id);

      if (error) throw error;
      return data;
    },
    enabled: open && !!parent.user_id,
  });

  const totalChildrenBalance = children?.reduce((sum, child) => {
    const wallet = Array.isArray(child.wallets) ? child.wallets[0] : child.wallets;
    return sum + (wallet?.balance || 0);
  }, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl">
                {profile?.first_name} {profile?.last_name}
              </DialogTitle>
              <DialogDescription>{profile?.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Personal Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Personal Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Occupation:</span>
                <p className="font-medium">{parent.occupation || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Emergency Contact:</span>
                <p className="font-medium">
                  {parent.emergency_contact ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {parent.emergency_contact}
                    </span>
                  ) : (
                    'Not provided'
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Notification Preference:</span>
                <div className="mt-1">
                  <Badge variant="outline" className="capitalize flex items-center gap-1 w-fit">
                    <Bell className="h-3 w-3" />
                    {parent.notification_preference}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Children Information */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Baby className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Children ({children?.length || 0})</h3>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Total Balance: </span>
                <span className="font-bold text-primary">₦{totalChildrenBalance.toLocaleString()}</span>
              </div>
            </div>

            {children && children.length > 0 ? (
              <div className="space-y-2">
                {children.map((child) => {
                  const childProfile = Array.isArray(child.profiles) ? child.profiles[0] : child.profiles;
                  const wallet = Array.isArray(child.wallets) ? child.wallets[0] : child.wallets;

                  return (
                    <Card key={child.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {childProfile?.first_name?.[0]}{childProfile?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {childProfile?.first_name} {childProfile?.last_name}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{child.class_level}</Badge>
                              <Badge variant="secondary" className="text-xs">{child.admission_number}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Wallet Balance</p>
                          <p className="font-semibold text-lg">₦{wallet?.balance?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground border rounded-lg">
                No children linked to this parent
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}