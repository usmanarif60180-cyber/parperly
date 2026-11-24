import Link from "next/link";
import { notFound } from "next/navigation";
const content: Record<string, { title: string; paragraphs: string[] }> = {
  about: {
    title: "A clearer way to work with documents.",
    paragraphs: [
      "Parperly brings practical PDF tools into one workspace. Available local tools process files on your device, while advanced server tools clearly explain their setup requirements.",
      "This is an actively developed application. Capabilities are enabled only when a real processing path exists. No customer counts, certifications or perfect-conversion claims are made.",
    ],
  },
  privacy: {
    title: "Your documents stay on your device.",
    paragraphs: [
      "Available PDF tools read documents into browser memory and generate new downloads. Parperly does not upload PDF contents to Firebase or a processing server. Closing or reloading the tool releases application references to the files; downloaded copies remain on your device.",
      "Firebase Authentication processes your email, account identity and authentication data. Browser storage holds your language preference, Firebase session, local job counts and workflow settings. Local history excludes PDF contents and filenames. Settings you save in workflow presets may contain text you entered; avoid saving sensitive text in shared browsers.",
      "The website is hosted by GitHub Pages, whose infrastructure handles ordinary web requests. No analytics SDK or advertising trackers are loaded by this application. Server-side document storage, retention policies and processing will be described here if they are introduced.",
      "Use Clear local history on the account page and delete saved presets in the workflow builder to remove browser metadata. Sign out on shared devices. This page describes the current implementation; it does not claim regulatory certification.",
    ],
  },
  security: {
    title: "Clear boundaries. Honest safeguards.",
    paragraphs: [
      "Local tools enforce a 40 MB total input limit and a 300-page limit. PDF manipulation runs in a dedicated browser worker with a two-minute deadline and cancellation. Renderer output is bounded. These limits reduce resource usage; they are not a guarantee against every malicious document.",
      "Files are validated by signature and parsed before processing. Generated PDFs are reopened to check structural integrity and page count. Always review the final document before sharing. Digital signatures may be invalidated and advanced interactivity may not survive page copying.",
      "Whiteout, crop and visual overlays do not securely redact underlying content. Drawn or typed signatures are not cryptographic digital signatures. Firebase handles account authentication. No payment processing or cloud document storage is active.",
    ],
  },
  terms: {
    title: "Using Parperly responsibly.",
    paragraphs: [
      "Use documents that you own or are authorized to modify. Keep your originals and review every output. The application is under active development; do not rely on it as your only copy of an important document.",
      "Tool-specific limitations are shown before processing. Availability, formats and output fidelity vary by tool. No paid subscriptions, service-level commitments or certifications are offered in this release.",
      "A commercial operator identity, support address and jurisdiction-specific legal terms have not been supplied. These operating notes are not a substitute for the final legal terms required before a commercial launch.",
    ],
  },
  cookies: {
    title: "Browser storage, explained.",
    paragraphs: [
      "Parperly uses local browser storage for language, Firebase authentication persistence, recent job metadata and saved workflows. These are functional preferences, not advertising profiles.",
      "No analytics or advertising SDK is loaded by Parperly. Firebase and GitHub may process requests under their own service policies. Clear saved history and presets through the application; clear site data in your browser to remove all local settings and session data.",
    ],
  },
  help: {
    title: "Find your next step.",
    paragraphs: [
      "Choose a tool from the directory, select supported files, adjust the settings and create an output. Available local tools support files totaling up to 40 MB and 300 pages.",
      "Page selectors accept all, odd, even and ranges such as 1,3-5. Organize and extract preserve the order you enter, including duplicates. Split creates individual downloads and a ZIP option.",
      "The editor adds new text, highlights, rectangles, whiteout and PNG images. You can draw a visual signature and fill supported existing text or checkbox fields. Existing PDF text replacement, full font editing and secure redaction are not supported.",
      "If an encrypted, damaged or complex PDF fails, keep the original. Password removal, structural repair and OCR require a dedicated backend that is not yet connected.",
    ],
  },
  pricing: {
    title: "Start with the tools available now.",
    paragraphs: [
      "Current browser tools are available without a paid subscription. Sign-in is optional for local processing. The same local limits apply: 40 MB input, 300 pages and bounded image rendering.",
      "Short-term passes, monthly, annual and team plans remain planned. No payment provider is connected, no checkout is active and no paid entitlement is granted. Pricing will be set after real processing costs are measured.",
    ],
  },
  contact: {
    title: "Report an issue.",
    paragraphs: [
      "Use the repository issue tracker to report reproducible bugs. Include the tool, browser, error message and steps. Do not post private documents, passwords or identifying information in a public issue.",
      "A private support mailbox and ticket service have not yet been configured. Parperly does not automatically attach documents to any report.",
    ],
  },
  desktop: {
    title: "Works in your browser. Desktop is separate.",
    paragraphs: [
      "There is no standalone Parperly desktop application or installer. Available local tools process documents in the browser. Do not download software claiming to be an official desktop release from this page.",
      "A fully offline, packaged desktop application remains a separate deliverable.",
    ],
  },
  developer: {
    title: "Developer API: not connected yet.",
    paragraphs: [
      "The hosted website does not expose an HTML-to-PDF or document-processing API. There is no public API key or simulated endpoint.",
      "The repository includes a separate Node API and queue-worker implementation path. Production activation requires private storage, verified Firebase identity, Redis, isolated worker hosting, quotas and validated native engines. Do not send documents to an unconfigured endpoint.",
    ],
  },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(content).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  return { title: content[page]?.title, alternates: { canonical: `${page}/` } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const c = content[page];
  if (!c) notFound();
  return (
    <article className="prose-page">
      <span className="eyebrow">PARPERLY</span>
      <h1>{c.title}</h1>
      {c.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {page === "contact" && (
        <a
          className="btn primary"
          href="https://github.com/usmanarif60180-cyber/parperly/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          Open a GitHub issue
        </a>
      )}
      <Link href="/tools/" className="btn">
        Explore available tools
      </Link>
    </article>
  );
}
