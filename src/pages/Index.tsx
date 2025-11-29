import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Zap, TrendingUp, Wallet, BarChart3, Bell, CheckCircle2, Users, Clock, HeadphonesIcon, Lock, Sparkles, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect } from "react";
import logo from "@/assets/logo_edupay.png";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !roleLoading && user && role) {
      navigate(`/dashboard/${role}`);
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="EduPay Connect" className="h-10 w-auto" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#why-choose" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Why Choose Us</a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/auth">Login</Link>
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/auth">
                  Get Started <ArrowRight className="ml-1 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-primary">Welcome to EduPay Connect</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Manage school fees{" "}
              <span className="text-primary">simply</span> and{" "}
              <span className="text-primary">securely</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg">
              Transform your school's financial management with Nigeria's most trusted digital payment ecosystem. Say goodbye to cash handling risks.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg" asChild>
                <Link to="/auth">
                  Login <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">
                  Get Started
                </Link>
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">410+</span>
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">Active Students</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">₦50M+</span>
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">Transactions Processed</p>
              </div>
            </div>
          </div>

          {/* Right Mockup */}
          <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"></div>
            
            {/* Main Wallet Card */}
            <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 rounded-3xl p-8 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-300">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 rounded-3xl"></div>
              
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-foreground/80 text-sm">Total Balance</p>
                    <h3 className="text-3xl font-bold text-primary-foreground mt-1">₦5,203,450</h3>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-primary-foreground/80 text-sm">Recent Payment</span>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-foreground font-semibold">School Fees - Term 2</p>
                      <p className="text-primary-foreground/60 text-xs">Today, 2:30 PM</p>
                    </div>
                    <p className="text-primary-foreground font-bold">₦45,000</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Stats Cards */}
            <div className="absolute -bottom-6 -left-6 bg-card border shadow-xl rounded-2xl p-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Parents</p>
                  <p className="text-xl font-bold">205+</p>
                </div>
              </div>
            </div>

            <div className="absolute -top-6 -right-6 bg-card border shadow-xl rounded-2xl p-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collection Rate</p>
                  <p className="text-xl font-bold">95%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Numbered Grid */}
      <section id="features" className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2">
              <div className="h-px w-8 bg-primary"></div>
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Financial Excellence</span>
              <div className="h-px w-8 bg-primary"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              Modern and secure <span className="text-primary">school payments</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive financial management tools designed specifically for Nigerian schools
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Feature 01 */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center font-bold text-primary text-xl">
                01
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Digital Wallets</h3>
                <p className="text-muted-foreground">
                  Individual student wallets linked to your school's central account. Secure and trackable.
                </p>
              </div>
            </Card>

            {/* Feature 02 */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all duration-300 border-2 hover:border-success/50">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center font-bold text-success text-xl">
                02
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Safe Payments</h3>
                <p className="text-muted-foreground">
                  Bank-grade security with PCI-DSS compliance, encryption, and comprehensive audit trails.
                </p>
              </div>
            </Card>

            {/* Feature 03 */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all duration-300 border-2 hover:border-secondary/50">
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center font-bold text-secondary text-xl">
                03
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">User Experience</h3>
                <p className="text-muted-foreground">
                  Intuitive interface designed for parents, students, and administrators. No technical skills required.
                </p>
              </div>
            </Card>

            {/* Feature 04 */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all duration-300 border-2 hover:border-accent/50">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center font-bold text-accent text-xl">
                04
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">24/7 Support</h3>
                <p className="text-muted-foreground">
                  Real-time SMS notifications and dedicated support team available whenever you need assistance.
                </p>
              </div>
            </Card>
          </div>

          {/* Additional Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 max-w-6xl mx-auto">
            <Card className="p-6 space-y-3 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold">Multi-Gateway Payments</h4>
              <p className="text-sm text-muted-foreground">Accept payments via Paystack, Flutterwave, cards, and transfers.</p>
            </Card>

            <Card className="p-6 space-y-3 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-secondary" />
              </div>
              <h4 className="font-semibold">Real-Time Analytics</h4>
              <p className="text-sm text-muted-foreground">Live dashboards with insights on collections and trends.</p>
            </Card>

            <Card className="p-6 space-y-3 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <h4 className="font-semibold">Automated Reporting</h4>
              <p className="text-sm text-muted-foreground">Instant receipts and reports. Export to PDF or Excel.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="why-choose" className="py-12 md:py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-3xl md:text-5xl font-bold">
              Why schools <span className="text-primary">trust EduPay</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join leading Nigerian schools using our platform to enhance transparency and efficiency
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
              <div className="h-2 bg-gradient-to-r from-primary to-primary/50"></div>
              <div className="p-8 space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Easy Setup</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get started in minutes with our quick onboarding process. No technical expertise required - we guide you every step of the way.
                </p>
                <Button variant="ghost" className="text-primary hover:text-primary/80 p-0">
                  Learn more <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
              <div className="h-2 bg-gradient-to-r from-success to-success/50"></div>
              <div className="p-8 space-y-4">
                <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lock className="w-7 h-7 text-success" />
                </div>
                <h3 className="text-2xl font-bold">Bank-Grade Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  PCI-DSS compliant infrastructure with end-to-end encryption. Your financial data is protected with industry-leading security standards.
                </p>
                <Button variant="ghost" className="text-success hover:text-success/80 p-0">
                  Learn more <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
              <div className="h-2 bg-gradient-to-r from-secondary to-secondary/50"></div>
              <div className="p-8 space-y-4">
                <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HeadphonesIcon className="w-7 h-7 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold">24/7 Support</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our dedicated support team is always available to help. Get assistance via phone, email, or chat whenever you need it.
                </p>
                <Button variant="ghost" className="text-secondary hover:text-secondary/80 p-0">
                  Learn more <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-3xl md:text-5xl font-bold">
              What our <span className="text-primary">users say</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Real feedback from schools and parents using EduPay Connect
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="p-8 space-y-6 bg-primary/5 border-primary/20">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-lg leading-relaxed italic">
                "EduPay Connect has completely transformed how we manage school fees. The automated notifications and real-time tracking have saved us countless hours and eliminated payment disputes."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold text-lg">MA</span>
                </div>
                <div>
                  <p className="font-semibold">Mrs. Adebayo</p>
                  <p className="text-sm text-muted-foreground">School Administrator, Lagos</p>
                </div>
              </div>
            </Card>

            <Card className="p-8 space-y-6 bg-success/5 border-success/20">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-success text-success" />
                ))}
              </div>
              <p className="text-lg leading-relaxed italic">
                "As a parent, I love the transparency and convenience. I can track my child's expenses in real-time and receive instant payment confirmations. It's a game-changer!"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                  <span className="text-success font-bold text-lg">CO</span>
                </div>
                <div>
                  <p className="font-semibold">Mr. Okonkwo</p>
                  <p className="text-sm text-muted-foreground">Parent, Abuja</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-8">Trusted by leading institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8" />
                <span className="font-semibold">PCI-DSS Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-8 h-8" />
                <span className="font-semibold">ISO Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-8 h-8" />
                <span className="font-semibold">Bank-Grade Security</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10"></div>
              <div className="relative p-12 md:p-16 text-center space-y-6">
                <h2 className="text-3xl md:text-5xl font-bold">
                  Ready to transform your school's finances?
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Join leading Nigerian schools using EduPay Connect to streamline operations and enhance transparency
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg text-lg" asChild>
                    <Link to="/auth">
                      Get Started Today <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg">
                    Schedule Demo
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground pt-4">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Free trial • No credit card required • Setup in 5 minutes
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Column 1 - Brand */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <img src={logo} alt="EduPay Connect" className="h-10 w-auto" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nigeria's most trusted digital payment ecosystem for school fee management. Secure, transparent, and efficient.
              </p>
            </div>

            {/* Column 2 - Product */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>

            {/* Column 3 - Company */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>

            {/* Column 4 - Legal */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 EduPay Connect. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">Facebook</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
