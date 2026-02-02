import Editor from "../ui/editor";

export const metadata = {
  title: "顿悟 · 新文",
};

export default function Page() {
  return (
    <section>
      <h1 className="pageTitle">写</h1>
      <Editor mode="new" />
    </section>
  );
}

