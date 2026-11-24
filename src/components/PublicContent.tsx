import type {MouseEvent} from 'react';
import {navigateApp} from '../lib/navigation';
import {validCourseNumber} from '../lib/feedback';
import {HOME_DESCRIPTION} from '../lib/seo';
import {ArrowLeft, ArrowRight, BookOpen, Bug, Check, ChevronLeft, Database, ExternalLink, GitBranch, Layers, ListPlus, LoaderCircle, Menu, RotateCcw, Search, ShieldCheck, SlidersHorizontal} from 'lucide-react';
import AppHeader from './AppHeader';
import FooterInformation from './FooterInformation';
import PrerequisiteHighlightToggle from './PrerequisiteHighlightToggle';
import type {AppRoute} from '../lib/navigation';

/** Shared visible copy for pre-rendering and the existing public About screen. */
export function AboutContent() {
  return <><span className="eyebrow">BRANCHQUEST</span><h1>אודות / About</h1>
    <p>BranchQuest הוא עץ קורסים לסטודנטים בטכניון. אפשר לחקור דרישות קדם וקורסי המשך, להציג מסלולים לפי פקולטה או קטלוג תואר, ולארגן רשימת קורסים מסומנים לתכנון אישי.</p>
    <h2>דרישות קדם ומפת קורסים בטכניון</h2><p>המפה מציגה קשרים בין קורסים ומאפשרת לפתוח ולסגור ענפים. חלונית הקורס מציגה את דרישות הקדם במאגר, לרבות חלופות ומקצועות צמודים.</p>
    <h2>קטלוג קורסים ותכנון תואר בטכניון</h2><p>מסנני הפקולטות וקטלוגי התארים עוזרים לחקור מקצועות ומסלולים אקדמיים. סימונים ורשימות אישיות נשמרים בדפדפן שלכם. נתוני הקטלוג חלקיים בחלק מהמסלולים, והסכומים והסימונים אינם אישור לזכאות אקדמית.</p>
    <p lang="en" dir="ltr">BranchQuest is an independent Technion course tree and course planner. Explore Technion prerequisites and degree catalogs, and organize a personal marked-course list. This degree planner does not certify graduation eligibility.</p>
    <p>האתר הוא פרויקט סטודנטיאלי עצמאי, אינו מסונף לטכניון ואינו מאושר על ידיו. לפני רישום לקורסים או בדיקת דרישות תואר, יש לבדוק את המקורות הרשמיים והתקנון החל עליכם.</p>
  </>;
}
const noop=()=>{};
/** Keep a selected course when a public link is used before the interactive app mounts. */
function preserveInitialCourse(event:MouseEvent<HTMLDivElement>){
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;
 const link=event.target.closest<HTMLAnchorElement>('a[href]');
 if(!link||link.target||link.hasAttribute('download'))return;
 const target=new URL(link.href),course=new URLSearchParams(window.location.search).get('course');
 if(target.origin!==window.location.origin||!['/','/about','/feedback'].includes(target.pathname)||target.searchParams.has('course')||!course||!validCourseNumber(course))return;
 event.preventDefault();target.searchParams.set('course',course);navigateApp(target.pathname+target.search+target.hash);
}

