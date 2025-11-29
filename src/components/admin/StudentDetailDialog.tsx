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
import { User, GraduationCap, Wallet, UserCircle, Building2 } from "lucide-react";
import { VirtualAccountCard } from "@/components/dashboard/VirtualAccountCard";

interface StudentDetailDialogProps {
  student: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentDetailDialog({ student, open, onOpenChange }: StudentDetailDialogProps) {
  if (!student) return null;

  const profile = student.profiles;
  const parentProfile = student.parent_profile?.profiles;
  const wallet = student.wallet;

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
                <span className="text-muted-foreground">Admission Number:</span>
                <p className="font-medium">{student.admission_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Registration Number:</span>
                <p className="font-medium">{student.registration_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{profile?.phone_number || 'N/A'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Academic Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Academic Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Class:</span>
                <p className="font-medium">{student.class_level || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Section:</span>
                <p className="font-medium">{student.section || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Membership:</span>
                <div className="mt-1">
                  <Badge variant={student.membership_status === 'Member' ? 'default' : 'secondary'}>
                    {student.membership_status || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Boarding:</span>
                <div className="mt-1">
                  <Badge variant={student.boarding_status === 'Boarder' ? 'default' : 'outline'}>
                    {student.boarding_status || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Financial Information</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <span className="text-muted-foreground text-xs">School Fees</span>
                <p className="font-bold text-lg text-primary">
                  ₦{student.school_fees?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-accent/50 p-4 rounded-lg">
                <span className="text-muted-foreground text-xs">Wallet Balance</span>
                <p className="font-bold text-lg">
                  ₦{wallet?.balance?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-destructive/10 p-4 rounded-lg">
                <span className="text-muted-foreground text-xs">Debt Balance</span>
                <p className="font-bold text-lg text-destructive">
                  ₦{student.debt_balance?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Parent Information */}
          {parentProfile && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Parent/Guardian Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">
                      {parentProfile.first_name} {parentProfile.last_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{parentProfile.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{parentProfile.phone_number || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Virtual Account */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Virtual Account</h3>
            </div>
            <VirtualAccountCard studentId={student.user_id} showCreateButton={false} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
