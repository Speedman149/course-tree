import type {Course} from '../types';
import {AddedCoursesMenu,MarkedCoursesMenu} from './CourseCollections';
import {navigateApp} from '../lib/navigation';
import {validCourseNumber} from '../lib/feedback';
interface Props {
  treeCourseId?: string;
  markedCount?: number;
  storageAvailable?: boolean;
  onClearMarks?: ()=>void;
  onResetProgress?: ()=>void;
  courses?: ReadonlyMap<string, Course>;
  markedCourseIds?: ReadonlySet<string>;
  addedCourseIds?: readonly string[];
  visibleCourseIds?: ReadonlySet<string>;
  onAddedChange?: (courseId: string, added: boolean) => void;
  onLocateAddedCourse?: (courseId: string) => void;
  onFocusCourse?: (courseId: string) => void;
  onSelectCourse?: (courseId: string) => void;
  onToggleMarked?: (courseId: string) => void;
}
export default function SiteFooter({treeCourseId,markedCount,storageAvailable=true,onClearMarks,onResetProgress,courses,markedCourseIds,addedCourseIds,visibleCourseIds,onAddedChange,onLocateAddedCourse,onFocusCourse,onSelectCourse,onToggleMarked}:Props) {
 const count=markedCourseIds?.size??markedCount??0;
 const courseId=treeCourseId??new URLSearchParams(window.location.search).get('course');
 const aboutHref=courseId&&validCourseNumber(courseId)?`/?course=${encodeURIComponent(courseId)}#/about`:'/#/about';
 return <footer className="site-footer" aria-label="מידע על האתר">
  {onResetProgress && <div className="saved-progress-controls">
   <span className={storageAvailable?'local-save-status':'local-save-status storage-unavailable'} role="status">{storageAvailable?'ההתקדמות נשמרת בדפדפן הזה':'השמירה המקומית אינה זמינה כרגע'}</span>
   <span className="marked-count">קורסים מסומנים: {count}</span>
   <button onClick={onClearMarks} disabled={!count}>ניקוי סימונים</button>
   {courses&&markedCourseIds&&addedCourseIds&&visibleCourseIds&&onAddedChange&&onFocusCourse&&onSelectCourse&&onToggleMarked&&<MarkedCoursesMenu courses={courses} markedCourseIds={markedCourseIds} addedCourseIds={addedCourseIds} visibleCourseIds={visibleCourseIds} onAddedChange={onAddedChange} onFocusCourse={onFocusCourse} onSelectCourse={onSelectCourse} onToggleMarked={onToggleMarked}/>}
   {courses&&addedCourseIds&&onAddedChange&&onLocateAddedCourse&&<AddedCoursesMenu courses={courses} addedCourseIds={addedCourseIds} onAddedChange={onAddedChange} onLocateCourse={onLocateAddedCourse}/>}
   <button onClick={onResetProgress}>איפוס התקדמות שמורה</button>
  </div>}
  <div className="site-footer-main"><p className="site-disclaimer" lang="en" dir="ltr">Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.</p>
   <nav aria-label="קישורי האתר"><a href={aboutHref} onClick={event=>{event.preventDefault();navigateApp(aboutHref);}}>אודות / About</a><span className="developer-credit map-developer-credit" dir="ltr">Developed by Chupchick</span></nav>
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