import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignInFormData, SignUpFormData, ResetPasswordFormData, signInSchema, signUpSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { Eye, EyeOff, Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSignIn = async (data: SignInFormData) => {
    try {
      await signIn(data.email, data.password);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in. Please check your credentials.",
        variant: "destructive",
      });
    }
  };

  const onSignUp = async (data: SignUpFormData) => {
    try {
      await signUp(data.email, data.password, data.firstName, data.lastName, data.role);
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
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

  const handleSocialLogin = (provider: string) => {
    toast({
      title: "Coming soon",
      description: `${provider} sign in will be available soon`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Blue Gradient */}
      <div className="relative lg:w-[40%] w-full min-h-[30vh] lg:min-h-screen bg-gradient-to-br from-[#4361EE] to-[#3651CE] p-8 lg:p-12 flex flex-col">
        {/* Logo at top */}
        <div className="flex items-center text-white mb-8">
          <Wallet className="w-8 h-8" />
          <span className="ml-3 text-2xl font-bold">EduPay Connect</span>
        </div>
        
        {/* Centered content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-3xl lg:text-5xl font-bold mb-4">
            {isSignUp ? "Already Signed up?" : "Don't have an account?"}
          </h1>
          <p className="text-white/90 text-base lg:text-lg mb-8 max-w-md">
            {isSignUp 
              ? "Sign in to access your dashboard and manage your payments"
              : "Join EduPay Connect today and simplify your school payments"
            }
          </p>
          <Button
            variant="outline"
            size="lg"
            className="border-2 border-white text-white bg-transparent hover:bg-white/10 hover:text-white px-8"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setShowPassword(false);
            }}
          >
            {isSignUp ? "LOG IN" : "SIGN UP"}
          </Button>
        </div>
      </div>

      {/* Right Panel - White Form */}
      <div className="lg:w-[60%] w-full bg-background min-h-[70vh] lg:min-h-screen p-6 lg:p-16 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              {isSignUp ? "Sign Up for an Account" : "Welcome Back"}
            </h2>
            <p className="text-muted-foreground">
              {isSignUp 
                ? "Create your account to get started with EduPay Connect"
                : "Sign in to your account to continue"
              }
            </p>
          </div>

          {/* Sign Up Form */}
          {isSignUp && (
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-5">
              {/* First Name & Last Name - 2 columns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    className="mt-1"
                    {...signUpForm.register("firstName")}
                  />
                  {signUpForm.formState.errors.firstName && (
                    <p className="text-destructive text-sm mt-1">{signUpForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    className="mt-1"
                    {...signUpForm.register("lastName")}
                  />
                  {signUpForm.formState.errors.lastName && (
                    <p className="text-destructive text-sm mt-1">{signUpForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email - Full width */}
              <div>
                <Label htmlFor="signupEmail" className="text-foreground">Email</Label>
                <Input
                  id="signupEmail"
                  type="email"
                  placeholder="your.email@school.edu.ng"
                  className="mt-1"
                  {...signUpForm.register("email")}
                />
                {signUpForm.formState.errors.email && (
                  <p className="text-destructive text-sm mt-1">{signUpForm.formState.errors.email.message}</p>
                )}
              </div>

              {/* Password - Full width with toggle */}
              <div>
                <Label htmlFor="signupPassword" className="text-foreground">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="signupPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    {...signUpForm.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpForm.formState.errors.password && (
                  <p className="text-destructive text-sm mt-1">{signUpForm.formState.errors.password.message}</p>
                )}
              </div>

              {/* Role Selection - Prominent display */}
              <div>
                <Label htmlFor="role" className="text-foreground text-base font-semibold">I am a...</Label>
                <select
                  id="role"
                  className="flex h-11 w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  {...signUpForm.register("role")}
                >
                  <option value="">Select your role</option>
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                  <option value="admin">School Administrator</option>
                </select>
                {signUpForm.formState.errors.role && (
                  <p className="text-destructive text-sm mt-1">{signUpForm.formState.errors.role.message}</p>
                )}
              </div>

              {/* Terms & Conditions Checkbox */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary border-input rounded"
                  required
                />
                <label htmlFor="terms" className="ml-2 text-sm text-muted-foreground">
                  I agree to the{" "}
                  <a href="#" className="text-primary hover:underline">
                    Terms & Conditions
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary hover:underline">
                    Privacy Policy
                  </a>
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={signUpForm.formState.isSubmitting}
              >
                {signUpForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "SIGN UP"
                )}
              </Button>
            </form>
          )}

          {/* Login Form */}
          {!isSignUp && (
            <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-5">
              {/* Email */}
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

              {/* Password */}
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

              {/* Remember Me */}
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

              {/* Submit Button */}
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
          )}

          {/* Social Login Section */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">
                  Or {isSignUp ? 'sign up' : 'sign in'} using
                </span>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-4">
              {/* Google */}
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border border-input rounded-lg hover:bg-accent transition-colors"
                onClick={() => handleSocialLogin('Google')}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </button>
              
              {/* Facebook */}
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border border-input rounded-lg hover:bg-accent transition-colors"
                onClick={() => handleSocialLogin('Facebook')}
              >
                <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              
              {/* Twitter */}
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border border-input rounded-lg hover:bg-accent transition-colors"
                onClick={() => handleSocialLogin('Twitter')}
              >
                <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </button>
            </div>
          </div>
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
