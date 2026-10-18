import Image from "next/image";

export const metadata = {
  title: "法器",
};

const TOOLS = [
  {
    href: "/tools/prosody",
    logo: "/brand/prosody.svg",
    name: "Prosody",
    subtitle: "韵律",
    description: "把文字拆成音节与国际音标（IPA），逐音节高亮朗读；可切换歌唱与说话两种读法。",
  },
];

export default function Page() {
  return (
    <section>
      <h1 className="pageTitle">法器</h1>
      <div className="muted" style={{ marginBottom: 28 }}>
        辅助自省的外物。
      </div>
      <div className="toolGrid">
        {TOOLS.map((tool) => (
          // Plain <a>: tool apps are served as standalone HTML, not Next pages.
          <a key={tool.href} className="toolCard" href={tool.href}>
            <Image className="toolLogo" src={tool.logo} alt="" width={64} height={64} unoptimized />
            <span className="toolText">
              <span className="toolName">
                {tool.name}
                <span className="toolSubtitle">{tool.subtitle}</span>
              </span>
              <span className="toolDesc">{tool.description}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

