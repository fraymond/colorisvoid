import Editor from "../ui/editor";

export const metadata = {
  title: "顿悟 · 编辑",
};

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = await Promise.resolve(params as any);
  return (
    <section>
      <h1 className="pageTitle">改</h1>
      <Editor mode="edit" id={id} />
    </section>
  );
}

