import {Focus, X} from 'lucide-react';
import type {Course} from '../types';
import {courseAppearance,facultyDisplayColor} from '../lib/faculty-colors';
import type {CSSProperties} from 'react';
interface Props {
 courses?:ReadonlyMap<string,Course>; addedCourseIds?:readonly string[];
 onLocate?:(id:string)=>void; onRemove?:(id:string)=>void; loading?:boolean;
}
/** An ordered summary of equal additions; no course is a primary selection. */
export default function AddedCoursesSummary({courses,addedCourseIds=[],onLocate,onRemove,loading=false}:Props){
 return <><div className="sidebar-section-label">קורסים שהוספתי <span className="status-dot"/></div>
 <section className="root-summary added-summary" aria-label="סיכום הקורסים שהוספתי">
  <h2>{loading?'טוענים את הקורסים…':`קורסים שהוספתי (${addedCourseIds.length})`}</h2>
  <p>כל קורס הוא נקודת התחלה שווה בעץ.</p>
  {loading?<div className="skeleton skeleton-root"/>:<div className="added-summary-courses" role="list">{addedCourseIds.map(id=>{const course=courses?.get(id);return <div key={id} role="listitem" data-summary-course={id} className="added-summary-row" style={{'--faculty-accent':facultyDisplayColor(courseAppearance(course).id)} as CSSProperties}>
   <button type="button" aria-label={`הצגת הקורס ${id} במפה`} onClick={()=>onLocate?.(id)}><Focus size={13}/><span><strong>{course?.name??'קורס ללא פרטים במאגר'}</strong><small dir="ltr">{id}</small></span></button>
   <button type="button" aria-label={`הסרת הקורס ${id} מהסיכום`} onClick={()=>onRemove?.(id)}><X size={14}/></button>
  </div>;})}{!addedCourseIds.length&&<span className="added-summary-empty">חפשו קורס והוסיפו אותו לעץ.</span>}</div>}
 </section></>;
}
