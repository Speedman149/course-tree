import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useForm} from '@formspree/react';
import {ArrowRight,Bug,CheckCircle2,LoaderCircle,Send} from 'lucide-react';
import SiteFooter from './SiteFooter';
import {navigateApp} from '../lib/navigation';
import {FEEDBACK_CATEGORIES,FEEDBACK_FORM_ID,feedbackErrorMessage,feedbackFieldError,feedbackPayload,validateFeedback,validCourseNumber,type FeedbackErrors,type FeedbackField,type FeedbackOrigin,type FeedbackValues} from '../lib/feedback';
interface Props {origin:FeedbackOrigin;courseId?:string;treeCourseId?:string}
export default function FeedbackPage({origin,courseId='',treeCourseId}:Props){
 const [state,send,reset]=useForm(FEEDBACK_FORM_ID);
 const [values,setValues]=useState<FeedbackValues>({category:courseId?'course-information':'',description:'',course_number:courseId,email:''});
 const [errors,setErrors]=useState<FeedbackErrors>({});
 const [unexpectedError,setUnexpectedError]=useState(false);
 const [pending,setPending]=useState(false);
 const inFlight=useRef(false);
 const formRef=useRef<HTMLFormElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 const success=useRef<HTMLDivElement>(null);
 const errorSummary=useRef<HTMLDivElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 useEffect(()=>{if(state.succeeded)success.current?.focus();else if(state.errors||unexpectedError)errorSummary.current?.focus();},[state.succeeded,state.errors,unexpectedError]);
 const busy=pending||state.submitting;
 const fieldError=(field:FeedbackField)=>errors[field]||(state.errors?.getFieldErrors(field).length?feedbackFieldError(field):undefined);
 const change=(field:FeedbackField,value:string)=>{setValues(previous=>({...previous,[field]:value}));setErrors(previous=>({...previous,[field]:undefined}));};
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(inFlight.current||busy||state.succeeded)return;
  const invalid=validateFeedback(values);setErrors(invalid);
  if(Object.keys(invalid).length){(formRef.current?.elements.namedItem(Object.keys(invalid)[0]) as HTMLElement|null)?.focus();return;}
  inFlight.current=true;setPending(true);setUnexpectedError(false);
  const honeypot=(formRef.current?.elements.namedItem('_gotcha') as HTMLInputElement|null)?.value??'';
  try{await send(feedbackPayload(values,{origin,pageUrl:window.location.href,userAgent:navigator.userAgent,appVersion:__APP_VERSION__,buildId:__BUILD_ID__,timestamp:new Date().toISOString(),honeypot}));}
  catch{reset();setUnexpectedError(true);}
  finally{inFlight.current=false;setPending(false);}
 };
 const treeHref=treeCourseId&&validCourseNumber(treeCourseId)?`/?course=${encodeURIComponent(treeCourseId)}`:'/';
 const returnToTree=(event:React.MouseEvent<HTMLAnchorElement>)=>{event.preventDefault();navigateApp(treeHref);};
 return <div className="app-shell feedback-shell" dir="rtl">
  <header className="about-header"><a className="about-brand" href={treeHref} onClick={returnToTree} dir="ltr">BranchQuest<span>.</span></a><a className="about-back" href={treeHref} onClick={returnToTree}><ArrowRight size={14}/>חזרה למפת הקורסים</a></header>
  <main className="feedback-main">
   <section className="feedback-card" aria-labelledby="feedback-title">
    <span className="feedback-heading-icon"><Bug size={23}/></span>
    <h1 id="feedback-title" ref={heading} tabIndex={-1}>דיווח על תקלה ושליחת משוב</h1>
    <p className="feedback-intro">נתקלתם בתקלה? יש לכם רעיון לשיפור? נשמח לשמוע!</p>
    {state.succeeded?<div className="feedback-success" role="status" tabIndex={-1} ref={success}><CheckCircle2 size={34}/><p>המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.</p><a className="modal-primary" href={treeHref} onClick={returnToTree}>חזרה למפת הקורסים</a></div>:<form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
     {(state.errors||unexpectedError)&&<div className="feedback-error-summary" role="alert" tabIndex={-1} ref={errorSummary}>{feedbackErrorMessage(state.errors?.getFormErrors()??[])}</div>}
     <fieldset disabled={busy}>
      <div className="feedback-field"><label htmlFor="feedback-category">סוג המשוב <span aria-hidden="true">*</span></label><select id="feedback-category" name="category" required aria-invalid={!!fieldError('category')} aria-describedby={fieldError('category')?'feedback-category-error':undefined} value={values.category} onChange={event=>change('category',event.target.value)}><option value="">בחרו סוג משוב</option>{FEEDBACK_CATEGORIES.map(category=><option value={category.value} key={category.value}>{category.label}</option>)}</select>{fieldError('category')&&<span className="feedback-field-error" id="feedback-category-error">{fieldError('category')}</span>}</div>
      <div className="feedback-field"><label htmlFor="feedback-description">תיאור <span aria-hidden="true">*</span></label><textarea id="feedback-description" name="description" required minLength={10} maxLength={5000} rows={5} placeholder="תארו את התקלה, ההצעה או המידע שדורש תיקון..." value={values.description} aria-invalid={!!fieldError('description')} aria-describedby={`feedback-description-hint${fieldError('description')?' feedback-description-error':''}`} onChange={event=>change('description',event.target.value)}/><small id="feedback-description-hint">10–5,000 תווים <span className="feedback-character-count" dir="ltr">{values.description.length.toLocaleString('he')} / 5,000</span></small>{fieldError('description')&&<span className="feedback-field-error" id="feedback-description-error">{fieldError('description')}</span>}</div>
      <div className="feedback-optional-fields">
       <div className="feedback-field"><label htmlFor="feedback-course">מספר קורס (אם רלוונטי)</label><input id="feedback-course" name="course_number" inputMode="numeric" dir="ltr" maxLength={8} placeholder="02340114" value={values.course_number} aria-invalid={!!fieldError('course_number')} aria-describedby={fieldError('course_number')?'feedback-course-error':undefined} onChange={event=>change('course_number',event.target.value)}/>{fieldError('course_number')&&<span className="feedback-field-error" id="feedback-course-error">{fieldError('course_number')}</span>}</div>
       <div className="feedback-field"><label htmlFor="feedback-email">כתובת אימייל (לא חובה)</label><input id="feedback-email" name="email" type="email" dir="ltr" autoComplete="email" maxLength={254} placeholder="you@example.com" value={values.email} aria-invalid={!!fieldError('email')} aria-describedby={`feedback-email-hint${fieldError('email')?' feedback-email-error':''}`} onChange={event=>change('email',event.target.value)}/><small id="feedback-email-hint">אם תרצו שנוכל לחזור אליכם בנוגע לדיווח.</small>{fieldError('email')&&<span className="feedback-field-error" id="feedback-email-error">{fieldError('email')}</span>}</div>
      </div>
      <div className="feedback-honeypot" aria-hidden="true"><label htmlFor="feedback-website">Website</label><input id="feedback-website" name="_gotcha" type="text" tabIndex={-1} autoComplete="off"/></div>
     </fieldset>
     <p className="feedback-context-note">למשוב מצורפים אוטומטית כתובת העמוד והמסלול, קורס הפתיחה וקורס הדיווח אם זמינים, פרטי הדפדפן, גרסת האתר ומועד השליחה. כתובת העמוד כוללת רק פרטי מסלול ומספרי קורסים; סימונים אישיים, היסטוריית גלישה ומצב המפה המלא אינם נשלחים. המשוב מועבר באמצעות Formspree.</p>
     <div className="feedback-submit-row"><button className="modal-primary feedback-submit" type="submit" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<Send size={16}/>}<span>{busy?'שולחים את המשוב…':'שליחת משוב'}</span></button><small>השדות המסומנים ב־* הם חובה. אפשר לשלוח גם ללא אימייל.</small></div>
    </form>}
   </section>
  </main>
  <SiteFooter treeCourseId={treeCourseId}/>
 </div>;
}