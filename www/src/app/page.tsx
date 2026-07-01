import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/Button'

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <div className="relative isolate overflow-hidden bg-gray-900">
        <svg
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full stroke-white/10 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
        >
          <defs>
            <pattern
              id="hero-grid-pattern"
              width="200"
              height="200"
              x="50%"
              y="-1"
              patternUnits="userSpaceOnUse"
            >
              <path d="M.5 200V.5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y="-1" className="overflow-visible fill-gray-800/20">
            <path
              d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
              strokeWidth="0"
            />
          </svg>
          <rect width="100%" height="100%" fill="url(#hero-grid-pattern)" strokeWidth="0" />
        </svg>
        <div
          aria-hidden="true"
          className="absolute left-[calc(50%-4rem)] top-10 -z-10 transform-gpu blur-3xl sm:left-[calc(50%-18rem)] lg:left-48 lg:top-[calc(50%-30rem)] xl:left-[calc(50%-24rem)]"
        >
          <div
            style={{
              clipPath:
                'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
            }}
            className="aspect-[1108/632] w-[69.25rem] bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
          />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
          <div className="mx-auto max-w-2xl shrink-0 lg:mx-0 lg:pt-8">
            <Image
              src="/sonicjs-favicon.png"
              alt="SonicJS"
              width={44}
              height={44}
              className="h-11 w-auto"
              priority
            />
            <div className="mt-24 sm:mt-32 lg:mt-16">
              <Link href="/changelog" className="inline-flex space-x-6 no-underline">
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm/6 font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/25">
                  What&apos;s new
                </span>
                <span className="inline-flex items-center space-x-2 text-sm/6 font-medium text-gray-300">
                  <span>Just shipped v3.0.0-beta</span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className="size-5 text-gray-500"
                  >
                    <path
                      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                      fillRule="evenodd"
                    />
                  </svg>
                </span>
              </Link>
            </div>
            <h1 className="mt-10 text-pretty text-5xl font-semibold tracking-tight text-white sm:text-7xl">
              The only headless CMS born on the edge.
            </h1>
            <p className="mt-8 text-pretty text-lg font-medium text-gray-400 sm:text-xl/8">
              Zero cold starts, anywhere on Earth. 100% MIT open source, every feature free. Built
              for Cloudflare Workers — and runs on Docker, your VPS, anywhere SQLite runs.
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <Link
                href="/quickstart"
                className="rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 no-underline"
              >
                Get started free
              </Link>
              <Link
                href="https://github.com/lane711/sonicjs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm/6 font-semibold text-white no-underline"
              >
                Star on GitHub <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="mt-8 rounded-lg bg-white/5 px-4 py-3 font-mono text-sm text-gray-300 ring-1 ring-white/10">
              $ npx create-sonicjs@latest my-app
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
              <span>MIT licensed</span>
              <span aria-hidden="true">·</span>
              <span>330+ edge cities</span>
              <span aria-hidden="true">·</span>
              <span>$0 to start</span>
              <span aria-hidden="true">·</span>
              <span>TypeScript-first</span>
              <span aria-hidden="true">·</span>
              <span>Runs anywhere</span>
            </div>
          </div>
          <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
            <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
              <div className="-m-2 rounded-xl bg-white/[0.025] p-2 ring-1 ring-inset ring-white/10 lg:-m-4 lg:rounded-2xl lg:p-4">
                <Image
                  src="/images/home/admin-screenshot.png"
                  alt="SonicJS admin content management interface"
                  width={3360}
                  height={2100}
                  className="w-[76rem] rounded-md bg-white/5 shadow-2xl ring-1 ring-white/10"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Benchmark strip ── */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-400/5 to-teal-500/10 dark:from-green-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 border border-green-200/50 dark:border-green-700/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="text-5xl font-black bg-gradient-to-br from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-300 bg-clip-text text-transparent mb-2">
              0-5ms
            </div>
            <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">Cold Start</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">vs 500-2000ms (Strapi)</div>
          </div>
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-cyan-500/10 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-cyan-500/20 border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="text-5xl font-black bg-gradient-to-br from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent mb-2">
              15-50ms
            </div>
            <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">API Response</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">vs 1-4s (competitors)</div>
          </div>
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-500/10 via-purple-400/5 to-pink-500/10 dark:from-purple-500/20 dark:via-purple-400/10 dark:to-pink-500/20 border border-purple-200/50 dark:border-purple-700/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="text-5xl font-black bg-gradient-to-br from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-300 bg-clip-text text-transparent mb-2">
              300+
            </div>
            <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">Edge Locations</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">vs 1 region (competitors)</div>
          </div>
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-pink-500/10 via-rose-400/5 to-orange-500/10 dark:from-pink-500/20 dark:via-rose-400/10 dark:to-orange-500/20 border border-pink-200/50 dark:border-pink-700/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="text-5xl font-black bg-gradient-to-br from-pink-600 to-orange-500 dark:from-pink-400 dark:to-orange-300 bg-clip-text text-transparent mb-2">
              $0
            </div>
            <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">To Start</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">100k requests/day free</div>
          </div>
        </div>
      </div>

      {/* ── Four pillars ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Fast because edge-native. Free because truly open.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Speed and freedom are the two things every competitor makes you choose between. SonicJS refuses the trade.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: '🌐',
              title: 'Edge-native, zero cold start',
              desc: 'Runs in 300+ Cloudflare cities. 0–5ms cold start vs 100–2000ms on Node.js. No regions to configure — global by default.',
            },
            {
              icon: '🔓',
              title: '100% MIT, every feature free',
              desc: 'Version history, SSO, RBAC, workflows — all included, forever. No open-core bait. No per-seat pricing. No Enterprise gate.',
            },
            {
              icon: '🤝',
              title: 'Independent & portable',
              desc: 'No VC clock. No license rug-pull. No infra lock-in — run the same code on Cloudflare, Docker, or your own VPS. Not captive to a vendor, including us.',
            },
            {
              icon: '⚡',
              title: 'Code-first DX + AI-native',
              desc: 'TypeScript end-to-end, schema-as-code, auto-generated REST API — plus a native MCP server so Claude Code, Cursor & VS Code read and manage your content directly.',
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-all duration-200"
            >
              <div className="text-4xl mb-4">{pillar.icon}</div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{pillar.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why developers switch ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Why Developers Switch to SonicJS
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Migration hell. $99/mo paywalls. Single-region latency. Cold-start lag. You&apos;ve felt
            these. Here&apos;s the escape.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              src: '/images/home/pain-migration.png',
              alt: 'Seamless migration visualization',
              title: 'No More Migration Hell',
              body: (
                <>
                  &ldquo;Upgrading from Strapi v4 → v5 alone took approximately{' '}
                  <strong className="text-red-600 dark:text-red-400">40 hours</strong>&rdquo; with
                  50+ breaking changes documented.
                </>
              ),
              footer: 'SonicJS: Semantic versioning. No surprise breaking changes.',
            },
            {
              src: '/images/home/pain-pricing.png',
              alt: 'Cost efficiency visualization',
              title: '$0 vs $99/mo — No Paywalls',
              body: (
                <>
                  Strapi&apos;s Live Preview requires the{' '}
                  <strong className="text-red-600 dark:text-red-400">$99/month Growth plan</strong>.
                  Roles capped at 3 on free tier. Every feature gated.
                </>
              ),
              footer: 'SonicJS: All features included. MIT licensed. No paywalls. Ever.',
            },
            {
              src: '/images/home/pain-latency.png',
              alt: 'Low-latency global routing visualization',
              title: 'Sub-50ms Globally, Not Just US-East',
              body: (
                <>
                  Traditional CMS deploys to one region. Users in Asia hitting a US server see{' '}
                  <strong className="text-red-600 dark:text-red-400">200-500ms latency</strong>{' '}
                  before your app even responds.
                </>
              ),
              footer: 'SonicJS: 300+ edge locations. Requests routed to the nearest node automatically.',
            },
            {
              src: '/images/home/pain-coldstart.png',
              alt: 'Instant cold start visualization',
              title: '0ms Cold Start, Not 2-Second Lag',
              body: (
                <>
                  Node.js cold starts on Strapi:{' '}
                  <strong className="text-red-600 dark:text-red-400">500-2000ms</strong>. First user
                  after idle pays the full boot penalty. Every. Single. Time.
                </>
              ),
              footer: 'SonicJS on Workers: isolate model — 0ms cold start, no boot penalty.',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="group p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/80 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="mb-4 h-48 overflow-hidden rounded-lg">
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={1792}
                  height={1024}
                  className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{card.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{card.body}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">{card.footer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Code proof ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Define Schema. Get API. Deploy Globally.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">Three steps to production.</p>
        </div>
        <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border-b border-zinc-700">
            <span className="text-xs font-medium text-zinc-400">Define Your Schema</span>
          </div>
          <pre className="p-6 text-sm text-zinc-300 overflow-x-auto m-0 leading-relaxed">{`// Define your data model
const schema = {
  name: 'products',
  fields: {
    title: { type: 'string', required: true },
    price: { type: 'number' },
    inStock: { type: 'boolean', default: true },
    category: { type: 'reference', table: 'categories' }
  }
}`}</pre>
        </div>
        <div className="my-6 p-6 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <h3 className="text-base font-semibold mb-2 flex items-center text-gray-900 dark:text-white">
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold px-2 py-1 rounded mr-2">
              RESULT
            </span>
            Auto-generated REST API — zero boilerplate
          </h3>
          <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto m-0">{`GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id

// Filtering, sorting, pagination built in
GET /api/products?category=electronics&sort=-price&limit=20`}</pre>
        </div>
      </div>

      {/* ── Feature grid ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Lightweight Core, Powerful Plugins
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { href: '/plugins', color: 'purple', emoji: '🧩', title: 'Plugin Architecture', desc: <>25+ core plugins included. Build your own with the <code className="text-xs">definePlugin()</code> SDK.</> },
            { href: '/plugins/ai-search', color: 'cyan', emoji: '🤖', title: 'AI Search', desc: 'RAG-powered semantic search with Cloudflare Vectorize. Natural language queries out of the box.' },
            { href: '/forms', color: 'pink', emoji: '📝', title: 'Form Builder', desc: 'Drag-and-drop form builder with Turnstile bot protection and Google Maps integration.' },
            { href: '/authentication', color: 'green', emoji: '🔐', title: 'Flexible Auth', desc: 'Password, OTP, and Magic Link authentication. Role-based access control built-in.' },
            { href: '/caching', color: 'amber', emoji: '⚡', title: 'Three-Tier Cache', desc: 'Memory → KV → D1 caching. 50-100x faster queries. Automatic invalidation.' },
            { href: '/plugins/workflow', color: 'indigo', emoji: '📊', title: 'Content Workflow', desc: 'Draft → Review → Published workflow. Version history with one-click restore.' },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group relative overflow-hidden border border-${card.color}-200/50 dark:border-${card.color}-700/50 bg-gradient-to-br from-${card.color}-50/50 to-${card.color}-100/30 dark:from-${card.color}-900/20 dark:to-${card.color}-900/10 rounded-xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 no-underline`}
            >
              <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {card.emoji}
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{card.title}</h3>
              <div className="text-gray-600 dark:text-gray-300 text-sm">{card.desc}</div>
            </Link>
          ))}
        </div>
        <div className="flex justify-center mt-8">
          <Button href="/plugins" variant="outline" arrow="right">
            See All Plugins
          </Button>
        </div>
      </div>

      {/* ── AI section ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-br from-violet-900/40 via-indigo-900/40 to-blue-900/40 border border-indigo-700/50 p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/25 mb-4">
                AI-Ready
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
                Your content layer, speaking AI.
              </h2>
              <p className="text-lg text-gray-300 mb-6">
                In 2026 every CMS claims AI. SonicJS ships it: a native Model Context Protocol (MCP)
                server your agents connect to directly, RAG-powered semantic search, and an
                AI-friendly API structure your LLM tools already understand.
              </p>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-indigo-400 mt-0.5">✦</span>
                  <span><strong className="text-white">Native MCP server</strong> — auto-generated tools let Claude Code, Cursor &amp; VS Code read, create, and publish your content. Secure scoped API keys; respects your existing permissions.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-400 mt-0.5">✦</span>
                  <span><strong className="text-white">Semantic search</strong> — RAG-powered via Cloudflare Vectorize. Natural language queries, zero extra infra.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-400 mt-0.5">✦</span>
                  <span><strong className="text-white">Agent-ready API</strong> — structured schema, consistent REST surface, auto-generated docs. LLMs understand it out of the box.</span>
                </li>
              </ul>
              <div className="mt-8">
                <Button href="/plugins/ai-search" variant="outline" arrow="right">
                  Explore AI features
                </Button>
              </div>
            </div>
            <div className="mt-10 lg:mt-0 lg:w-80 shrink-0">
              <div className="rounded-xl overflow-hidden border border-indigo-700/50 bg-black/30">
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-indigo-700/30">
                  <span className="text-xs font-medium text-indigo-400">Connect Claude Code / Cursor</span>
                </div>
                <pre className="p-5 text-xs text-indigo-200 overflow-x-auto m-0 leading-relaxed">{`// Point your agent at your CMS
{
  "mcpServers": {
    "sonicjs": {
      "url": "https://your-site.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <mcp-key>"
      }
    }
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Comparison table ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Honest numbers. No marketing spin.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real benchmarks, real pricing. We also publish what SonicJS isn&apos;t great at yet — because devs who read the fine print are the ones worth earning.{' '}
            <Link href="/compare" className="text-blue-600 dark:text-blue-400 hover:underline">Full comparison →</Link>
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
                <th className="text-left p-4 font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">Metric</th>
                <th className="text-center p-4 font-bold text-blue-600 dark:text-blue-400 border-b border-gray-200 dark:border-gray-700">SonicJS</th>
                <th className="text-center p-4 font-bold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Strapi</th>
                <th className="text-center p-4 font-bold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Payload</th>
                <th className="text-center p-4 font-bold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Directus</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Cold Start Time', '0-5ms', '500-2000ms', '100-300ms', '300-1000ms'],
                ['API Response (with relations)', '15-50ms', '1-4s', '1-6s', '1.5-5s'],
                ['Cross-Region Latency', '30-60ms', '300-800ms', '250-600ms', '300-800ms'],
                ['Edge Locations', '300+', '1', '1', '1'],
                ['Dev Server Startup', '2-5s', '10-30s', '15-60s', '5-15s'],
                ['Cloud Hosting', 'Free*', '$99+/mo', '$35+/mo', '$99+/mo'],
              ].map(([metric, sonic, strapi, payload, directus], i, arr) => (
                <tr key={metric} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className={`p-4 font-medium text-gray-900 dark:text-white ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>{metric}</td>
                  <td className={`p-4 text-center font-bold text-blue-600 dark:text-blue-400 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>{sonic}</td>
                  <td className={`p-4 text-center text-gray-600 dark:text-gray-400 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>{strapi}</td>
                  <td className={`p-4 text-center text-gray-600 dark:text-gray-400 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>{payload}</td>
                  <td className={`p-4 text-center text-gray-600 dark:text-gray-400 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>{directus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          *Cloudflare free tier: 100k requests/day, 5GB D1 storage, 5M reads/day. $5/mo for higher traffic.{' '}
          <Link href="/blog/strapi-vs-payload-vs-sonicjs" className="underline hover:text-gray-700 dark:hover:text-gray-300">
            See comparison posts for sources
          </Link>.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/compare" variant="outline" arrow="right">
            Full Comparison
          </Button>
        </div>
      </div>

      {/* ── Pricing reality ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Stop Overpaying for Your CMS
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-1">Strapi Cloud</div>
              <div className="text-3xl font-black text-gray-900 dark:text-white">$99<span className="text-base font-normal text-gray-500">/mo</span></div>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-none pl-0 m-0">
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> 3 roles limit</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> Preview requires paid</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> Single region</li>
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-1">Payload Cloud</div>
              <div className="text-3xl font-black text-gray-900 dark:text-white">$35<span className="text-base font-normal text-gray-500">+/mo</span></div>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-none pl-0 m-0">
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> 13GB RAM dev server</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> 4s query times</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> Single region</li>
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-1">Contentful</div>
              <div className="text-3xl font-black text-gray-900 dark:text-white">$300<span className="text-base font-normal text-gray-500">+/mo</span></div>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-none pl-0 m-0">
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> Usage-based billing</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> Content type limits</li>
              <li className="flex items-center gap-2"><span className="text-red-500">✗</span> $60k/yr enterprise</li>
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-400 dark:border-emerald-600 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              RECOMMENDED
            </div>
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">SonicJS</div>
              <div className="text-3xl font-black text-gray-900 dark:text-white">$0-5<span className="text-base font-normal text-gray-500">/mo</span></div>
            </div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-none pl-0 m-0">
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 100k req/day free</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> All features included</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 300+ edge locations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Deploy anywhere ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Born on the edge. Runs anywhere.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Cloudflare is the flagship — edge-native, zero cold start, the fastest path. But you&apos;re
            never locked in. Same code, your infrastructure, no rewrite.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recommended: Cloudflare */}
          <div className="relative p-6 rounded-xl bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border-2 border-orange-400 dark:border-orange-600">
            <div className="absolute -top-3 left-6 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </div>
            <div className="text-4xl mb-3">☁️</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cloudflare Workers</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Edge-native, zero cold start, 300+ cities. D1 + R2 + KV. The fastest way to run
              SonicJS — and the default.
            </p>
          </div>
          {/* Also runs on */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Also runs on</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { emoji: '🐳', label: 'Docker', desc: 'docker run sonicjs' },
                { emoji: '🖥️', label: 'Any VPS', desc: 'DigitalOcean, Hetzner, Vultr' },
                { emoji: '🚂', label: 'PaaS', desc: 'Railway, Render, Fly.io' },
                { emoji: '🏠', label: 'Homelab', desc: 'Raspberry Pi, NAS, Unraid' },
                { emoji: '🔒', label: 'On-prem', desc: 'Air-gapped & sovereign' },
                { emoji: '▲', label: 'Serverless', desc: 'Vercel, Netlify, Lambda' },
              ].map((target) => (
                <div
                  key={target.label}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                >
                  <div className="text-2xl mb-1">{target.emoji}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{target.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{target.desc}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Runs anywhere SQLite runs. Managed Postgres + S3 for large-scale deploys is on the roadmap.
            </p>
          </div>
        </div>
      </div>

      {/* ── Social proof ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <p className="text-xl italic text-gray-700 dark:text-gray-300 mb-4">
            &ldquo;SonicJS cut our API response times by 80%. We&apos;re now serving millions of requests daily without breaking a sweat.&rdquo;
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            — Engineering Team at Streamline Analytics
          </p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center items-center gap-6">
          <Link
            href="https://github.com/lane711/sonicjs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition no-underline"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M10 1.667c-4.605 0-8.334 3.823-8.334 8.544 0 3.78 2.385 6.974 5.698 8.106.417.075.573-.182.573-.406 0-.203-.011-.875-.011-1.592-2.093.397-2.635-.522-2.802-1.002-.094-.246-.5-1.005-.854-1.207-.291-.16-.708-.556-.01-.567.656-.01 1.124.62 1.281.876.75 1.292 1.948.93 2.427.705.073-.555.291-.93.531-1.143-1.854-.213-3.791-.95-3.791-4.218 0-.929.322-1.698.854-2.296-.083-.214-.375-1.09.083-2.265 0 0 .698-.224 2.292.876a7.576 7.576 0 0 1 2.083-.288c.709 0 1.417.096 2.084.288 1.593-1.11 2.291-.875 2.291-.875.459 1.174.167 2.05.084 2.263.53.599.854 1.357.854 2.297 0 3.278-1.948 4.005-3.802 4.219.302.266.563.78.563 1.58 0 1.143-.011 2.061-.011 2.35 0 .224.156.491.573.405a8.365 8.365 0 0 0 4.11-3.116 8.707 8.707 0 0 0 1.567-4.99c0-4.721-3.73-8.545-8.334-8.545Z" />
            </svg>
            Open Source · MIT License
          </Link>
          <Link
            href="https://discord.gg/8bMy6bv3sZ"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition no-underline"
          >
            💬 Discord Community
          </Link>
          <span className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            ☁️ Built on Cloudflare Workers
          </span>
          <span className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            📘 TypeScript-first
          </span>
        </div>
      </div>

      {/* ── Use cases ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Built For Speed-Critical Applications
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: '🚀', label: 'Startups', desc: 'Ship MVPs fast on $0' },
            { emoji: '🏢', label: 'Enterprise', desc: 'Scale to any load globally' },
            { emoji: '📱', label: 'Mobile Apps', desc: 'Lightning-fast APIs globally' },
            { emoji: '🎮', label: 'Gaming', desc: 'Sub-50ms from any region' },
          ].map((card) => (
            <div
              key={card.label}
              className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <div className="text-4xl mb-2">{card.emoji}</div>
              <div className="font-semibold mb-1 text-gray-900 dark:text-white">{card.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Final CTA band ── */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
            Ready to Go Supersonic?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
            MIT licensed. No credit card. No paywalls. Deploy globally in minutes.
          </p>
          <div className="mb-8 max-w-md mx-auto rounded-lg bg-black/30 px-6 py-4 text-left font-mono text-sm text-blue-100">
            $ npx create-sonicjs@latest my-app
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/quickstart"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-blue-600 shadow-lg transition hover:bg-blue-50 no-underline"
            >
              Getting Started →
            </Link>
            <Link
              href="https://discord.gg/8bMy6bv3sZ"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 no-underline"
            >
              💬 Join Discord
            </Link>
          </div>
        </div>
      </div>

      {/* ── Changelog link ── */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Want to see what changed recently?{' '}
          <Link href="/changelog" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
            View the full changelog →
          </Link>
        </p>
      </div>
    </>
  )
}
