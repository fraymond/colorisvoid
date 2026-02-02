import Editor from "../ui/editor";

export const metadata = {
  title: "顿悟 · 编辑",
};

export default function Page({ params }: { params: { id: string } }) {
  return (
    <section>
      <h1 className="pageTitle">改</h1>
      <Editor mode="edit" id={params.id} />
    </section>
  );
}

