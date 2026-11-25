# BranchQuest — SEO implementation and verification

> Feedback migration notice — 25 November 2026: provider-specific observations below are historical. The active submission system is now the server-side Resend implementation described in [FEEDBACK.md](docs/FEEDBACK.md). They do not certify current email delivery or dashboard configuration.

Implemented for the existing repository on 24 November 2026. **This project uses React + Vite, not Next.js.** The implementation preserves that architecture and uses build-time React rendering to produce real static public HTML. No framework migration, new server, runtime dependencies, academic-data edits or graph redesign were introduced. These local changes have not been deployed to the live website by this task.

## Public identity and content

Canonical origin: **https://branchquest.app**. Preferred site name: **BranchQuest**.

Homepage title:

> BranchQuest – עץ קורסים ותכנון תואר בטכניון

Homepage description:

> חקרו את עץ הקורסים של הטכניון, בדקו דרישות קדם, גלו אילו קורסים תוכלו לקחת ותכננו את מסלול הלימודים שלכם.

The header, About/feedback branding, feedback subject and guide now use BranchQuest. The independent-project disclaimer retains its full non-affiliation and official-source guidance, replacing only the former project name. The original favicon/logo is retained. A checked-in 1200×630 PNG sharing card reuses that logo, the purple design and honest independent-project wording; its editable SVG source is included.

The three real public pages each receive a distinct title/description, canonical, Open Graph and Twitter card metadata:

| Page | Canonical | Pre-rendered content |
|---|---|---|
| Explorer | `https://branchquest.app/` | Visible Hebrew heading/description, prerequisites, degree-catalog and personal-marking context, links and independent disclaimer |
| About | `https://branchquest.app/about` | Shared visible About content describing the actual course explorer, prerequisites, catalog/degree filters, browser-local markings and academic limitations |
| Feedback | `https://branchquest.app/feedback` | Existing feedback purpose, optional email/course context, navigation and independent disclaimer; the interactive form still requires JavaScript |

The HTML contains semantic headings and meaningful content before JavaScript, rather than an empty root. It is not bot-only hidden text. The same descriptive concepts remain in the client explorer and shared About copy. The explorer remains interactive React; personal graph state and individual course pages are not server-rendered or exposed as thousands of indexable URLs. Existing search and graph behavior, faculty/catalog filters, markings, quantities, local storage and RTL remain in the existing implementation. No meta-keywords tag, fake reviews/statistics, unsupported search endpoint or official-affiliation claim was added.

`/about` is now a direct, refresh-safe route. Existing `/?course=...#/about` and `#/feedback` links upgrade in place to clean paths, retaining queries/history state. Navigation and Back/Forward update the same metadata registry. Course IDs, filters, arbitrary queries and fragments are excluded from canonical/OG URLs. Analytics still redacts all query/fragment content and now recognizes the genuine `/about` page; feedback URL context remains sanitized.

## Build output and technical SEO

`npm run build` runs TypeScript, Vite, the public-page pre-renderer and an automatic SEO artifact check. The generated `dist/` includes:

- `index.html`, `about/index.html`, `feedback/index.html`: unique public metadata and pre-rendered bodies using the hashed production assets.
- `sitemap.xml`: exactly the three canonical public URLs above. No invented `lastmod`, course-page inventory or personalized URLs.
- `robots.txt`: permits crawler access to public pages, scripts, styles and fonts; references `https://branchquest.app/sitemap.xml`.
- `og-image.png` and the unchanged original `favicon.svg`.
- `404.html`: a genuine nonindexable missing-page document with no application boot script; unknown paths do not silently become the explorer.

`WebSite` JSON-LD names BranchQuest and points to the canonical homepage. It contains no invented business/rating/search data. The existing restrictive CSP is preserved; one exact SHA-256 hash permits only the generated inert JSON-LD payload, without allowing arbitrary inline JavaScript. Tests check the payload/hash agreement.

### Production and previews

