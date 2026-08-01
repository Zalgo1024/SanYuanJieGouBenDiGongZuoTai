import { AppShell } from "@/components/app-shell";
import { AppStoreProvider } from "@/lib/store";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <AppShell>{children}</AppShell>
    </AppStoreProvider>
  );
}
