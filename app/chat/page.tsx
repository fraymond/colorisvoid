import ChatUi from "./chat-ui";

export const metadata = {
  title: "问道",
};

export default function Page() {
  return (
    <section>
      <h1 className="pageTitle">问道</h1>
      <ChatUi />
    </section>
  );
}

