import type { ResearchCandidate } from "@/prospecting/types";

export interface PrototypeFile { path: string; content: string }

function cleanImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildPrototypeFiles(candidate: ResearchCandidate, heroImage: string | null): PrototypeFile[] {
  const safeImage = cleanImageUrl(heroImage);
  const data = {
    name: candidate.name,
    city: candidate.city,
    category: candidate.category,
    summary: candidate.summary,
    services: candidate.services.slice(0, 6),
    contact: candidate.contact,
    copy: candidate.copy,
    heroImage: safeImage,
  };

  const page = `const data = ${JSON.stringify(data, null, 2)} as const;

const contactHref = data.contact.whatsapp
  ? "https://wa.me/" + data.contact.whatsapp.replace(/\\D/g, "")
  : data.contact.email
    ? "mailto:" + data.contact.email
    : "#contact";

export default function Home() {
  const heroStyle = data.heroImage
    ? { backgroundImage: "linear-gradient(90deg, rgba(8,8,8,.92) 0%, rgba(8,8,8,.58) 50%, rgba(8,8,8,.20) 100%), url('" + data.heroImage + "')" }
    : undefined;

  return (
    <main>
      <header className="nav-shell">
        <a className="brand" href="#top">{data.name}</a>
        <nav aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#story">About</a>
          <a className="nav-cta" href={contactHref}>Enquire</a>
        </nav>
      </header>

      <section className="hero" id="top" style={heroStyle}>
        <div className="hero-grid">
          <div className="hero-copy reveal">
            <p className="eyebrow">{data.copy.eyebrow}</p>
            <h1>{data.copy.heroTitle}</h1>
            <p className="lede">{data.copy.heroBody}</p>
            <div className="hero-actions">
              <a className="button button-primary" href={contactHref}>{data.copy.ctaLabel}</a>
              <a className="button button-ghost" href="#services">Explore</a>
            </div>
          </div>
          <div className="hero-meta" aria-label="Business details">
            <span>{data.category}</span>
            <span>{data.city}</span>
          </div>
        </div>
      </section>

      <section className="intro section-shell" id="services">
        <div className="section-index">01</div>
        <div>
          <p className="eyebrow">Selected services</p>
          <h2>Designed around the experience, not the transaction.</h2>
        </div>
      </section>

      <section className="service-grid section-shell" aria-label="Services">
        {data.services.map((service, index) => (
          <article className="service-card" key={service}>
            <span className="service-number">0{index + 1}</span>
            <h3>{service}</h3>
            <span className="service-line" />
          </article>
        ))}
      </section>

      <section className="story section-shell" id="story">
        <div className="story-sticky">
          <p className="eyebrow">The experience</p>
          <span className="section-index">02</span>
        </div>
        <div className="story-copy">
          <h2>{data.copy.storyTitle}</h2>
          <p>{data.copy.storyBody}</p>
          <p className="muted">{data.summary}</p>
        </div>
      </section>

      <section className="contact section-shell" id="contact">
        <p className="eyebrow">Private enquiries</p>
        <h2>Make the next interaction feel as considered as the first.</h2>
        <a className="contact-link" href={contactHref}>{data.copy.ctaLabel}<span aria-hidden="true">↗</span></a>
      </section>

      <footer className="footer section-shell">
        <span>{data.name}</span>
        <span>{data.city}</span>
        <span>Concept by Archic</span>
      </footer>
    </main>
  );
}
`;

  const css = `:root {
  --bg: #0a0a0a;
  --bg-soft: #11110f;
  --paper: #f3f0e8;
  --muted: #aaa79e;
  --line: rgba(243, 240, 232, .16);
  --accent: #c9b37d;
  --max: 1440px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--bg); }
body { margin: 0; background: var(--bg); color: var(--paper); font-family: Arial, Helvetica, sans-serif; text-rendering: optimizeLegibility; }
a { color: inherit; text-decoration: none; }
button, a { -webkit-tap-highlight-color: transparent; }
.nav-shell { position: fixed; inset: 0 0 auto; z-index: 20; min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 clamp(22px, 4vw, 64px); border-bottom: 1px solid rgba(255,255,255,.10); background: linear-gradient(180deg, rgba(4,4,4,.82), rgba(4,4,4,.22)); backdrop-filter: blur(16px); }
.brand { max-width: 52vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
nav { display: flex; align-items: center; gap: clamp(14px, 2vw, 30px); color: rgba(243,240,232,.78); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.nav-cta { padding: 11px 15px; border: 1px solid rgba(243,240,232,.35); border-radius: 999px; }
.hero { min-height: 100svh; display: flex; align-items: end; background: radial-gradient(circle at 75% 25%, rgba(201,179,125,.14), transparent 32%), linear-gradient(145deg, #171713, #080808 62%); background-size: cover; background-position: center; }
.hero-grid { width: min(var(--max), 100%); margin: 0 auto; padding: 170px clamp(22px, 5vw, 78px) 64px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
.hero-copy { max-width: 900px; }
.eyebrow { margin: 0 0 18px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 24px; max-width: 12ch; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(56px, 8.8vw, 132px); font-weight: 400; letter-spacing: -.055em; line-height: .88; }
.lede { max-width: 620px; color: rgba(243,240,232,.78); font-size: clamp(17px, 2vw, 23px); line-height: 1.55; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.button { min-height: 50px; display: inline-flex; align-items: center; justify-content: center; padding: 13px 20px; border: 1px solid rgba(243,240,232,.28); border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; transition: transform .25s ease, background .25s ease; }
.button:hover { transform: translateY(-2px); }
.button-primary { border-color: var(--paper); background: var(--paper); color: #0b0b0b; }
.button-ghost { backdrop-filter: blur(12px); }
.hero-meta { display: grid; gap: 6px; padding-bottom: 8px; color: rgba(243,240,232,.62); font-size: 10px; letter-spacing: .14em; text-align: right; text-transform: uppercase; }
.section-shell { width: min(var(--max), 100%); margin-inline: auto; padding-inline: clamp(22px, 5vw, 78px); }
.intro { min-height: 410px; display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 30px; align-items: center; border-bottom: 1px solid var(--line); }
.section-index { color: var(--muted); font-family: Georgia, serif; font-size: 14px; }
.intro h2, .story h2, .contact h2 { margin: 0; max-width: 19ch; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(38px, 5vw, 76px); font-weight: 400; letter-spacing: -.045em; line-height: 1.02; }
.service-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 26px; padding-bottom: 120px; }
.service-card { min-height: 270px; display: flex; flex-direction: column; justify-content: space-between; padding: 26px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.service-card:nth-child(3n) { border-right: 0; }
.service-number { color: var(--muted); font-size: 10px; letter-spacing: .14em; }
.service-card h3 { margin: auto 0 28px; max-width: 15ch; font-family: Georgia, serif; font-size: clamp(24px, 2.7vw, 38px); font-weight: 400; letter-spacing: -.035em; }
.service-line { width: 36px; height: 1px; background: var(--accent); transition: width .3s ease; }
.service-card:hover .service-line { width: 100%; }
.story { min-height: 720px; display: grid; grid-template-columns: .7fr 1.3fr; gap: clamp(40px, 8vw, 130px); padding-top: 120px; padding-bottom: 120px; border-top: 1px solid var(--line); }
.story-sticky { align-self: start; position: sticky; top: 120px; }
.story-copy p { max-width: 700px; margin-top: 34px; color: rgba(243,240,232,.72); font-size: clamp(18px, 2vw, 24px); line-height: 1.65; }
.story-copy .muted { color: var(--muted); font-size: 14px; }
.contact { padding-top: 130px; padding-bottom: 110px; border-top: 1px solid var(--line); background: radial-gradient(circle at 20% 80%, rgba(201,179,125,.09), transparent 32%); }
.contact h2 { max-width: 16ch; }
.contact-link { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 80px; padding: 24px 0; border-block: 1px solid var(--line); font-size: clamp(17px, 2vw, 25px); }
.contact-link span { color: var(--accent); }
.footer { min-height: 110px; display: grid; grid-template-columns: 1fr auto auto; gap: 28px; align-items: center; color: var(--muted); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
@media (max-width: 820px) {
  .nav-shell nav > a:not(.nav-cta) { display: none; }
  .hero-grid { grid-template-columns: 1fr; }
  .hero-meta { display: none; }
  .intro { grid-template-columns: 1fr; padding-top: 90px; padding-bottom: 90px; }
  .service-grid { grid-template-columns: 1fr; }
  .service-card, .service-card:nth-child(3n) { min-height: 210px; border-right: 0; }
  .story { grid-template-columns: 1fr; min-height: auto; }
  .story-sticky { position: static; }
  .footer { grid-template-columns: 1fr; gap: 8px; padding-block: 34px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition-duration: .01ms !important; } }
`;

  return [
    { path: "package.json", content: JSON.stringify({ name: "archic-daily-prototype", version: "0.1.0", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "16.3.0", react: "19.2.8", "react-dom": "19.2.8" }, devDependencies: { "@types/node": "^24.0.0", "@types/react": "^19.2.18", "@types/react-dom": "^19.2.4", typescript: "^5.9.3" }, engines: { node: "22.x" } }, null, 2) + "\n" },
    { path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: false, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "react-jsx", incremental: true, plugins: [{ name: "next" }] }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2) + "\n" },
    { path: "next-env.d.ts", content: "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n\n// Generated by Next.js.\n" },
    { path: "next.config.ts", content: "import type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = { poweredByHeader: false };\nexport default nextConfig;\n" },
    { path: "src/app/layout.tsx", content: "import type { Metadata } from \"next\";\nimport \"./globals.css\";\n\nexport const metadata: Metadata = { title: " + JSON.stringify(candidate.name) + ", description: " + JSON.stringify(candidate.summary.slice(0, 155)) + " };\n\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang=\"en\"><body>{children}</body></html>; }\n" },
    { path: "src/app/page.tsx", content: page },
    { path: "src/app/globals.css", content: css },
    { path: "README.md", content: "# " + candidate.name + " — Archic prototype\n\nAutomatically prepared by Archic Control after conservative operating-status verification. This is a concept prototype, not an official site.\n" },
  ];
}
