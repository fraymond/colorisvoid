import AdminList from "./ui/admin-list";

export const metadata = {
  title: "顿悟 · 管理",
};

export default function Page() {
  return (
    <section>
      <h1 className="pageTitle">顿悟</h1>
      <AdminList />
    </section>
  );
}