| Environment | Public HTML robots metadata | Host response protection |
|---|---|---|
| Vercel Production build on `branchquest.app` | `index,follow,max-image-preview:large` | No custom `X-Robots-Tag: noindex` applies to the primary host |
| Vercel Preview/development/custom environment | `noindex,nofollow` | Any non-primary hostname also gets `X-Robots-Tag: noindex, nofollow` |
| Local build with no environment indicator | `noindex,nofollow` | Localhost is also non-primary |
| Explicit local production QA build | Production HTML | Localhost still gets a noindex header; the client also keeps local URLs nonindexable |

Production is determined from Vercel's environment variables (`VERCEL_TARGET_ENV` / `VERCEL_ENV`), with a local/self-hosted `BRANCHQUEST_DEPLOYMENT_ENV=production` opt-in only when Vercel does not specify an environment. Preview/custom Vercel environments cannot override themselves into indexability. Client metadata additionally checks the actual hostname. The host condition is anchored to the exact `branchquest.app` name, so lookalike domains and deployment aliases remain excluded.

Robots does **not** disallow all preview crawling: crawlers must be able to read the noindex directive to remove a URL from search. This follows [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Vercel also supplies [its own preview noindex header](https://vercel.com/docs/headers/response-headers); the checked-in guard is an additional explicit protection.

**Deployment requirement:** build/rebuild in the Production environment. Do not simply promote a previously built preview artifact: its deliberately nonindexable HTML would remain nonindexable. Check the deployed primary HTML and headers after release.

## Existing redirects — verified and deliberately not duplicated

Live public HTTP checks at 2026-11-24T17:39:50.807422+00:00 used a Googlebot user agent without credentials or cookies, before deploying these changes.

| Existing URL | Observed result |
|---|---|
| `https://branchquest.app/` | 200, old homepage title, no noindex header or meta |
| `https://branchquest.app/feedback` | 200, old shared homepage metadata |
| `/about`, `/robots.txt`, `/sitemap.xml` on the primary | 404 before this implementation is deployed |
| `https://www.branchquest.app/feedback?courseId=03940902&utm_source=seo-check` | 308 to the same path/query on `https://branchquest.app` |
| `https://course-tree-pied.vercel.app/feedback?courseId=03940902&utm_source=seo-check` | 308 to the same path/query on `https://branchquest.app` |
| Both secondary hosts with `/some/path?x=1&x=2&label=a%2Bb` | 308 to the primary, preserving the deep path, repeated parameters and encoded value |

HTTP `www` also already redirects permanently to HTTPS before the apex redirect. These observed Vercel-level redirects were left intact. No new domain redirects were added to `vercel.json`; localhost and arbitrary preview hosts are not redirected. Private Vercel account settings were not accessible, so no dashboard-level claim beyond these HTTP observations is made.

## Files changed

| Files | Purpose |
|---|---|
| `src/lib/seo.ts` | Shared brand, titles/descriptions, canonical/social metadata, environment policy, WebSite data, robots and sitemap |
| `src/components/PublicContent.tsx` | Shared visible About copy and semantic static page bodies |
| `scripts/seo-build.ts`, `vite.config.ts`, `index.html`, `tsconfig.json` | Build-time public-page rendering and typed integration |
| `scripts/check-seo.mjs`, `package.json` | Automatic artifact verification on every build, plus `seo:check` / `seo:image` commands |
| `public/og-image.svg`, `public/og-image.png`, `scripts/render-social-image.mjs` | Sharing card using the existing logo and fonts; reproducible rendering with the existing Playwright development dependency |
| `vercel.json` | Page-specific rewrites, non-primary-host noindex header and exact JSON-LD CSP hash |
| `src/lib/navigation.ts`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts` | Clean About URLs, legacy fragment compatibility, route-specific client metadata and visible branding |
| `SiteFooter.tsx`, `FeedbackPage.tsx`, `HelpGuide.tsx`, `src/styles.css` | Updated brand, independent disclaimer, shared About content and bounded information-page styling |
| `src/lib/analytics.ts`, `src/lib/feedback.ts` | Preserve sanitized context for the new real About path; feedback subject uses BranchQuest |
| `tests/seo.test.ts`, `tests/seo.spec.ts`, `tests/serve-production.mjs` | Metadata/environment/content checks, JavaScript-disabled and browser navigation tests, production routing/headers/404 fixture |
| Existing feedback/branch/progress/mobile-tools/multi-root tests | Update obsolete placeholder, brand and old shared-document expectations while retaining functional regressions |
| `README.md`, `PROJECT_STATE.md`, this report | Operating instructions, state and verification limits |

## Verification

- **234/234 unit/data tests passed**, including seven new SEO tests. One historical feedback-rewrite expectation was updated for the new pre-rendered documents.
- **Production build and preview build passed**, each including TypeScript and automatic artifact verification. Production metadata is indexable; preview metadata is not.
- **Explicit `tsc --noEmit` passed.** No lint script or linter is configured in this repository; no lint pass is claimed and no unnecessary lint dependency was installed. `git diff --check` is also run for whitespace errors.
- JSON-LD JSON/required site-name properties, exact CSP hash, unique titles/descriptions/canonicals, social image dimensions, robots and sitemap contents, and nonindexable static 404 are checked by `npm run seo:check`.
- Complete browser run with two workers: **158/162 passed**. The four failures were a browser-context teardown timeout, a legacy About-hash assertion, an existing transformed/offscreen branch-menu pointer sequence, and a Playwright text matcher that intentionally excludes `noscript` contents. The old URL assertion was updated; the branch fixture now uses the same native keyboard activation as its other graph actions, preserving all state assertions; the noscript assertion reads DOM text directly. Production graph logic was not changed.
- Final browser run with the repository's normal single worker and final host-header configuration: **12/12 passed**. This includes all **nine SEO cases** (three JavaScript-disabled public pages; primary/preview/lookalike host responses; robots/sitemap/image/404; desktop/mobile metadata plus saved graph/quantity/filter preservation; two legacy-hash upgrades) and the three affected explorer/feedback/multi-root regressions. The complete 162-case suite was not repeated after these test-only adjustments. No known test failures remain.
- Final `npm test`: **234/234 passed**; final explicit TypeScript check and production artifact checker also passed. Desktop/mobile About pages, pre-rendered mobile content and the 1200×630 sharing card were visually reviewed. No browser-test timeout or production graph algorithm was relaxed/changed.
- The JavaScript-disabled tests verify visible descriptive content in all three pages; they do not claim a non-JavaScript interactive graph or feedback submission. Browser checks use Chromium viewport emulation, not a physical phone.
- Both academic JSON hashes, the original favicon, graph/exploration/layout/filter modules, marking/quantity helpers and storage code are unchanged. The checked source matches the Windows QA mirror. No package dependencies or lockfile changed.
- New local production-host browser tests proxy the canonical host entirely to the local fixture; they never alter the live site or submit real feedback. Existing Formspree tests intercept submissions.

## Manual release and Search Console actions

1. Deploy these changes with a **fresh Production build** to the existing Vite/React Vercel project that serves `branchquest.app` (`npm run build`, output directory `dist`). Keep the existing domain redirects. Confirm the build environment is `production`; if system variables are not exposed, enable their exposure. A prebuilt Preview promotion must be rebuilt in Production.
2. On the deployed primary, check `/`, `/about` and `/feedback` return 200, have their correct title/description/canonical and **no noindex meta or `X-Robots-Tag` header**. Check `/robots.txt`, `/sitemap.xml`, `/og-image.png`, and one missing URL (404). Check a preview response still has noindex. Current localhost checks do not certify a future deployment or dashboard override.
3. In Google Search Console, select or verify the **`branchquest.app` Domain property** (DNS verification if it has not been verified). Submit `https://branchquest.app/sitemap.xml`.
4. Use URL Inspection → live test on the homepage and `/about`, confirm crawlability/canonical and request indexing/recrawl. Validate the deployed WebSite JSON-LD using Schema Markup Validator; Google's Rich Results Test does not support site-name validation. Monitor indexing after Google recrawls.

Google ultimately selects displayed site names, titles/snippets and indexing; the code supplies the preferred name and relevant evidence, not a ranking or indexing guarantee. [Google's site-name documentation](https://developers.google.com/search/docs/appearance/site-names) explains the supported signals and validation workflow. Private Search Console ownership/settings, the final production deployment, social-platform caches and Google's eventual indexed result were not verified in this task.

## Local commands

```sh
# Default local build is deliberately nonindexable.
npm run build

# Explicit production artifact checks (Unix/WSL).
VERCEL_ENV=production npm run build
npm run seo:check -- --production

# Explicit preview artifact checks.
VERCEL_ENV=preview npm run build
npm run seo:check -- --preview

# Regenerate the checked-in sharing PNG after editing its SVG.
# Uses an installed Playwright Chromium or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
npm run seo:image
```

In PowerShell, set `$env:VERCEL_ENV='production'` (or `'preview'`) on its own line before `npm.cmd run build`. No domain, DNS, Search Console token or secret is needed for local SEO builds.


## Refresh transition and About follow-up (24 November 2026)

### Root causes

The original homepage pre-renderer produced a generic, About-style page, while `main.tsx` used `createRoot` to replace it with the explorer. Those were different trees and different page geometries. On refresh, users could see the descriptive page before the explorer replaced it. In development, importing CSS from the JavaScript entry also left the initial HTML dependent on module execution for styling. The larger About copy exposed a separate CSS issue: vertically centering overflowing flex content could position its first lines above the scroll origin. Entering About from the bottom of Feedback could also retain document scroll. Finally, the desktop footer's shared button rule had accidentally included the About anchor.

### Implementation

- `ApplicationRoot.tsx` is shared by build-time rendering and the first browser render. `seo-build.ts` now uses `renderToString`, and `main.tsx` uses `hydrateRoot`, with the same route marker and React identifier prefix. The initial explorer has the real header, sidebar, toolbar, canvas and footer geometry instead of a separate landing page.
- The existing interactive app and analytics load through `InteractiveApplication.tsx` after hydration. While its data loads, `App.tsx` retains the same initial explorer frame. Shared `AppHeader`, `FooterInformation`, introduction and instruction components keep repeated chrome/copy consistent. Existing data, graph algorithms, marking/quantity helpers and storage formats are unchanged.
- `index.html` links `src/global.css` directly, before scripts, and preloads the existing principal Hebrew and Latin fonts. Vite rewrites these to hashed production assets. CSS is available independently of JavaScript in both server modes.
- Initial controls are disabled until their handlers are available; real public links remain usable before JavaScript. Hydrated initial links retain a valid selected-course query during early navigation. The interactive app installs its route listener in a layout effect and immediately reconciles the current URL, closing the handover race in which a click could otherwise occur before the listener was installed.
- Meaningful description, instructions, navigation and independent-project wording remain real HTML visible to visitors before interaction. The description appears in the bounded canvas loading view; About retains the shared full descriptive content. JavaScript-disabled visitors can read the content and follow public links. There is no user-agent detection, crawler-only text or hidden-root startup trick. Responsive footer variants use the same media queries for everyone.
- About content now aligns to the top; flex children and header do not shrink. Its scroll area and document reset to the top on entering the page. The upper navigation remains intact. The footer About anchor is again an underlined text link, excluded from the desktop action-button styling.

### Verification method

`tests/loading-transition.spec.ts` tests both Vite development and production, desktop and mobile, with and without existing saved filters. Each explorer case performs three cache-disabled hard refreshes, including two with 150ms latency, 250kB/s download and 2× CPU slowdown. Scripts are held to inspect the actual styled HTML, then released while course data is held to inspect the hydrated loading view. Tests check first-contentful-paint styling, layout-shift entries, header/canvas/footer geometry, hydration errors and restored personal state. About checks cover 1440, 375 and 320px widths, repeated reloads, and navigation from the bottom of Feedback. Two additional cases hold the interactive module itself, disable storage, and click the initial About navigation to verify course-context preservation before that module mounts.

The prerender-to-loading transition is measured separately from restoration of personal filters: the existing active-filter summary deliberately occupies space above the graph once saved browser settings load. Its expected height and margins are checked, while header/footer and graph bottom remain stable. Ordinary refreshes require the complete canvas geometry to remain stable. This change does not reserve permanent blank space for an unknown saved filter selection.

The earlier SEO verification above remains historical. The following completed full run and focused helper verification supersede its incomplete broad rerun.

Final verification on the frozen application source:

- **Production and preview builds passed**, including TypeScript and all SEO artifact checks. Production output remains indexable; preview output remains nonindexable. Styles and all three preloaded fonts resolve to existing hashed production assets. Native CSS responses were checked on both development and production servers.
- **234/234 unit/data tests passed.** No linter is configured. `git diff --check` passed.
- **The complete 178-case browser suite ran to completion** with one worker and one permitted retry: **175 passed, three failed**. All **16 new transition/About cases passed**. The three failures were desktop marked-credit/repeat-quantity fixtures calling `scrollIntoViewIfNeeded` on the deliberately disabled initial footer before the interactive footer replaced it. Their stack traces identified the shared test helper; production marking, credit and storage assertions did not fail.
- The shared collection test helper now waits for its control to be enabled before scrolling/clicking. **All three affected cases passed three consecutive repetitions: 9/9, without retries.** The application build was unchanged between the full run and these repetitions. This records the full-run result and the subsequent fixture verification separately; it does not present the first full run as 178/178.
- Another catalog metadata fixture now uses the existing Fit control before pointer inspection after filtering, which intentionally preserves the viewport. Its course-list/role assertions remain intact. Normal test timeouts remain 30 seconds/7-second expectations; only deliberately throttled refresh cases have longer, local limits.
- **24 cache-disabled hard-refresh rounds passed; 16 were throttled.** Maximum measured CLS during initial HTML to hydrated loading was **0.001622**. For unfiltered refreshes, maximum header/canvas/footer position or size difference between initial HTML and the ready explorer was **0px**. Saved-filter cases verify the existing summary's height/margins separately and preserve header/footer and canvas bottom. These measurements cover startup geometry; loaded course details and later personal interactions remain dynamic content.
- About title/top visibility passed at **1440, 375 and 320px** in both server modes, including repeated refresh and navigation from the bottom of Feedback. Footer About styling is underlined text with no button background or border. Early About navigation with the interactive module held and storage disabled also passed; those navigation cases had additionally passed three repetitions before the full suite.
- Production first-paint/interactive screenshots on desktop/mobile and the narrow About page were visually reviewed. Browser checks use Chromium viewport, network and CPU emulation rather than a physical phone or Safari.
- Both academic JSON hashes, all graph/filter/storage library files, and the original favicon are unchanged. All application, test and script files in the QA mirror match the workspace. No runtime dependency or persistence schema changed. No remaining known test failures are outstanding after the helper repetitions.

The repeatable full-suite command in WSL is `BRANCHQUEST_DEPLOYMENT_ENV=production npx playwright test --workers=1 --retries=1`. The configuration starts production and development servers automatically; external instances can be provided with `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_DEV_BASE_URL`. The focused follow-up used the marked-credits and repeatable-courses files, desktop case titles, and `--repeat-each=3 --workers=1`.

Follow-up files changed (relative to the already implemented SEO state):

- `PROJECT_STATE.md`
- `README.md`
- `SEO_REPORT.md`
- `index.html`
- `playwright.config.ts`
- `scripts/check-seo.mjs`
- `scripts/seo-build.ts`
- `src/App.tsx`
- `src/ApplicationRoot.tsx`
- `src/InteractiveApplication.tsx`
- `src/components/AppHeader.tsx`
- `src/components/FooterInformation.tsx`
- `src/components/PublicContent.tsx`
- `src/components/SiteFooter.tsx`
- `src/global.css`
- `src/main.tsx`
- `src/styles.css`
- `tests/filters.spec.ts`
- `tests/helpers/mobile-tools.ts`
- `tests/loading-transition.spec.ts`
- `tests/seo.spec.ts`
- `tests/seo.test.ts`

Browser logs, screenshots, the complete JSON reporter output and refresh measurements are temporary QA artifacts under the QA mirror's `.playwright/` directory; they are not added as application assets.
