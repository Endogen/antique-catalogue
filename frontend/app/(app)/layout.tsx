import { UploadQueue } from "@/components/upload-queue";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";

export default function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}<UploadQueue /></AppShell>
    </AuthGuard>
  );
}
