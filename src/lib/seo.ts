import type {AppRoute} from './navigation';

export const SITE_NAME = 'BranchQuest';
export const SITE_ORIGIN = 'https://branchquest.app';
export const HOME_TITLE = 'BranchQuest – עץ קורסים ותכנון תואר בטכניון';
export const HOME_DESCRIPTION = 'חקרו את עץ הקורסים של הטכניון, בדקו דרישות קדם, גלו אילו קורסים תוכלו לקחת ותכננו את מסלול הלימודים שלכם.';
export const INDEPENDENT_DISCLAIMER = 'BranchQuest is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.';
export const PUBLIC_PAGES = {
  tree: {path: '/', title: HOME_TITLE, description: HOME_DESCRIPTION},
  about: {path: '/about', title: 'אודות BranchQuest – עץ קורסים ותכנון לימודים בטכניון', description: 'הכירו את BranchQuest, פרויקט עצמאי לחקר קורסים בטכניון, דרישות קדם, קטלוגי תארים ותכנון אישי של הלימודים.'},
  feedback: {path: '/feedback', title: 'דיווח ומשוב – BranchQuest', description: 'דווחו על תקלה או מידע שגוי בקורס, הציעו שיפור ושלחו משוב על BranchQuest, מפת הקורסים העצמאית לסטודנטים בטכניון.'},
} as const;
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE_ORIGIN + '/#website',
  name: SITE_NAME, url: SITE_ORIGIN + '/', inLanguage: 'he-IL', description: HOME_DESCRIPTION,
};
export const WEBSITE_JSON_LD = JSON.stringify(WEBSITE_SCHEMA).replace(/</g, '\u003c');
export const SOCIAL_IMAGE = SITE_ORIGIN + '/og-image.png';
export const SOCIAL_IMAGE_ALT = 'BranchQuest – עץ קורסים ותכנון תואר בטכניון';
export const ROBOTS_INDEX = 'index,follow,max-image-preview:large';
export const ROBOTS_NOINDEX = 'noindex,nofollow';

/** Production is explicit; a preview/custom environment can never opt into indexing. */
export function indexableBuild(env: Record<string, string | undefined>): boolean {
  const environment = env.VERCEL_TARGET_ENV ?? env.VERCEL_ENV ?? env.BRANCHQUEST_DEPLOYMENT_ENV;
  return environment === 'production' && (!env.VERCEL_ENV || env.VERCEL_ENV === 'production');
}
export function canonicalURL(route: AppRoute): string {return SITE_ORIGIN + PUBLIC_PAGES[route].path;}
export function robotsValue(indexable: boolean): string {return indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX;}
const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function metadataEntries(route: AppRoute, indexable: boolean) {
  const page = PUBLIC_PAGES[route];
  return [
    {name:'description', content:page.description}, {name:'robots', content:robotsValue(indexable)},
    {property:'og:type', content:'website'}, {property:'og:locale', content:'he_IL'},
    {property:'og:site_name', content:SITE_NAME}, {property:'og:title', content:page.title},
    {property:'og:description', content:page.description}, {property:'og:url', content:canonicalURL(route)},
    {property:'og:image', content:SOCIAL_IMAGE}, {property:'og:image:type', content:'image/png'},
    {property:'og:image:width', content:'1200'}, {property:'og:image:height', content:'630'},
    {property:'og:image:alt', content:SOCIAL_IMAGE_ALT},
    {name:'twitter:card', content:'summary_large_image'}, {name:'twitter:title', content:page.title},
    {name:'twitter:description', content:page.description}, {name:'twitter:image', content:SOCIAL_IMAGE},
    {name:'twitter:image:alt', content:SOCIAL_IMAGE_ALT},
  ];
}
export function renderMetadata(route: AppRoute, indexable: boolean): string {
  return [
    `<title>${escapeHTML(PUBLIC_PAGES[route].title)}</title>`,
    ...metadataEntries(route,indexable).map(entry => `<meta ${'name' in entry ? `name="${entry.name}"` : `property="${entry.property}"`} content="${escapeHTML(entry.content)}" />`),
    `<link rel="canonical" href="${canonicalURL(route)}" />`,
    `<script type="application/ld+json" id="website-jsonld">${WEBSITE_JSON_LD}</script>`,
  ].join('\n    ');
}
export function renderSitemap(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    Object.values(PUBLIC_PAGES).map(page => `  <url><loc>${SITE_ORIGIN}${page.path}</loc></url>`).join('\n') + '\n</urlset>\n';
}
// Crawlers must be able to read preview noindex directives; disallow is not a noindex substitute.
export const ROBOTS_TXT = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

/** SPA navigation uses the same metadata as pre-rendered direct requests. No user queries are exposed. */
export function updatePageMetadata(route: AppRoute, indexable: boolean) {
  document.title = PUBLIC_PAGES[route].title;
  for (const entry of metadataEntries(route,indexable)) {
    const attribute = 'name' in entry ? 'name' : 'property';
    const key = 'name' in entry ? entry.name : entry.property;
    let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!meta) {meta=document.createElement('meta');meta.setAttribute(attribute,key!);document.head.append(meta);}
    meta.content = entry.content;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}
  canonical.href = canonicalURL(route);
}