export function ExplorerIntro(){
 return <div className="sidebar-intro"><span className="eyebrow"><span/>מגלים את התמונה הגדולה</span><h1>עץ הקורסים.<br/>המסלול שלכם.</h1><p>חקרו קורסים בטכניון, דרישות קדם וקורסי המשך. סננו לפי פקולטה או קטלוג תואר ותכננו את הדרך קדימה.</p></div>;
}
export function ExplorerInstructions(){
 return <div className="explore-instructions"><div className="sidebar-section-label">מכאן ממשיכים לחקור</div><div className="instruction"><span className="instruction-icon purple"><ArrowLeft size={17}/></span><div><strong>מסתכלים קדימה</strong><p>לחצו + בקורס כדי לגלות את קורסי ההמשך שלו.</p></div></div><div className="instruction"><span className="instruction-icon green"><ArrowRight size={17}/></span><div><strong>חוזרים צעד אחורה</strong><p>עברו עם העכבר על קורס כדי לחקור את הקדמים שלו.</p></div></div></div>;
}
export function ExplorerLoadingContent(){
 return <div className="loading-state initial-explorer-content"><LoaderCircle size={30} className="spin"/><h2>מחברים את הנקודות…</h2><p>טוענים את מפת קורסי הטכניון</p><p className="initial-explorer-description">{HOME_DESCRIPTION}</p><div className="initial-loading-links"><a href="/about">אודות BranchQuest</a><a href="/feedback">שליחת משוב</a></div><noscript>יש להפעיל JavaScript כדי לחפש קורסים ולהשתמש במפה האינטראקטיבית.</noscript></div>;
}
function InitialFooter({progress=false}:{progress?:boolean}){
 return <footer className="site-footer" aria-label="מידע על האתר">
  {progress&&<div className="saved-progress-controls initial-progress-controls"><span className="local-save-status" role="status">ההתקדמות נשמרת בדפדפן הזה</span><span className="marked-count">קורסים מסומנים: 0</span><button className="footer-destructive" disabled>ניקוי סימונים</button><span className="collection-control"><button type="button" className="marked-courses-trigger" disabled><Check size={12}/><span>רשימת מסומנים</span></button></span><span className="collection-control"><button type="button" className="added-courses-trigger" disabled><ListPlus size={13}/><span>קורסים שהוספתי (0)</span></button></span><button className="footer-destructive" disabled>איפוס התקדמות שמורה</button></div>}
  <FooterInformation/>
 </footer>;
}
/** Route-specific first paint in the real application layout, shared with the loading application. */
export function StaticPublicPage({route,onHelp}:{route:AppRoute|'not-found';onHelp?:()=>void}){
 if(route==='tree')return <div className="app-shell initial-explorer-shell" dir="rtl" onClickCapture={preserveInitialCourse}>
  <AppHeader courses={[]} allCourses={[]} filtered={false} disabled searchAll={false} onSearchAllChange={noop} onSelect={noop} addedCourseIds={[]} onAddedChange={noop} onHelp={onHelp}/>
  <main className="workspace">
   <aside className="sidebar"><ExplorerIntro/><div className="sidebar-section-label">הקורס הנבחר <span className="status-dot"/></div><div className="root-summary"><span className="root-summary-icon"><BookOpen size={21}/></span><div className="skeleton skeleton-root"/><div className="root-summary-stats"><div><strong>0</strong><span>קורסי המשך</span></div><div><strong>0</strong><span>קדמים ישירים</span></div></div></div><ExplorerInstructions/><div className="sidebar-bottom"><div className="data-status"><span/><span>טוענים את מאגר הקורסים…</span></div><button disabled={!onHelp} onClick={onHelp}><Database size={14}/>על המאגר ומקורות המידע<ChevronLeft size={13}/></button><small>כל הפקולטות. מעבר לסמסטר אחד.</small></div></aside>
   <section className="map-workspace" aria-label="מפת קשרי הקורסים"><div className="map-toolbar"><div className="map-heading"><span className="map-heading-icon"><GitBranch size={18}/></span><div><h2>מפת הקשרים</h2><p>כל חיבור הוא צעד חדש לגלות</p></div><span className="visible-count">0 קורסים במפה</span></div><div className="map-actions"><button className="filters-trigger" aria-label="פתיחת מסנני המפה" disabled><SlidersHorizontal size={15}/><span>מסננים</span></button><button className="mobile-tools-trigger initial-mobile-tools" aria-label="כלים" disabled><Menu size={19}/></button><span className="initial-desktop-action"><PrerequisiteHighlightToggle enabled={false} onChange={noop} disabled/></span><button className="initial-desktop-action" disabled title="איפוס ענפי העץ"><RotateCcw size={15}/><span>איפוס ענפים</span></button><button className="layers-button initial-desktop-action" disabled><Layers size={15}/><span>עוד שכבה</span></button></div></div>
    <div className="graph-canvas"><button className="mobile-search-toggle initial-mobile-search" type="button" aria-label="חיפוש קורסים" disabled><Search size={20}/></button><ExplorerLoadingContent/></div>
    <div className="map-footnote"><ShieldCheck size={15}/><p>קשר במפה מציין דרישה לקורס. ייתכנו דרישות נוספות או חלופיות — בדקו את כלל הקדמים המלא בחלונית הקורס.</p><button disabled={!onHelp} onClick={onHelp}>פרטי המאגר<ExternalLink size={12}/></button></div>
   </section>
  </main><InitialFooter progress/>
 </div>;
 const feedback=route==='feedback';
 return <div className={`app-shell ${feedback?'feedback-shell':'about-shell'}`} dir="rtl" onClickCapture={preserveInitialCourse}>
  <header className="about-header"><a className="about-brand" href="/" dir="ltr">BranchQuest<span>.</span></a><a className="about-back" href="/">חזרה למפת הקורסים ←</a></header>
  {route==='about'?<main className="about-content"><AboutContent/></main>:feedback?<main className="feedback-main"><section className="feedback-card initial-feedback-card"><span className="feedback-heading-icon"><Bug size={23}/></span><h1>דיווח על תקלה ושליחת משוב</h1><p className="feedback-intro">נתקלתם בתקלה? יש לכם רעיון לשיפור? נשמח לשמוע!</p><p className="initial-feedback-description">דווחו על תקלה, הציעו שיפור או ספרו לנו על מידע שגוי בקורס ב־BranchQuest. אפשר לשלוח משוב ללא כתובת אימייל; ציינו מספר קורס כשהוא רלוונטי.</p><p role="status">טוענים את טופס המשוב…</p><noscript>יש להפעיל JavaScript כדי להשתמש בטופס המשוב.</noscript><p><a href="/about">אודות BranchQuest</a></p></section></main>:<main className="about-content"><h1>העמוד לא נמצא</h1><p>הכתובת הזו אינה עמוד באתר BranchQuest.</p><a className="about-back" href="/">חזרה למפת הקורסים</a></main>}
  <InitialFooter/>
 </div>;
}
