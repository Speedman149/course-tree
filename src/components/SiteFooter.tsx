interface Props {
  markedCount?: number;
  storageAvailable?: boolean;
  onClearMarks?: ()=>void;
  onResetProgress?: ()=>void;
}
export default function SiteFooter({markedCount,storageAvailable=true,onClearMarks,onResetProgress}:Props) {
 return <footer className="site-footer" aria-label="מידע על האתר">
  {onResetProgress && <div className="saved-progress-controls">
   <span className={storageAvailable?'local-save-status':'local-save-status storage-unavailable'} role="status">{storageAvailable?'ההתקדמות נשמרת בדפדפן הזה':'השמירה המקומית אינה זמינה כרגע'}</span>
   <span className="marked-count">קורסים מסומנים: {markedCount??0}</span>
   <button onClick={onClearMarks} disabled={!markedCount}>ניקוי סימונים</button>
   <button onClick={onResetProgress}>איפוס התקדמות שמורה</button>
  </div>}
  <div className="site-footer-main"><p className="site-disclaimer" lang="en" dir="ltr">Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.</p>
   <nav aria-label="קישורי האתר"><a href="#/about">אודות / About</a><span className="developer-credit map-developer-credit" dir="ltr">Developed by Chupchick</span></nav>
  </div>
 </footer>;
}
export function AboutPage(){
 return <div className="app-shell about-shell" dir="rtl">
  <header className="about-header"><a className="about-brand" href="#/">מפת הקורסים<span>.</span></a><a className="about-back" href="#/">חזרה למפת הקורסים ←</a></header>
  <main className="about-content"><span className="eyebrow">COURSE TREE</span><h1>אודות / About</h1><p lang="en" dir="ltr">idk seems kinda cool ill put something here later</p></main>
  <SiteFooter/>
 </div>;
}