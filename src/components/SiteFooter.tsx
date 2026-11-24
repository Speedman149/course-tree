import {useLayoutEffect, useRef} from 'react';
import type {Course} from '../types';
import type {MarkedCourseQuantities} from '../lib/repeatable-courses';
import {useMobileLayout} from '../lib/use-mobile-layout';
import {AddedCoursesMenu,MarkedCoursesMenu} from './CourseCollections';
import {navigateApp} from '../lib/navigation';
import {validCourseNumber} from '../lib/feedback';
import FooterInformation from './FooterInformation';
import {AboutContent} from './PublicContent';
interface Props {
  treeCourseId?: string;
  markedCount?: number;
  markedCourseQuantities?: MarkedCourseQuantities;
  onQuantityChange?: (id: string, quantity: number) => void;
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
  onToggleMarked?: (courseId: string) => boolean | void;
}
export default function SiteFooter({treeCourseId,markedCount,storageAvailable=true,onClearMarks,onResetProgress,courses,markedCourseIds,addedCourseIds,visibleCourseIds,onAddedChange,onLocateAddedCourse,onFocusCourse,onSelectCourse,onToggleMarked,markedCourseQuantities,onQuantityChange}:Props) {
 const mobile=useMobileLayout();
 const count=markedCourseIds?.size??markedCount??0;
 const courseId=treeCourseId??new URLSearchParams(window.location.search).get('course');
 const aboutHref=courseId&&validCourseNumber(courseId)?`/about?course=${encodeURIComponent(courseId)}`:'/about';
 return <footer className="site-footer" aria-label="מידע על האתר">
  {!mobile && onResetProgress && <div className="saved-progress-controls">
   <span className={storageAvailable?'local-save-status':'local-save-status storage-unavailable'} role="status">{storageAvailable?'ההתקדמות נשמרת בדפדפן הזה':'השמירה המקומית אינה זמינה כרגע'}</span>
   <span className="marked-count">קורסים מסומנים: {count}</span>
   <button className="footer-destructive" onClick={onClearMarks} disabled={!count}>ניקוי סימונים</button>
   {courses&&markedCourseIds&&addedCourseIds&&visibleCourseIds&&onAddedChange&&onFocusCourse&&onSelectCourse&&onToggleMarked&&<MarkedCoursesMenu markedCourseQuantities={markedCourseQuantities} onQuantityChange={onQuantityChange} courses={courses} markedCourseIds={markedCourseIds} addedCourseIds={addedCourseIds} visibleCourseIds={visibleCourseIds} onAddedChange={onAddedChange} onFocusCourse={onFocusCourse} onSelectCourse={onSelectCourse} onToggleMarked={onToggleMarked}/>}
   {courses&&addedCourseIds&&onAddedChange&&onLocateAddedCourse&&<AddedCoursesMenu courses={courses} addedCourseIds={addedCourseIds} onAddedChange={onAddedChange} onLocateCourse={onLocateAddedCourse}/>}
   <button className="footer-destructive" onClick={onResetProgress}>איפוס התקדמות שמורה</button>
  </div>}
  {mobile && !storageAvailable && <p className="mobile-storage-warning" role="status">השמירה המקומית אינה זמינה כרגע</p>}
  <FooterInformation aboutHref={aboutHref} navigate mobile={mobile}/>
 </footer>;
}
export function AboutPage({treeCourseId}: {treeCourseId?: string}){
 const content=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{content.current?.scrollTo(0,0);window.scrollTo(0,0);},[]);
 const courseId=treeCourseId??new URLSearchParams(window.location.search).get('course');
 const treeHref=courseId&&validCourseNumber(courseId)?`/?course=${encodeURIComponent(courseId)}`:'/';
 return <div className="app-shell about-shell" dir="rtl">
  <header className="about-header"><a className="about-brand" href={treeHref} onClick={event=>{event.preventDefault();navigateApp(treeHref);}} dir="ltr">BranchQuest<span>.</span></a><a className="about-back" href={treeHref} onClick={event=>{event.preventDefault();navigateApp(treeHref);}}>חזרה למפת הקורסים ←</a></header>
  <main ref={content} className="about-content"><AboutContent/></main>
  <SiteFooter treeCourseId={courseId??undefined}/>
 </div>;
}
