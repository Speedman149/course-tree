export const FEEDBACK_FORM_ID='xrpqqyge';
export const FEEDBACK_ENDPOINT=`https://formspree.io/f/${FEEDBACK_FORM_ID}`;
export const FEEDBACK_CATEGORIES=[
  {value:'bug',label:'דיווח על תקלה'},
  {value:'improvement',label:'הצעה לשיפור'},
  {value:'general',label:'משוב כללי'},
  {value:'course-information',label:'דיווח על מידע שגוי בקורס'},
] as const;
export interface FeedbackValues {category:string;description:string;course_number:string;email:string}
export type FeedbackField=keyof FeedbackValues;
export type FeedbackErrors=Partial<Record<FeedbackField,string>>;
export interface FeedbackOrigin {pageUrl:string;route:string;startingCourseId?:string;relevantCourseId?:string}
export const validCourseNumber=(value:string)=>/^\d{5,8}$/.test(value);
export function validateFeedback(values:FeedbackValues):FeedbackErrors {
  const errors:FeedbackErrors={};
  if(!FEEDBACK_CATEGORIES.some(c=>c.value===values.category))errors.category='יש לבחור סוג משוב.';
  const description=values.description.trim();
  if(description.length<10)errors.description='יש לכתוב תיאור של לפחות 10 תווים.';
  else if(description.length>5000)errors.description='התיאור יכול להכיל עד 5,000 תווים.';
  if(values.course_number.trim()&&!validCourseNumber(values.course_number.trim()))errors.course_number='מספר קורס צריך להכיל 5–8 ספרות בלבד.';
  if(values.email.trim()&&(values.email.trim().length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())||values.email.trim().split('@').length!==2))errors.email='יש להזין כתובת אימייל תקינה, או להשאיר את השדה ריק.';
  return errors;
}
/** Whitelist app routes and course IDs; never attach arbitrary URL parameters. */
export function feedbackPageURL(input:string):string {
  try {
    if(input.length>8192)return '';
    const url=new URL(input);if(!['https:','http:'].includes(url.protocol))return '';
    const path=url.pathname.replace(/\/$/,'')==='/feedback'?'/feedback':'/';
    const clean=new URL(path,url.origin);
    for(const key of ['course','courseId']){const id=url.searchParams.get(key);if(id&&validCourseNumber(id))clean.searchParams.set(key,id);}
    if(path==='/'&&['#/about','#/feedback'].includes(url.hash))clean.hash=url.hash;
    return clean.toString();
  }catch{return '';}
}
/** Keep report context tied to its browser history entry, including Back/Forward. */
export function feedbackHistoryOrigin(state:unknown):FeedbackOrigin|null {
  const origin=(state as {feedbackOrigin?:Partial<FeedbackOrigin>}|null)?.feedbackOrigin;
  if(!origin||typeof origin.pageUrl!=='string'||!['tree','about','feedback'].includes(origin.route??''))return null;
  return {pageUrl:feedbackPageURL(origin.pageUrl),route:origin.route!,
    ...(typeof origin.startingCourseId==='string'&&validCourseNumber(origin.startingCourseId)?{startingCourseId:origin.startingCourseId}:{}),
    ...(typeof origin.relevantCourseId==='string'&&validCourseNumber(origin.relevantCourseId)?{relevantCourseId:origin.relevantCourseId}:{}),
  };
}
export function feedbackPayload(values:FeedbackValues,context:{origin:FeedbackOrigin;pageUrl:string;userAgent:string;appVersion?:string;buildId?:string;timestamp:string;honeypot:string}):Record<string,string> {
  const category=FEEDBACK_CATEGORIES.find(c=>c.value===values.category);
  return {
    category:values.category,category_label:category?.label??'',description:values.description.trim(),
    ...(values.course_number.trim()?{course_number:values.course_number.trim()}:{}),
    ...(values.email.trim()?{email:values.email.trim()}:{}),
    page_url:feedbackPageURL(context.pageUrl),source_page_url:feedbackPageURL(context.origin.pageUrl),source_route:context.origin.route,
    submitted_at:context.timestamp,user_agent:context.userAgent.slice(0,500),
    ...(context.origin.startingCourseId&&validCourseNumber(context.origin.startingCourseId)?{starting_course_id:context.origin.startingCourseId}:{}),
    ...(context.origin.relevantCourseId&&validCourseNumber(context.origin.relevantCourseId)?{relevant_course_id:context.origin.relevantCourseId}:{}),
    ...(context.appVersion?{app_version:context.appVersion}:{}),...(context.buildId?{build_id:context.buildId}:{}),
    _subject:`Course Tree — ${category?.label??'משוב'}`,_gotcha:context.honeypot,
  };
}
export function feedbackErrorMessage(errors:readonly {code:string;message:string}[]):string {
  if(errors.some(e=>/limit|too many|quota|rate/i.test(e.message)))return 'כרגע לא ניתן לשלוח משובים נוספים. נסו שוב בעוד כמה דקות. התיאור שהזנתם נשמר בטופס.';
  if(errors.some(e=>['INACTIVE','FORM_NOT_FOUND','PROJECT_NOT_FOUND','BLOCKED'].includes(e.code)))return 'שליחת המשוב אינה זמינה כרגע. נסו שוב מאוחר יותר. התיאור שהזנתם נשמר בטופס.';
  return 'לא הצלחנו לשלוח את המשוב. בדקו את החיבור או את השדות המסומנים ונסו שוב. התיאור שהזנתם נשמר בטופס.';
}
export function feedbackFieldError(field:FeedbackField):string {
  return field==='email'?'הכתובת לא התקבלה. בדקו את כתובת האימייל או השאירו אותה ריקה.':field==='description'?'התיאור לא התקבל. בדקו את התוכן ונסו שוב.':field==='category'?'בחרו סוג משוב תקין ונסו שוב.':'בדקו את מספר הקורס ונסו שוב.';
}