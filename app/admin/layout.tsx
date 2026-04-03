import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/lib/auth";

import { AdminSidebar } from "./ui/admin-sidebar";
import "./admin.css";

export const metadata = {
  title: "Admin",
};

const isDevBypass =
  process.env.NODE_ENV === "development" && process.env.BYPASS_AUTH === "true";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isDevBypass) {
    const session = await getServerSession(authOptions);
    if (!session) {
      redirect("/auth/signin?callbackUrl=%2Fadmin");
    }
  }

  return (
    <div className="adminShell">
      <AdminSidebar />
      <div className="content">{children}</div>
    </div>
  );
}
