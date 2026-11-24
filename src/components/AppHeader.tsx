import {Bug, CircleHelp, GitBranch, GraduationCap} from 'lucide-react';
import CourseSearch from './CourseSearch';
import type {Course} from '../types';
interface Props {
 courses:Course[]; allCourses:Course[]; filtered:boolean; disabled:boolean; searchAll:boolean;
 onSearchAllChange:(value:boolean)=>void; onSelect:(course:Course)=>void;
 addedCourseIds:readonly string[]; onAddedChange:(course:Course,added:boolean)=>void;
 onHelp?:()=>void; onFeedback?:()=>void;
}
/** The same header is used by the initial HTML and the interactive explorer. */
export default function AppHeader(props:Props){
 return <header className="app-header">
  <a className="brand" href="/" aria-label="BranchQuest — לדף הבית"><span className="brand-mark"><GitBranch size={24}/></span><span><strong dir="ltr">BranchQuest<span className="brand-dot">.</span></strong><small>לגלות לאן אפשר להמשיך</small></span></a>
  <div className="desktop-course-search"><CourseSearch courses={props.courses} allCourses={props.allCourses} filtered={props.filtered} disabled={props.disabled} searchAll={props.searchAll} onSearchAllChange={props.onSearchAllChange} onSelect={props.onSelect} addedCourseIds={props.addedCourseIds} onAddedChange={props.onAddedChange}/></div>
  <div className="header-actions"><a className="feedback-trigger" href="/feedback" title="דיווח על תקלה או שליחת משוב" aria-label="דיווח על תקלה או שליחת משוב" onClick={props.onFeedback?event=>{event.preventDefault();props.onFeedback?.();}:undefined}><Bug size={19}/></a><span className="technion-tag"><GraduationCap size={19}/>הטכניון</span><span className="header-divider"/><button className="help-button" disabled={!props.onHelp} onClick={props.onHelp}><CircleHelp size={18}/><span>איך זה עובד?</span></button></div>
 </header>;
}
