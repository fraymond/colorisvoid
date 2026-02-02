import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Colorisvoid",
    template: "%s · Colorisvoid",
  },
  description: "Colorisvoid.com 是一座数字时代的禅院。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans">
      <body>
        <div className="appShell">
          <header className="siteHeader">
            <div className="container siteHeaderInner">
              <Link className="brand" href="/" aria-label="Colorisvoid">
                <Image
                  src="/brand/colorisvoid.png"
                  alt="Colorisvoid"
                  width={56}
                  height={56}
                  priority
                />
              </Link>
              <Nav />
            </div>
          </header>
          <main className="siteMain">
            <div className="container">{children}</div>
          </main>
          <footer className="siteFooter">
            <div className="container siteFooterInner">
              <span className="footerText">Color is void. Void is color.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
