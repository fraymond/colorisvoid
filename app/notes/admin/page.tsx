import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/lib/auth";

import AdminReview from "./ui/admin-review";

export const metadata = {
  title: "修炼 · 管理",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin?callbackUrl=%2Fnotes%2Fadmin");
  }

  return (
    <section>
      <h1 className="pageTitle">修炼 · 管理</h1>
      <div className="muted" style={{ marginBottom: 28 }}>
        给新闻稿打分，生成规则草案，再决定哪一版生效。
      </div>
      <AdminReview />
    </section>
  );
}
