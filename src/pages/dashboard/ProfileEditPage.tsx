import { ProfileSection } from '@/components/dashboard/ProfileSection';

export default function ProfileEditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">View and manage your account information.</p>
      </div>
      <ProfileSection />
    </div>
  );
}