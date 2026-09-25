import { Suspense } from "react";

import { AdminConsole } from "@/components/admin/admin-console";

// The console keeps its section and search in the URL, which is only known
// in the browser; the boundary lets the rest of the page prerender.
export default function AdminPage() {
  return (
    <Suspense>
      <AdminConsole />
    </Suspense>
  );
}
