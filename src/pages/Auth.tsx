import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignInFormData, ResetPasswordFormData, signInSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logo from "@/assets/logo_asc.png";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, resetPassword, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Handle post-confirmation redirect
  useEffect(() => {
    if (!authLoading && !roleLoading && user && role) {
      navigate(`/dashboard/${role}`);
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSignIn = async (data: SignInFormData) => {
    const { error } = await signIn(data.email, data.password);
    if (error) {
      console.error('Sign in failed:', error);
    }
  };

  const onResetPassword = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword(data.email);
      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions.",
      });
      setShowResetDialog(false);
      resetPasswordForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Blue Gradient */}
      <div className="relative lg:w-[40%] w-full min-h-[30vh] lg:min-h-screen bg-gradient-to-br from-[#0d4a6b] to-[#082a3d] p-8 lg:p-12 flex flex-col">
        <div className="flex items-center text-white mb-8">
          <img src={logo} alt="ASCI Payment Portal" className="h-12 w-auto bg-white rounded-md p-1" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-3xl lg:text-5xl font-bold mb-4">
            ASCI Payment Portal
          </h1>
          <p className="text-white/90 text-base lg:text-lg mb-4 max-w-md">
            Sign in to access your dashboard and manage your payments.
          </p>
          <p className="text-white/70 text-sm max-w-md">
            Access is restricted. Accounts are provisioned by the school administrator.
            If you need access, please contact the school office.
          </p>
        </div>
      </div>

      {/* Right Panel - White Form */}
      <div className="lg:w-[60%] w-full bg-background min-h-[70vh] lg:min-h-screen p-6 lg:p-16 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Welcome Back
            </h2>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@school.edu.ng"
                className="mt-1"
                {...signInForm.register("email")}
              />
              {signInForm.formState.errors.email && (
                <p className="text-destructive text-sm mt-1">{signInForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-primary p-0 h-auto"
                  onClick={() => setShowResetDialog(true)}
                >
                  Forgot password?
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...signInForm.register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {signInForm.formState.errors.password && (
                <p className="text-destructive text-sm mt-1">{signInForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="h-4 w-4 text-primary focus:ring-primary border-input rounded"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-muted-foreground">
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={signInForm.formState.isSubmitting}
            >
              {signInForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "LOG IN"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account? Please contact your school administrator.
          </p>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPasswordForm.handleSubmit(onResetPassword)} className="space-y-4">
            <div>
              <Label htmlFor="resetEmail">Email</Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="your.email@school.edu.ng"
                className="mt-1"
                {...resetPasswordForm.register("email")}
              />
              {resetPasswordForm.formState.errors.email && (
                <p className="text-destructive text-sm mt-1">{resetPasswordForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={resetPasswordForm.formState.isSubmitting}
            >
              {resetPasswordForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
