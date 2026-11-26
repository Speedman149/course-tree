export interface TutorialAnnotation {id:string;label:string;description:string;side?:'left'|'right'}
export const tutorialSteps=[
 {id:'card',title:'הכירו את כרטיס הקורס',subtitle:'כל מה שצריך לדעת, בכרטיס אחד.',takeaway:'בחרו פרט בכרטיס או באחד הסימונים כדי לראות למה הוא משמש.',notes:[
  {id:'name',label:'שם הקורס',description:'השם כפי שהוא מופיע במאגר.',side:'right'},
  {id:'number',label:'מספר הקורס',description:'קישור למידע הרשמי בטכניון.',side:'left'},
  {id:'faculty',label:'צבע הפקולטה',description:'המסגרת והנקודה מציינות את הפקולטה.',side:'right'},
  {id:'credits',label:'נקודות זכות',description:'ערך הנק״ז של הקורס במאגר.',side:'left'},
  {id:'mark',label:'סימון אישי',description:'לחיצה מדגישה באדום; לחיצה נוספת מבטלת.',side:'left'},
  {id:'expand',label:'קורסי המשך',description:'כפתור + פותח; כפתור − סוגר את הענפים.',side:'left'},
  {id:'info',label:'מידע וקדמים',description:'פותח את ״מה צריך לפני?״.',side:'right'}]},
 {id:'branches',title:'פתחו רק את הענפים שמעניינים אתכם',subtitle:'נסו לסגור חיבור אחד. הדרך השנייה נשארת פתוחה.',takeaway:'קורס משותף נשאר כל עוד מגיעים אליו בחיבור פתוח אחר.',notes:[
  {id:'expand',label:'+/− בכרטיס',description:'פתיחה או סגירה של כל הענפים שיוצאים ממנו.'},
  {id:'connection',label:'− על החץ',description:'מסתיר רק את החיבור הזה ואת מה שכבר לא נגיש דרכו.'},
  {id:'restore',label:'הצגת ענפים',description:'מחזירים ענף יחיד, גם אחרי פתיחה חלקית.'},
  {id:'navigation',label:'ניווט במפה',description:'גררו להזזה; + ו־− משנים קנה מידה; הסמל שלידם מתאים למסך.'}]},
 {id:'prerequisites',title:'מה צריך ללמוד לפני?',subtitle:'הכלל המלא נמצא בחלונית הקדמים, לא בחץ בודד.',takeaway:'אפשר לחקור קדמים גם אם הם מחוץ למסננים. מקצוע צמוד מסומן בנפרד ועשוי להילמד במקביל.',notes:[
  {id:'panel',label:'חלונית הקדמים',description:'כאן מופיעים הכלל המלא וקורסי הקדם.'},
  {id:'prerequisite',label:'+ ירוק בחלונית',description:'פותח את קורס הקדם במפה, בכיוון אחורה.'},
  {id:'backward',label:'תג קדם',description:'מסמן חקירה אחורה; לחיצה עליו סוגרת אותה.'},
  {id:'logic',label:'וגם / או',description:'וגם: כל התנאים בקבוצה. או: חלופה מותרת אחת מספיקה.'}]},
 {id:'added',title:'כמה קורסים, מפה אחת',subtitle:'חפשו קורס ובחרו תוצאה כדי להוסיף אותו.',takeaway:'כל הקורסים שהוספתם שווים. אפשר להסיר כל אחד, או את כולם; מפה ריקה נשמרת.',notes:[
  {id:'search',label:'חיפוש',description:'לפי שם או מספר. קורס שכבר נוסף ימוקד בלי כפילות.'},
  {id:'collection',label:'קורסים שהוספתי',description:'כאן ממקדים, מסירים או בוחרים ״הסרת כל הקורסים״.'},
  {id:'shared',label:'מסלולים מתחברים',description:'כשאפשר נפתח חיבור אמיתי קצר; אותו קורס מופיע פעם אחת.'},
  {id:'separate',label:'גם בלי חיבור',description:'קורס לא קשור מופיע בנפרד באותה מפה.'}]},
 {id:'toolbar',title:'הכלים שמעל המפה',subtitle:'התנסו בכלים כאן — המפה שלכם לא תשתנה.',takeaway:'ההדגשה בודקת קדמים רגילים לפי הסימונים בלבד. היא אינה אישור רישום.',notes:[
  {id:'layer',label:'עוד שכבה',description:'מרחיב את קורסי ההמשך של הקורסים המוצגים.'},
  {id:'reset',label:'איפוס ענפים',description:'מאפס פתיחה והסתרה; הקורסים שהוספתם, הסימונים והמסננים נשארים.'},
  {id:'highlight',label:'הדגשת קורסים',description:'מסגרת ירוקה לקורס לא מסומן שהקדמים הרגילים שלו מולאו לפי הסימונים.'},
  {id:'filters',label:'מסננים',description:'בחירת הפקולטות והקטלוג שממקדים את התצוגה.'}]},
 {id:'filters',title:'ממקדים את התמונה',subtitle:'בחרו פקולטות, קטלוג תואר או שילוב של שניהם.',takeaway:'הסינון משפיע על קורסי ההמשך והחיפוש. קדמים עדיין ניתנים לחקירה; קורסים שהוספתם נשארים.',notes:[
  {id:'faculty-tab',label:'סינון לפי פקולטה',description:'בחרו מאילו פקולטות להציג קורסי המשך.'},
  {id:'catalog-tab',label:'קטלוג תואר',description:'בחרו שנת קטלוג ומסלול לימודים.'},
  {id:'groups',label:'קבוצות בתכנית',description:'רשימות חובה, בחירה והתמחויות — כשקיימות בייבוא.'}]},
 {id:'marks',title:'הסימונים שלכם, בקצב שלכם',subtitle:'סימון אדום הוא כלי אישי לזכירה ולתכנון.',takeaway:'הסימון אינו אישור שעברתם קורס, וסכום הנק״ז אינו בדיקת השלמת תואר.',notes:[
  {id:'mark',label:'סימון אדום',description:'מסמנים בכרטיס, ומבטלים בלחיצה נוספת.'},
  {id:'marked-list',label:'רשימת מסומנים',description:'כל הסימונים כאן, גם כשהקורס מוסתר מהמפה.'},
  {id:'add-marked',label:'הוספה מהרשימה',description:'מוסיפים קורס מסומן למפה בלי לשנות את הסימון.'},
  {id:'total',label:'סכום נק״ז',description:'סכום הערכים הידועים; נתון חסר מצוין בנפרד.'},
  {id:'quantity',label:'כמות בקורסי ספורט',description:'בקורסים הנתמכים אפשר להגדיל ולהקטין את מספר הפעמים.'},
  {id:'clear',label:'ניקוי ואיפוס',description:'ניקוי סימונים מסיר רק אדום. איפוס התקדמות שמורה מחזיר את כל המצב להתחלה.'}]}
] satisfies {id:string;title:string;subtitle:string;takeaway:string;notes:TutorialAnnotation[]}[];
