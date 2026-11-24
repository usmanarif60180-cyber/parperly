import "./editor.css";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/context";
import { Header, Footer } from "../components/shell";
import brand from "../../../packages/config/brand.json";
export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl + "/"),
  title: {
    default: `${brand.name} — Your documents. Clearly handled.`,
    template: `%s | ${brand.name}`,
  },
  description:
    "Edit, merge, split and organize PDFs locally in your browser. Original files stay on your device.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
