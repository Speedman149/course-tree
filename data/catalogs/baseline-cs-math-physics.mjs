/** Reviewed against the supplied complete 2025–2026 catalog, SHA-256 pinned in sources.json.
 * Regions use layout-sorted PDF columns, inclusive one-based lines. Never infer a
 * combined curriculum by unioning independent degrees. All open approval rules remain explicit.
 */
const sourceId = '2025-2026-full';
const refs = (pages, section) => [{ sourceId, pages, printedPages: pages, section }];
const group = (id, name, regions, options = {}) => ({ id, name, regions, ...options });
const course = courseId => ({ type: 'course', courseId });
const any = (...ids) => ({ type: 'any', items: ids.map(course) });
const all = (...ids) => ({ type: 'all', items: ids.map(course) });
const condition = text => ({ type: 'condition', text });
const facultyRule = id => ({ id: `${id}-explicit-faculty-rule`, kind: 'faculty', facultyIds: [id], automatic: true, description: 'כלל מפורש בקטלוג: מקצועות הפקולטה, בכפוף לשנת הקטלוג, חפיפות, קדמים ותנאי ההכרה.' });
const open = (id, creditsMin = 10) => group(`${id}-open`, 'בחירה כלל־טכניונית, העשרה וחינוך גופני', [], { creditsMin, rules: [{ id: `${id}-free-choice`, kind: 'all-courses', automatic: false, description: 'בחירה חופשית לפי הרשימות התקפות וכללי הרישום; אין כאן רשימת קורסים סגורה או אישור אוטומטי לכל מקצוע.' }], sourceRefs: refs([248], 'כללי בחירה כלל־טכניונית') });
const csChoice = [
 group('cs-digital-choice', 'מערכות ספרתיות ומבנה המחשב — חלופות מספר', ['248L:55:56'], { role: 'mandatory-choice', minimumCourses: 1, conditions: ['00440252 או 02340252; אין ללמוד את שניהם לצורך אותה חובה.'] }),
 group('cs-algebra-choice', 'אלגברה מודרנית והקורס המתמטי הנוסף — חלופה מתואמת', ['248L:53:53','248L:61:62'], { role: 'mandatory-choice', conditions: ['אלגברה מודרנית ח׳ יחד עם קורס מתמטי נוסף, או מבוא לחבורות וגם מבוא לחוגים ושדות. מד״ר ת׳ נחשב מתמטי נוסף רק בצירוף אחד המקצועות המנויים בהערה בעמוד 249.'] }),
 group('cs-science', 'מקצועות מדעיים — כל ארבע השרשראות', ['249R:39:50','249L:4:5'], { role: 'mandatory-choice', creditsMin: 8, conditions: ['לפחות 8 נקודות והשלמת שרשרת פיזיקה, ביולוגיה, כימיה או פיזיקה–כימיה. עודף עשוי להיחשב ברשימה ב׳.'] }),
];
csChoice.push(group('cs-math-extra', 'הקורס המתמטי הנוסף — שבע האפשרויות', ['249R:13:19'], { role:'mandatory-choice', minimumCourses:1, conditions:['דרישה מתואמת עם חלופת האלגברה. מד״ר ת׳ מוכר רק עם אחד המקצועות שבהערה בעמוד 249.'] }));
const csA = group('cs-list-a', 'רשימה א׳ — כל המקצועות המפורשים של מדעי המחשב', ['251R:19:67','251L','252R:3:70','252L'], { offeringFacultyId: 'cs', rules: [facultyRule('cs')], conditions: ['אין כפל זיכוי על חובה, פרויקט או מקצוע חופף; חלות הגבלות הפרויקטים והסמינרים. מספרים חריגים במקור נשמרו כמות שהם.'] });
const csB = group('cs-list-b', 'רשימה ב׳ — כל המקצועות החוץ־פקולטיים', ['253R:3:68','253L:3:5','249R:13:19'], { conditions: ['רשימה ב׳ כוללת גם את הקורס המתמטי הנוסף. קורסים נוספים שאינם מפורטים דורשים אישור יועץ.'], rules: [{ id: 'cs-advisor-approval', kind: 'approval', automatic: false, description: 'מקצועות נוספים רק באישור היועץ; אינם מתווספים למסנן ללא אסמכתה.' }] });
const csSpecial = [
 ['complexity','סיבוכיות של חישובים',['249L:20:35'],['02360313']],
 ['algorithms','תורת האלגוריתמים',['249L:39:50'],[]],
 ['logic','לוגיקה ויישומיה',['249L:53:59'],[]],
 ['crypto','קריפטולוגיה, צפינה ואינפורמציה',['249L:62:70'],[]],
 ['software','פיתוח מערכות תוכנה',['250R:6:25'],['02360319']],
 ['distributed','תקשורת ומערכות מבוזרות',['250R:29:44'],[]],
 ['systems','מערכות מיחשוב',['250R:48:70'],['02360363']],
 ['vision','ראייה ורובוטיקה',['250L:2:22'],['02360201']],
 ['graphics','גאומטריה וגרפיקה',['250L:26:36'],['02360216']],
 ['learning','למידה ובינה מלאכותית',['250L:40:66'],['02360501']],
 ['bio','ביואינפורמטיקה',['251R:2:11'],['02360522','00940423']],
].map(([id,name,regions,requiredCourseIds]) => group(`cs-special-${id}`, `קבוצת התמחות — ${name}`, regions, { role: 'specialization', minimumCourses: 3, requiredCourseIds, conditions: ['קבוצה מתוך 11 קבוצות בחירה, אינה תואר עצמאי. שלושה מקצועות שונים ובכללם הליבה המחייבת; תנאי חלופות מפורטים במקור.'] }));
const scienceRule = { type: 'choose', id: 'cs-scientific-chain', minimumCredits: 8, items: [
 { type: 'any', items: [course('01140075'), all('01140052','01140054')] },
 all('01340058','01340020'), { type: 'all', items: [course('01240120'), any('01250801','01240510')] }, all('01240120','01140052'),
], label: 'לפחות שמונה נקודות והשלמת אחת מארבע השרשראות; המסנן מציג את כל האפשרויות ולא מחשב זכאות.' };
const algebraRule = { type: 'any', label: 'חלופת האלגברה', items: [{ type: 'all', items: [course('01040134'), { type: 'group', groupId: 'cs-math-extra' }] }, all('01040158','01040279')] };
const csBase = { sourceId, facultyIds: ['cs'], degreeType: 'B.Sc.', programCategory: 'standard', partial: true, mandatoryComplete: true, electivesComplete: false, notes: ['רשימות מפורשות הופרדו מחלופות ומתנאי השלמת תואר. בחירה חופשית ואישור פרטני אינם זכאות סגורה.'] };
const common = ['248L:24:29','248L:39:43','248L:52:57','249R:4:6'];
const excluded = ['00440252','02340252','01040134'];
export const programs = [
 { ...csBase, programId: 'cs-three-year', officialName: 'מדעי המחשב — מסלול כללי תלת־שנתי', durationYears: 3, mandatory: [...common,'255R:17:18'], mandatoryExclude: excluded, groups: [...csChoice,csA,csB,open('cs3')], sourceRefs: refs([248,249,251,252,253,255], 'המסלול הכללי התלת־שנתי'), requirementRules: [scienceRule,algebraRule,condition('118.5 נקודות; 24.5 בחירה פקולטית, לפחות 18 מרשימה א׳ ופרויקט אחד לפחות.')] },
 { ...csBase, programId: 'cs-four-year', officialName: 'מדעי המחשב — מסלול כללי ארבע־שנתי', durationYears: 4, mandatory: [...common,'249R:28:30'], mandatoryExclude: excluded, groups: [...csChoice,csA,csB,...csSpecial,open('cs4',12)], sourceRefs: refs([248,249,250,251,252,253], 'המסלול הכללי הארבע־שנתי'), requirementRules: [scienceRule,algebraRule,{ type:'choose', minimumCourses:3, minimumCredits:26, items:csSpecial.map(g=>({type:'group',groupId:g.id})), label:'שלוש קבוצות התמחות שונות, שלושה מקצועות בכל קבוצה, תשעה מקצועות שונים ולפחות 26 נקודות.' }, condition('155 נקודות; 56 בחירה פקולטית. בנוסף לקבוצות: 15 מרשימה א׳ ו־15 מרשימות א׳/ב׳; שני פרויקטים או פרויקט וסמינר.')] },
 { ...csBase, programId: 'cs-cybersecurity', parentProgramId:'cs-four-year', programCategory:'concentration', officialName:'מדעי המחשב — מגמת סייבר ואבטחת מערכות ממוחשבות', durationYears:4, mandatory:['254R:21:26','254R:34:39','254R:48:54','254R:64:66','254L:8:18'], mandatoryExclude:excluded, groups:[...csChoice,csA,csB,...csSpecial,group('cyber-core','ליבת סייבר — שבע האפשרויות',['254L:39:45'],{role:'mandatory-choice',minimumCourses:3,creditsMin:8}),group('cyber-project','פרויקט ייעודי באבטחת מידע או בחומות אש',['254L:33:34'],{role:'mandatory-choice',minimumCourses:1}),open('cyber',12)], sourceRefs:refs([254],'מגמת סייבר ואבטחת מערכות ממוחשבות'), visuallyVerified:true, requirementRules:[scienceRule,algebraRule,{type:'choose',minimumCourses:3,minimumCredits:8,items:[{type:'group',groupId:'cyber-core'}]},any('02360349','02360499'),condition('155 נקודות; קבוצת התמחות אחת נוספת של שלושה מקצועות ולפחות 8 נקודות, ללא קורסי החובה והליבה שכבר נספרו; 12 מרשימה א׳ ו־9 מא׳/ב׳.')] },
 { ...csBase, programId:'cs-learning-data', parentProgramId:'cs-three-year', programCategory:'concentration', officialName:'מדעי המחשב — המגמה ללמידה וניתוח מידע', durationYears:3, mandatory:['255R:58:63','255L:5:9','255L:17:22','255L:26:29','255L:34:35'], mandatoryExclude:['00440252','02340252','01040174'], groups:[csChoice[0],group('learning-algebra','אלגברה במ׳ או אלגברה מודרנית ח׳',['255L:9:14','248L:53:53'],{role:'mandatory-choice',minimumCourses:1,conditions:['בחירת אלגברה מודרנית ח׳ מחייבת תוספת נקודה בבחירה פקולטית.']}),csChoice[2],csA,group('learning-core','ליבת למידה וניתוח מידע — כל האפשרויות',['255L:55:68'],{role:'mandatory-choice',minimumCourses:4,creditsMin:12,conditions:['מבוא לאופטימיזציה או שיטות חישוביות באופטימיזציה הן חלופות.']}),open('learning')], sourceRefs:refs([255,256],'למידה וניתוח מידע'), requirementRules:[scienceRule,any('01040174','01040134'),condition('121 נקודות; לפחות ארבעה קורסי ליבה ו־12 נקודות, פרויקט של 3 נקודות לפחות ויתרת הבחירה מרשימה א׳ בלבד.')] },
 { ...csBase, programId:'cs-bioinformatics', parentProgramId:'cs-three-year', programCategory:'concentration', officialName:'מדעי המחשב — התמקדות בביואינפורמטיקה', facultyIds:['cs','biology'], durationYears:3, mandatory:['256R:43:48','256R:54:58','256L:2:8','256L:14:17','256L:22:24','256L:30:32'], mandatoryExclude:['00440252','02340252','01250001'], groups:[csChoice[0],group('bio-chemistry','כימיה כללית או יסודות הכימיה',['256L:7:11'],{role:'mandatory-choice',minimumCourses:1}),csA,group('bio-molecular','רשימת ביולוגיה א׳ — מקבץ מולקולרי',['256L:47:48'],{role:'mandatory-choice',creditsMin:7.5,conditions:['יש לבחור מקבץ זה במלואו או את מקבץ המיקרוביולוגיה והאבולוציה.']}),group('bio-micro','רשימת ביולוגיה א׳ — מקבץ מיקרוביולוגיה ואבולוציה',['256L:51:53'],{role:'mandatory-choice',creditsMin:7.5}),group('bio-list-b','רשימת ביולוגיה ב׳ — כל עשר האפשרויות',['256L:59:63','257R:1:5'],{minimumCourses:2}),group('bio-rest-a','השלמת בחירה — רשימה א׳ בתואר בביולוגיה',['208L:36:42'],{conditions:['רק להשלמת מכסת הבחירה בביולוגיה; אין להחיל את מכסת ארבעת הקורסים של התואר בביולוגיה על מגמה זו.']}),group('bio-rest-b','השלמת בחירה — רשימה ב׳ בתואר בביולוגיה',['208L:47:59','209R:3:28'],{conditions:['אישורים, חפיפות ומגבלת שני קורסים במכון הבין־אוניברסיטאי באילת ממשיכים לחול.']}),open('bioinfo')],sourceRefs:refs([247,256,257,208,209],'ביואינפורמטיקה ורשימות ביולוגיה שהפרק מפנה אליהן'),notes:['קיימת סתירת מקור: טבלת מסלולי ההרשמה בעמוד 28 מתארת ארבע שנים, ואילו התכנית המפורטת בעמודים 256–257 מעניקה בוגר למדעים, 124 נקודות ושישה סמסטרים. נשמרו נתוני התכנית המפורטת; יש לאמת משך מול הפקולטה.'],requirementRules:[any('01250001','01240120'),{type:'any',items:[all('01250801','01340082'),all('01340121','01340133','01340142')]},condition('124 נקודות; לפחות 8 מרשימה א׳ במדעי המחשב ולפחות 14.5 בביולוגיה. לפחות שני קורסים מרשימת ביולוגיה ב׳ והשלמה מרשימות התואר בביולוגיה.')] },
 { ...csBase,programId:'software-engineering',officialName:'הנדסת תוכנה',durationYears:4,mandatory:['257L:26:31','257L:39:43','257L:49:55','257L:60:63','258R:7:27'],mandatoryExclude:['00440252','02340252'],groups:[csChoice[0],csChoice[2],csA,csB,group('software-core','ליבת הנדסת תוכנה — כל תשע האפשרויות',['258L:5:13'],{role:'mandatory-choice',minimumCourses:3,creditsMin:9}),group('software-microeconomics','מיקרו כלכלה 1 — אפשרות מפורשת ברשימה ב׳',['258R:66:67']),open('software',12)],sourceRefs:refs([257,258],'הנדסת תוכנה'),requirementRules:[scienceRule,condition('159.5 נקודות; שלושה קורסי ליבה, לפחות 15 נקודות מרשימה א׳ במסגרת 29.5 הבחירה הנוספת, פרויקט נוסף והפרויקט השנתי בשלבים א׳ וב׳.')] },
 { ...csBase,programId:'computer-engineering',officialName:'הנדסת מחשבים',facultyIds:['cs','ee'],durationYears:4,mandatory:['259L:14:22','259L:29:33','259L:42:49','259L:53:58','260R:4:15'],mandatoryExclude:['01040064','01040016','02340123','00460209','00460210','00460267','02360267'],groups:[group('computer-algebra','אלגברה 1 — חלופות',['259L:16:18'],{role:'mandatory-choice',minimumCourses:1}),group('computer-os','מערכות הפעלה — קורס אחד או צמד',['260R:6:10'],{role:'mandatory-choice'}),group('computer-architecture','מבנה מחשבים — חלופות',['260R:13:15'],{role:'mandatory-choice',minimumCourses:1}),group('computer-projects','פרויקטים בשתי חלופות פקולטיות',['260R:23:35'],{role:'mandatory-choice',conditions:['פרויקטים א׳/ב׳ בחשמל או פרויקטים מוכרים במדעי המחשב. בדיקת הסילבוס נדרשת; המסנן אינו מאשר את כל פרויקטי הפקולטה באופן אוטומטי.']}),group('computer-core','מקצועות ליבה — כל האפשרויות',['260R:40:46'],{role:'mandatory-choice',minimumCourses:2,creditsMin:6}),...[
 ['networks','רשתות מחשבים, מערכות מבוזרות ומבנה מחשבים',['260R:60:69','260L:1:19']],['communications','תקשורת ואינפורמציה',['260L:24:44']],['algorithms','אלגוריתמים, צפינה, קריפטוגרפיה וסיבוכיות',['260L:53:67']],['signals','עיבוד אותות ותמונות',['261R:2:31']],['intelligent','מערכות נבונות',['261R:35:68']],['circuits','מעגלים אלקטרוניים משולבים',['261L:7:22']],['software','מערכות תוכנה ותכנות מתקדם',['261L:26:54']],['control','בקרה ורובוטיקה',['261L:57:70','262R:3:10']],['languages','שפות תכנות, שפות פורמליות וטבעיות',['262R:15:25']],['quantum','טכנולוגיות קוונטיות',['262R:31:44']],['energy','אנרגיה ומערכות הספק',['262R:49:60']],['physical','יסודות פיזיקליים בהנדסת מחשבים',['262R:64:69','262L:1:11']],
 ].map(([id,name,regions])=>group(`computer-special-${id}`,`קבוצת התמחות — ${name}`,regions,{role:'specialization',minimumCourses:3,conditions:['בחירה מתוך 12 קבוצות; דרישות הליבה והחלופות של הקבוצה נותרות מחייבות לפי המקור.']})),group('computer-rest','יתרת הבחירה משתי הפקולטות',[],{rules:[facultyRule('cs'),facultyRule('ee')],sourceRefs:refs([260],'יתרת הבחירה'),conditions:['המקור מתיר מקצועות משתי הפקולטות. קורסי ליבה והתמחות אינם נספרים פעמיים.']}),open('computer',12)],sourceRefs:refs([259,260,261,262],'הנדסת מחשבים'),requirementRules:[{type:'any',items:[course('02340123'),all('00460209','00460210')]},any('01040064','01040016'),any('00460267','02360267'),condition('158.5 נקודות; שתי קבוצות שונות ושלושה מקצועות בכל אחת, שישה מקצועות שונים. מקצועות ליבה זרים למקצועות שנספרו בהתמחות.')] },
 { ...csBase,programId:'cs-mathematics',officialName:'מדעי המחשב ומתמטיקה',programCategory:'combined',facultyIds:['cs','math'],durationYears:3.5,mandatory:['263R:31:36','263R:42:46','263R:51:56','263R:60:64','263L:4:9','263L:35:38'],mandatoryExclude:['00440252','02340252','01040294','02340125'],groups:[csChoice[0],group('csmath-numerics','אנליזה נומרית או אלגוריתמים נומריים',['263L:6:8'],{role:'mandatory-choice',minimumCourses:1}),group('csmath-science','שרשראות מדעיות — כל האפשרויות',['263L:16:31'],{role:'mandatory-choice',creditsMin:5}),group('csmath-electives','מקצועות שתי הפקולטות לפי הכלל המפורש',[],{rules:[facultyRule('cs'),facultyRule('math')],sourceRefs:refs([263],'בחירה משתי הפקולטות'),conditions:['רק מקצועות שאינם מוכלים או חופפים לחובה; לפחות 14 נקודות מכל פקולטה, סמינר מתמטי ופרויקט במדעי המחשב.']}),open('csmath')],sourceRefs:refs([175,263],'תוכנית משולבת במדעי המחשב ובמתמטיקה'),requirementRules:[any('01040294','02340125'),condition('152 נקודות; תכנית משולבת קבועה ולא תואר נוסף. בפרק המתמטיקה נכתב 3.5 שנים; ההקדמה במדעי המחשב מתארת תלת־שנתית. נשמר משך 3.5 לפי הטבלה והתכנית המפורטת במתמטיקה.')] },
 { ...csBase,programId:'cs-physics',officialName:'מדעי המחשב ופיזיקה',programCategory:'combined',facultyIds:['cs','physics'],durationYears:4,mandatory:['264R:31:37','264R:47:51','264R:57:63','264R:67:68','264L:1:4','264L:10:14','264L:18:21','264L:25:28','264L:32:32'],mandatoryExclude:['00440252','02340252','01040285'],groups:[csChoice[0],group('csphysics-ode','מד״ר א׳ או מד״ר ת׳ עם השלמת נקודת בחירה',['264R:67:67','264L:6:7'],{role:'mandatory-choice',minimumCourses:1}),group('csphysics-list1','רשימה 1מ״פ — כל האפשרויות',['264L:51:63'],{creditsMin:9,conditions:['לפחות 10 נקודות בחירה בפיזיקה, ובהן 9 מהרשימה; חלופות הקוונטים והמעבדה/פרויקט מתואמות.']}),csA,group('csphysics-physics3','יתרת בחירה בפיזיקה — רשימה 3',['181R:10:57']),group('csphysics-approved-b','עד שש נקודות מרשימה ב׳ באישור יועץ',['253R:3:68','253L:3:5'],{maximumCredits:6,conditions:['הכרה רק באישור היועץ לפי פרק התכנית; אינה זכאות אוטומטית לכל קורס ברשימה.']}),open('csphysics')],sourceRefs:refs([264,186,187],'מדעי המחשב ופיזיקה'),requirementRules:[any('01040285','01040135'),condition('163.5 נקודות; לפחות 10 נקודות מכל אחת משתי הפקולטות; פרויקט אחד במדעי המחשב, לפחות 9 נקודות מתוך רשימה 1מ״פ. החלפת מד״ר א׳ במד״ר ת׳ מוסיפה נקודת בחירה.')] },
 { ...csBase,programId:'medicine-cs-double',officialName:'רפואה ומדעי המחשב — תואר כפול',programCategory:'double-degree',facultyIds:['cs','medicine'],durationYears:5,qualificationAwarded:['B.Sc. במדעי המחשב','B.Sc. במדעי הרפואה'],mandatory:['248L:24:27','248L:39:43','248L:52:57','265R:55:59','265L:5:12','265L:20:28','282L:3:55'],mandatoryExclude:excluded,groups:[csChoice[0],csChoice[1],csChoice[3],group('medicine-cs-project-alt','פרויקט מתקדם בתכנות או פרויקט אחר באישור',['265L:22:23'],{role:'mandatory-choice',conditions:['פרויקט אחר רק באישור אחראי המסלול.']}),group('medicine-cs-english','אנגלית טכנית — לחייבים לפי דרישה',['248L:29:29'],{role:'mandatory-choice',conditions:['חובת אנגלית לפי סיווג; השלמה עד סמסטר 4.']}),group('medicine-cs-open','חינוך גופני',[],{creditsMin:2,rules:[{id:'medicine-cs-sport',kind:'approval',automatic:false,description:'שתי נקודות חינוך גופני לפי הרשימה התקפה; אין חובת שש נקודות העשרה רגילה בתכנית זו.'}],sourceRefs:refs([265],'מכסת חינוך גופני')})],sourceRefs:refs([247,265,281,282],'תואר כפול ברפואה ובמדעי המחשב'),visuallyVerified:true,requirementRules:[algebraRule,condition('223.5 נקודות לתואר במדעי המחשב ולשלב הפרה־קליני במדעי הרפואה; 8.5 נקודות ההנדסה המובנות הן 02360201,02360501,02360523. סמסטרים 7–10 נלקחו מהתכנית הרפואית המפורשת בעמוד 282.'),condition('M.D. אינו מוענק בתום חמש השנים: נדרשות בנוסף שלוש שנים קליניות, שנת סטאז׳ וכל תנאי הפקולטה לרפואה. ההקלות בתכנית מותנות בהשלמת שני התארים.')] },
];
const mathA = group('math-a','רשימה א׳ — כל מקצועות המתמטיקה המפורשים',['170L:39:68','171R','171L:3:18']);
const mathSem = group('math-seminars','סמינרים במתמטיקה — כל רשימות שתי ושלוש נקודות',['171L:21:56'],{conditions:['4–8 נקודות סמינרים בתואר המתמטי הכללי; מגבלות אחרות בתכניות המשולבות.']});
const mathScience = group('math-science','מקצועות מדעיים — כל האפשרויות',['170R:63:67','170L:1:10'],{role:'mandatory-choice'});
const mathBase = {sourceId,facultyIds:['math'],degreeType:'B.Sc.',programCategory:'standard',partial:true,mandatoryComplete:true,electivesComplete:false};
const mathCommon=['170R:21:25','170R:29:34'];
const appliedBaskets=[
 ['a','סל א׳ — הסתברות וסטטיסטיקה',['174L:3:9']],['b','סל ב׳ — אופטימיזציה',['174L:12:15']],['c','סל ג׳ — למידת מכונה וניתוח נתונים',['174L:18:21']],['d','סל ד׳ — מערכות, עיבוד אותות ובקרה',['174L:24:31']],['e','סל ה׳ — משוואות דיפרנציאליות ואנליזה נומרית',['174L:34:38']],['f','סל ו׳ — תורת המשחקים וכלכלה',['174L:41:50']],
].map(([id,name,regions])=>group(`applied-${id}`,name,regions,{role:'specialization',conditions:['יש להשלים מגמה אחת בהיקף 21 נקודות לפחות ובחלוקת הסלים המפורשת; מקצוע החופף לכמה סלים נספר באחד בלבד. הסלים הם קבוצות בחירה, לא תארים.']}));
const applied = {...mathBase,programId:'applied-mathematics-three-year',officialName:'מתמטיקה יישומית — תכנית תלת־שנתית',durationYears:3,mandatory:[...mathCommon,'174R:19:23','174R:27:30','174R:41:42'],groups:[{...mathScience,creditsMin:3},...appliedBaskets,mathA,mathSem,group('applied-math-other-mandatory','קורסי חובה אחרים במסלול מתמטיקה המוכרים ליתרת הבחירה',['170R:38:48','170R:53:53']),open('applied')],sourceRefs:refs([174],'מתמטיקה יישומית'),visuallyVerified:true,notes:['נשמרו מספרים חריגים במקור: 04402020 בסל ד׳ ו־00490026 בסל ו׳. המספר 000960575 בעל תשע ספרות אינו מיובא כמספר תקני ונרשם באודיט כבלתי פתור; אין תיקון בניחוש.'],requirementRules:[condition('124 נקודות; 32 בחירה פקולטית והשלמת מגמה אחת לפחות של 21 נקודות, קורס משותף נספר בסל אחד בלבד.')]};
programs.push(
 {...mathBase,programId:'mathematics-three-year',officialName:'מתמטיקה — תכנית תלת־שנתית',durationYears:3,mandatory:['170R:21:53'],groups:[{...mathScience,creditsMin:6.5,conditions:['לפחות 6.5 נקודות; עודף עד שתי נקודות מוכר בבחירה פקולטית.']},group('math-required-choice','חובה/בחירה — כל שמונה האפשרויות',['170L:22:29'],{role:'mandatory-choice',minimumCourses:4}),mathA,mathSem,group('math-external-approval','עד שני מקצועות חיצוניים באישור',[],{rules:[{id:'math-individual-approval',kind:'approval',automatic:false,description:'עד שני מקצועות מפקולטה אחרת באישור מראש של מרכז לימודי הסמכה.'}],sourceRefs:refs([170],'בחירה פקולטית')}),open('math')],sourceRefs:refs([170,171],'מתמטיקה תלת־שנתית'),requirementRules:[condition('120.5 נקודות; 37 בחירה פקולטית, לפחות ארבעה מקצועות מרשימת חובה/בחירה ו־4–8 נקודות סמינרים.')]},
 applied,
 {...mathBase,programId:'mathematics-cs-three-year',officialName:'מתמטיקה עם מדעי המחשב — תלת־שנתי',facultyIds:['math','cs'],durationYears:3,mandatory:['173R:18:22','173R:26:31','173R:35:39','173R:43:47','173R:54:56','173R:66:66'],groups:[{...mathScience,creditsMin:5},...[
 ['a','סל א׳',['173L:13:15'],2],['b','סל ב׳',['173L:18:24'],undefined],['c','סל ג׳',['173L:27:29'],1],['d','סל ד׳',['173L:32:35'],undefined],
 ].map(([id,name,regions,minimumCourses])=>group(`mathcs-${id}`,name,regions,{role:'mandatory-choice',minimumCourses})),group('mathcs-rest','יתרת הבחירה משתי הפקולטות',[],{rules:[facultyRule('math'),facultyRule('cs')],sourceRefs:refs([173],'יתרת הבחירה'),conditions:['מלבד חובות הסלים: שני מקצועות נוספים מאיחוד א׳/ב׳/ד׳. אין לספור מקצוע חובה שוב.']}),open('mathcs')],sourceRefs:refs([173],'מתמטיקה עם מדעי המחשב תלת־שנתי'),notes:['04402520 מודפס בטבלת החובה. נשמר כפי שנדפס, ללא תיקון ל־00440252; שיוכו למאגר מצריך בירור.'],requirementRules:[condition('124 נקודות; לפחות שני מקצועות מסל א׳, שני מקצועות נוספים מאיחוד א׳/ב׳/ד׳ ומקצוע אחד מסל ג׳.')]},
 {...mathBase,programId:'mathematics-cs-four-year',officialName:'מתמטיקה עם מדעי המחשב — ארבע־שנתי',facultyIds:['math','cs'],durationYears:4,status:'inventory-only',mandatory:[],groups:[],mandatoryComplete:false,sourceRefs:refs([29,169,173],'טבלת מסלולי הלימוד והפרק המפורט'),notes:['המסלול הארבע־שנתי מופיע בטבלת מסלולי הלימוד בעמוד 29; בפרק המתמטיקה סופקה תכנית תלת־שנתית בלבד. תכנית ארבע־שנתית מלאה לא אותרה בפרק ואין להעתיק אליה אוטומטית את התכנית התלת־שנתית.']},
 {...mathBase,programId:'mathematics-physics',officialName:'מתמטיקה ופיזיקה',programCategory:'combined',facultyIds:['math','physics'],durationYears:3,mandatory:['172R:23:29','172R:36:41','172R:49:54','172R:58:63','172L:2:7'],groups:[group('mathphysics-math','בחירה מתמטית — שמונה האפשרויות',['172L:14:22'],{minimumCourses:2}),group('mathphysics-lab','מעבדה או פרויקט בפיזיקה',['172L:39:43'],{role:'mandatory-choice',minimumCourses:1}),group('mathphysics-science','בחירה פיזיקלית — שבע האפשרויות',['172L:46:52'],{minimumCourses:1}),mathA,{...mathSem,conditions:['עד שני סמינרים.']},group('mathphysics-physics3','יתרת בחירה בפיזיקה — רשימה 3',['181R:10:57']),group('mathphysics-chemistry','כימיה לפיזיקאים — אפשרות מפורשת',['172L:60:60']),open('mathphysics')],sourceRefs:refs([172,182],'מתמטיקה–פיזיקה'),requirementRules:[condition('124 נקודות; 16 בחירה, לפחות שני מקצועות מהרשימה המתמטית, מעבדה או פרויקט וקורס מהרשימה הפיזיקלית.')]},
 {...mathBase,programId:'mathematics-additional-degree',officialName:'תואר נוסף במתמטיקה לתלמידי פקולטות אחרות',programCategory:'additional-degree',status:'inventory-only',mandatory:[],groups:[],mandatoryComplete:false,sourceRefs:refs([176],'תואר ראשון נוסף במתמטיקה'),notes:['אפשרות לתכנית אישית לאחר צבירת 72 נקודות ובהתאם לתקנה 3.2.2. זוהי הרשאה לתואר נוסף, לא תכנית כפולה קבועה; רשימת הקורסים בעמוד 176 מומלצת ותלויה ברקע ולכן לא הוגדרה כחובה אחידה.']}
);
for (const [suffix,name,text,extra] of [
 ['ai-signals','בינה מלאכותית ועיבוד אותות','לפחות שני קורסים מסל ג׳, אותות ומערכות 00440131, והשלמה מסלים א׳–ד׳ ל־21 נקודות לפחות.',['00440131']],
 ['optimization-control','חקר, אופטימיזציה ובקרה של מערכות','לפחות שישה קורסים מסלים ב׳ וד׳ יחד, ל־21 נקודות לפחות.',[]],
 ['modelling-statistics','מידול מתמטי, שיטות חישוביות וסטטיסטיקה','לפחות שני קורסים מכל אחד מסלים א׳, ב׳ וה׳, ל־21 נקודות לפחות.',[]],
 ['industry-finance','שיטות מתמטיות בתעשייה, כלכלה ופיננסים','לפחות שני קורסים מכל אחד מסלים א׳, ב׳ וו׳; אותות אקראיים 00440202 אינו מוכר לסל א׳ במגמה זו. 21 נקודות לפחות.',[]],
]) programs.push({...applied,programId:`applied-mathematics-${suffix}`,parentProgramId:applied.programId,programCategory:'concentration',officialName:`מתמטיקה יישומית — מגמת ${name}`,mandatoryCourseIds:extra,requirementRules:[...applied.requirementRules,condition(text)],notes:[...applied.notes,'מגמה רשמית בתוך התואר; רשימות היתרה הכלליות של מתמטיקה נשארות זכאיות לפי הכלל המפורש.']});
const physicsList2=group('physics-list2','רשימת בחירה 2 — כל שבע האפשרויות',['180L:64:68','181R:1:5'],{minimumCourses:3,creditsMin:10.5});
const physicsList3=group('physics-list3','רשימת בחירה 3 — כל האפשרויות המפורשות',['181R:10:57']);
const physicsLabs=group('physics-labs','תכניות מעבדה א׳/ב׳ — חלופות מתואמות',['180L:9:10','180L:28:29'],{role:'mandatory-choice',conditions:['התאמה בין מעבדות 2 ו־3 לפי תכנית א׳/ב׳: 01140034 יחד עם 01140035, או 01140021 יחד עם 01140038.']});
const physicsBase={sourceId,facultyIds:['physics'],degreeType:'B.Sc.',programCategory:'standard',partial:true,mandatoryComplete:true,electivesComplete:false};
const physicsMandatory=['180R:54:59','180L:6:12','180L:22:29','180L:33:36','180L:42:44'];
programs.push(
 {...physicsBase,programId:'physics-three-year',officialName:'פיזיקה — תכנית תלת־שנתית',durationYears:3,mandatory:physicsMandatory,mandatoryExclude:['01140021','01140034','01140035','01140038'],groups:[physicsLabs,group('physics-list1','רשימת בחירה 1 — מעבדה ופרויקט',['180L:51:53'],{creditsMin:3,conditions:['פרויקט אחד לכל היותר, בפקולטה לפיזיקה בלבד; עודף נקודות בבחירה.']}),physicsList2,physicsList3,group('physics-advanced-approval','קורסים מתקדמים לפי אישור מרצה',[],{rules:[{id:'physics-118-approval',kind:'approval',automatic:false,description:'מקצועות המתחילים ב־118 ניתנים ללימוד באישור המרצה בלבד. אין רשימת קורסים סגורה בפרק זה.'}],sourceRefs:refs([181],'קורסים מתקדמים')}),open('physics')],sourceRefs:refs([180,181],'פיזיקה תלת־שנתית'),visuallyVerified:true,requirementRules:[{type:'any',items:[all('01140034','01140035'),all('01140021','01140038')]},condition('119.5 נקודות; לפחות 3 נקודות מרשימה 1 ושלושה קורסים/10.5 נקודות מרשימה 2, יתרת 17 נקודות הבחירה לפי הרשימות.')]},
 {...physicsBase,programId:'physics-four-year',track:'מגמת אופטיקה שימושית',programCategory:'concentration',officialName:'פיזיקה — ארבע־שנתי במגמת אופטיקה שימושית',durationYears:4,mandatory:['180R:54:59','180L:6:12','180L:22:29','183R:29:34','183R:38:41','183R:45:46','183R:50:52'],mandatoryExclude:['01140021','01140034','01140035','01140038','01160041'],groups:[physicsLabs,group('optics-lasers','פיזיקה של לייזרים ואופטיקה קוונטית — חלופה',['183R:41:41','183R:54:54'],{role:'mandatory-choice',minimumCourses:1}),group('optics-lab-project','רשימת בחירה א׳ — שתי התנסויות',['183R:59:62'],{role:'mandatory-choice',minimumCourses:2,conditions:['בחירת פרויקט ת׳ מחייבת השלמת 1.5 נקודות בחירה בפיזיקה.']}),physicsList3,group('optics-unique','הרשימה הייחודית — כל 14 האפשרויות',['183L:5:18'],{conditions:['רשימה זו אינה מחליפה את חובת 21 נקודות הבחירה בפיזיקה.']}),open('optics')],sourceRefs:refs([183],'פיזיקה ארבע־שנתי במגמת אופטיקה שימושית'),visuallyVerified:true,requirementRules:[any('01160041','00440339'),condition('155 נקודות; 32.5 בחירה ובהן לפחות 21 בפיזיקה ו־11.5 נוספות מהרשימה הייחודית או מפיזיקה; שתי התנסויות מתוך מעבדה ופרויקט בהתאם לחלופות.')]},
 {...physicsBase,programId:'physics-additional-degree-options',officialName:'פיזיקה — אפשרויות לתואר ראשון נוסף לפי תקנה 3.2.2',programCategory:'additional-degree',status:'inventory-only',mandatory:[],groups:[],mandatoryComplete:false,sourceRefs:refs([181],'תואר ראשון נוסף'),notes:['הקטלוג מפנה לאפשרות לתואר נוסף בחשמל, מכונות, כימיה, מדעי המחשב, מתמטיקה, ביו־רפואית, חומרים ואווירונוטיקה. זוהי הרשאה כללית לתארים נוספים, לא שמונה תכניות כפולות בעלות תכנית מאושרת; לא נוצרו צירופי קורסים משוערים.']}
);
// Formal supplemental certificates/excellence paths are inventoried without falsely
// presenting a certificate-only pool as a complete degree curriculum.
for(const [programId,officialName,parentProgramId,pages,notes] of [
 ['cs-quantum-minor','מדעי המחשב — התמחות משנית בחישוב קוונטי','cs-three-year',[248,266],['תעודה נוספת הפתוחה לתלמידי כל מסלולי הפקולטה; נדרשות שתי חלופות של חמש/שש קבוצות וקורסים משלימים. פרטי החלופות נשמרו באודיט, אך טרם הוצמדו לכל מסלול בסיס. אין זה תואר עצמאי.']],
 ['cs-lapidim-tech','מדעי המחשב — לפידים מנהיגות Tech','cs-three-year',[248,267],['תכנית מצוינות נוספת המחייבת תואר בסיס, 12 נקודות ביזמות וניהול, לפחות חציין מעבר לדרישות התואר, ופעילויות נוספות. אין תכנית תואר עצמאית.']],
 ['cs-lapidim-research','מדעי המחשב — לפידים מנהיגות במחקר','cs-three-year',[248,267],['תכנית מצוינות נוספת המחייבת תואר בסיס, פרויקט מחקרי, חשיפה למחקר ושלושה קורסים מתקדמים ובהם לפחות שש נקודות מעבר לדרישות התואר. תכנית אישית דורשת אישור.']],
 ['software-engineering-excellence','הנדסת תוכנה — מגמת מצוינות מוגברת ופסגות','software-engineering',[248,258],['נדרשות מלוא דרישות הנדסת תוכנה ועוד 14 נקודות בקורסי תואר שני (או 12 לפי הצעת מחקר מאושרת). תכנית נוספת מותאמת אישית; אין רשימת חובה אחידה מעבר לתואר הבסיס.']],
 ['mathematics-game-theory','מתמטיקה — התמחות בתורת המשחקים','mathematics-three-year',[176],['תכנית התמחות של הפקולטה למדעי הנתונים וההחלטות הפתוחה למסלולי המתמטיקה; עד שני קורסים מהרשימה המפורשת מוכרים במקום בחירה במתמטיקה. יתרת דרישות התעודה בפרק הפקולטה השותפה.']],
]) programs.push({sourceId,programId,officialName,parentProgramId,facultyIds:['cs-quantum-minor','cs-lapidim-tech','cs-lapidim-research','software-engineering-excellence'].includes(programId)?['cs']:['math','data'],degreeType:'תעודה נלווית',programCategory:'concentration',status:'inventory-only',partial:true,mandatory:[],groups:[],sourceRefs:refs(pages,officialName),mandatoryComplete:false,electivesComplete:false,notes});// Additional bachelor exits explicitly distinguished from the conditional MSc route.
programs.push(
 { ...physicsBase,programId:'physics-ee-concentration',parentProgramId:'physics-three-year',programCategory:'concentration',officialName:'פיזיקה — מגמה בהנדסת חשמל ומחשבים',facultyIds:['physics','ee'],degreeType:'B.Sc.',qualificationAwarded:['B.Sc. בפיזיקה במגמה להנדסת חשמל ומחשבים'],durationYears:4,status:'inventory-only',mandatory:[],groups:[],mandatoryComplete:false,electivesComplete:false,sourceRefs:refs([184,185],'יציאת תואר ראשון מתכנית פיזיקה והנדסת חשמל'),notes:['יציאת תואר ראשון בהיקף 159 נקודות המתוארת במפורש בעמוד 184; אינה תואר כפול ואינה תואר שני. טבלת התכנית טרם יובאה במלואה. המשך ל־M.Sc. מותנה בקבלה ובדרישות מחקר נפרדות.'] },
 { ...physicsBase,programId:'electrical-physics-concentration',parentProgramId:'electrical-engineering',programCategory:'concentration',officialName:'הנדסת חשמל — מגמה בפיזיקה',facultyIds:['ee','physics'],degreeType:'B.Sc.',qualificationAwarded:['B.Sc. בהנדסת חשמל במגמה לפיזיקה'],durationYears:4,status:'inventory-only',mandatory:[],groups:[],mandatoryComplete:false,electivesComplete:false,sourceRefs:refs([184],'יציאת תואר ראשון בהנדסת חשמל במגמה לפיזיקה'),notes:['יציאת תואר ראשון בהיקף 162 נקודות המתוארת בעמוד 184; שונה מן התואר המשולב בחשמל ופיזיקה בהיקף 178 נקודות. אין להעתיק את תכנית התואר המשולב או את תכנית ההנדסה הכללית ללא אימות.'] }
);
const quantum = programs.find(program => program.programId === 'cs-quantum-minor');
quantum.groups = [
 group('quantum-a','קבוצה א׳ — חישוביות',['266R:44:44'],{role:'mandatory'}),
 group('quantum-b','קבוצה ב׳ — מבוא לאינפורמציה קוונטית',['266R:50:52'],{role:'mandatory-choice',minimumCourses:1}),
 group('quantum-c1','קבוצה ג׳1 — קורס בקוונטים',['266R:57:61'],{role:'mandatory-choice',minimumCourses:1}),
 group('quantum-c2','קבוצה ג׳2 — טרום קוונטים, שלוש חלופות',['266R:77:77','266L:2:9'],{role:'mandatory-choice',conditions:['פיזיקה קוונטית להנדסה, או אחד מצמדי שלוש הקורסים המפורטים. אין לפרש את כל הקורסים ברשימה כחובה מצטברת.']}),
 group('quantum-d','קבוצה ד׳ — אינפורמציה קוונטית מתקדמת',['266L:15:19'],{role:'mandatory-choice',minimumCourses:1}),
 group('quantum-e','קבוצה ה׳ — טכנולוגיות קוונטיות',['266L:23:28'],{role:'mandatory-choice',minimumCourses:1}),
 group('quantum-f','קבוצה ו׳ — כל מקצועות הליבה',['266L:32:47'],{role:'mandatory-choice',minimumCourses:1,conditions:['לוגיקה למדמ״ח מוכרת בקבוצה זו לתלמידי הנדסת מחשבים בלבד.']}),
];
quantum.requirementRules=[
 {type:'any',label:'שתי חלופות לתעודה הנלווית; יש להשלים גם את התואר הבסיסי.',items:[
  {type:'all',items:[{type:'group',groupId:'quantum-a'},{type:'group',groupId:'quantum-b'},{type:'group',groupId:'quantum-c1'},{type:'choose',minimumCourses:2,items:['d','e','f'].map(id=>({type:'group',groupId:`quantum-${id}`}))}]},
  {type:'all',items:['a','b','c2','d','e','f'].map(id=>({type:'group',groupId:`quantum-${id}`}))},
 ]},
 {type:'any',label:'חלופות קבוצה ג׳2',items:[course('01140073'),all('01140054','01040004','01040131'),all('01140054','01040033','01040131')]},
 condition('תלמידי תואר תלת־שנתי נדרשים להוסיף לפחות 2.5 נקודות מעבר למכסת התואר; בתואר ארבע־שנתי אין תוספת נקודות כללית. הקבלה מותנית בצבירת 30 נקודות ובממוצע הנדרש/אישור יועץ.'),
];
quantum.notes=['תעודה נלווית הפתוחה למסלולי הפקולטה; כל שבע רשימות הקורסים ושתי חלופות התעודה יובאו. רישום זה מציג רק דרישות נוספות ואינו כולל תואר בסיס. נשמר כפריט מלאי עד להצמדת תכנית הבסיס שנבחרה, ולא כמסנן תואר עצמאי.'];
programs.find(p=>p.programId==='cs-lapidim-tech').groups=[group('lapidim-tech-list','יזמות וניהול — כל עשרים האפשרויות המפורשות',['267R:21:40'],{creditsMin:12,conditions:['לפחות שש נקודות מעבר לדרישות התואר. קורסים נוספים רק בתיאום מרכז התכנית; הקבלה והמשך הלימודים כפופים לסף ולפעילויות שבקטלוג.']})];
programs.find(p=>p.programId==='cs-lapidim-research').groups=[group('lapidim-research-course','מבוא למחקר פקולטי במדעי המחשב',['267L:14:15'],{role:'mandatory'}),group('lapidim-research-advanced','שלושה קורסים מתקדמים באישור',[],{minimumCourses:3,creditsMin:6,rules:[{id:'lapidim-research-approval',kind:'approval',automatic:false,description:'שלושה קורסים מתקדמים 236XXXX באישור האחראי האקדמי, לפחות שש נקודות מעבר לתואר, ללא הכרה למגמות נוספות.'}],sourceRefs:refs([267],'לפידים מנהיגות במחקר')})];
programs.find(p=>p.programId==='mathematics-game-theory').groups=[group('math-game-theory-approved','רשימת הקורסים המוכרים במתמטיקה — עד שניים',['176R:52:59'],{conditions:['רק למתקבלים לתכנית ההתמחות של הפקולטה למדעי הנתונים וההחלטות; עד שניים במקום בחירה פקולטית במתמטיקה. יתרת דרישות התעודה לא הושלמה כאן.']})];
const medicineCS=programs.find(p=>p.programId==='medicine-cs-double');
medicineCS.mandatoryExclude=[...medicineCS.mandatoryExclude,'02360503','02360201','02360501','02360523'];
medicineCS.groups.push(group('medicine-cs-built-in','בחירה הנדסית מובנית — שלושה קורסים קבועים',['265R:42:43'],{conditions:['8.5 נקודות בחירה הנדסית המובנות בתכנית ללא אפשרות בחירה חלופית.']}));
medicineCS.requirementRules.push(all('02360201','02360501','02360523'));
for(const program of programs.filter(p=>p.programId==='cs-four-year'||p.programId==='cs-cybersecurity')){
 program.requirementRules.push(
  {type:'condition',text:'אם נבחרה קבוצת קריפטולוגיה, צפינה ואינפורמציה, נדרש אחד משני מקצועות הליבה.',requirement:any('02360309','02360506')},
  {type:'condition',text:'אם נבחרה קבוצת תקשורת ומערכות מבוזרות, נדרש אחד משני מקצועות הליבה.',requirement:any('02360334','02360370')}
 );
}const appliedAllowed={
 'applied-mathematics-ai-signals':['a','b','c','d'],
 'applied-mathematics-optimization-control':['b','d'],
 'applied-mathematics-modelling-statistics':['a','b','e'],
 'applied-mathematics-industry-finance':['a','b','f'],
};
for(const [id,allowed]of Object.entries(appliedAllowed)){
 const program=programs.find(p=>p.programId===id);
 program.groups=program.groups.filter(g=>!/^applied-[a-f]$/.test(g.id)||allowed.some(letter=>g.id===`applied-${letter}`));
 if(id.endsWith('industry-finance'))program.groups=program.groups.map(g=>g.id==='applied-a'?{...g,exclude:['00440202'],conditions:[...g.conditions,'אותות אקראיים אינו מוכר בסל א׳ במגמה זו.']}:g);
}
for(const [programId,parentProgramId]of [['cs-four-year-learning-data','cs-four-year'],['software-engineering-learning-data','software-engineering']]){
 const base=programs.find(p=>p.programId===parentProgramId);
 programs.push({...base,programId,parentProgramId,programCategory:'concentration',officialName:`${base.officialName} — מגמת למידה וניתוח מידע`,mandatoryCourseIds:['02360201','02360766'],groups:[...base.groups,group(`${programId}-core`,'ליבת למידה וניתוח מידע — בנוסף לדרישות תואר הבסיס',['255L:55:68'],{role:'mandatory-choice',minimumCourses:4,creditsMin:12,conditions:['חלופת האופטימיזציה המתואמת נחשבת מקצוע אחד. חלים כל תנאי התואר המקורי והמגמה.']})],sourceRefs:[...base.sourceRefs,...refs([256],'הכרה במגמת למידה וניתוח מידע למסלול ארבע־שנתי ולהנדסת תוכנה')],requirementRules:[...base.requirementRules,all('02360201','02360766'),condition('יש להשלים את מלוא דרישות תואר הבסיס וגם את דרישות החובה והליבה הייחודיות של מגמת למידה וניתוח מידע; כללי ההכרה ההדדית בקבוצות/ליבה ופרויקט לפי עמוד 256.')],notes:[...(base.notes??[]),'וריאנט הנתמך מפורשות בעמוד 256; תואר הבסיס לא הוחלף בתכנית הלמידה התלת־שנתית.']});
}
const computer=programs.find(p=>p.programId==='computer-engineering');
for(const [id,requirement,text]of [
 ['networks',any('00440334','02360334'),'רשתות מחשבים/מבוא לרשתות מחשבים מחייב; רצף המשך מותאם לקורס שנבחר.'],
 ['communications',{type:'all',items:[course('00440202'),any('00460206','00460204')]},'אותות אקראיים ואחד משני קורסי התקשורת מחייבים.'],
 ['algorithms',course('02360343'),'תורת החישוביות מחייב.'],
 ['signals',{type:'all',items:[course('00440198'),any('00440202','00460200','02360860')]},'עיבוד אותות ספרתי ואחד ממקצועות האותות/התמונות מחייבים.'],
 ['intelligent',any('00460345','02360216','02360501','00460212','02360927'),'אחד ממקצועות המבוא המפורשים מחייב.'],
 ['circuits',course('00460237'),'מעגלים משולבים — מבוא ל־VLSI מחייב.'],
 ['control',{type:'all',items:[course('00440191'),any('00460192','00460212','02360927')]},'מערכות בקרה 1 ואחד מקורסי הבקרה/הרובוטיקה המפורשים מחייבים.'],
 ['languages',course('02340129'),'מבוא לתורת הקבוצות ואוטומטים מחייב.'],
 ['quantum',{type:'all',items:[course('00460243'),any('02360990','01160031','00460734')]},'טכנולוגיות קוונטיות וקורס אחד באינפורמציה קוונטית מחייבים. פיזיקה קוונטית להנדסה היא קדם, ואינה מקצוע בקבוצה רק בגלל ההערה.'],
 ['energy',{type:'all',items:[course('00460042'),any('00440139','00340034')]},'מבוא למערכות הספק ואחד משני קורסי ההמרה/ההנע מחייבים.'],
 ['physical',course('00440124'),'אלקטרוניקה פיזיקלית מחייב.'],
]){
 const g=computer.groups.find(g=>g.id===`computer-special-${id}`);
 g.conditions.push(text);
 computer.requirementRules.push({type:'condition',text:`אם נבחרה ${g.name}: ${text}`,requirement});
}
computer.requirementRules.push(condition('בקבוצות תקשורת: מי שלמד 00440334 רשאי לבחור רק 00460005 כהמשך; מי שלמד 02360334 רשאי לבחור רק 02360341 כהמשך.'));// A selectable supplementary path is anchored to a real degree, never a certificate-only pool.
for(const [id,baseId,name]of [
 ['cs-quantum-minor','cs-three-year','מדעי המחשב — תלת־שנתי עם התמחות משנית בחישוב קוונטי'],
 ['cs-lapidim-tech','cs-three-year','מדעי המחשב — תלת־שנתי עם לפידים מנהיגות Tech'],
 ['cs-lapidim-research','cs-three-year','מדעי המחשב — תלת־שנתי עם לפידים מנהיגות במחקר'],
 ['mathematics-game-theory','mathematics-three-year','מתמטיקה — תלת־שנתי עם התמחות בתורת המשחקים'],
]){
 const program=programs.find(p=>p.programId===id),base=programs.find(p=>p.programId===baseId);
 Object.assign(program,{
  officialName:name,parentProgramId:baseId,status:'partial',degreeType:base.degreeType,durationYears:base.durationYears,
  mandatory:[...(base.mandatory??[]),...(program.mandatory??[])],mandatoryExclude:[...(base.mandatoryExclude??[])],
  groups:[...base.groups,...program.groups],sourceRefs:[...base.sourceRefs,...program.sourceRefs],
  requirementRules:[...(base.requirementRules??[]),...(program.requirementRules??[])],
  mandatoryComplete:base.mandatoryComplete,electivesComplete:false,
  notes:[...program.notes.filter(note=>!note.includes('נשמר כפריט מלאי')), 'וריאנט זה מקובע לתואר הבסיס המצוין בשמו. המקור מאפשר גם מסלולי בסיס אחרים; אין החלפה אוטומטית של תואר הבסיס. דרישות המגמה מתווספות למלוא חובות התואר.'],
 });
}
programs.find(p=>p.programId==='cs-lapidim-tech').requirementRules.push(condition('לפידים Tech: לפחות 12 נקודות יזמות וניהול מהרשימה או באישור מרכז, לפחות שש מעבר לתואר, השתתפות בפעילויות וממוצע/קצב צבירה כנדרש במקור.'));
programs.find(p=>p.programId==='cs-lapidim-research').requirementRules.push(condition('לפידים מחקר: פרויקט בעל אופי מחקרי ואישור בכתב, שלושה קורסים מתקדמים באישור ובהם לפחות שש נקודות מעבר לתואר; קבלה והמשך בכפוף לתנאים.'));
programs.find(p=>p.programId==='mathematics-game-theory').notes.push('תכנית הבסיס במתמטיקה יובאה; יתרת דרישות תעודת תורת המשחקים בפרק מדעי הנתונים דורשת השלמה ואינה מוצגת כמאומתת.');const mathFour=programs.find(p=>p.programId==='mathematics-cs-four-year');
mathFour.notes.push('נבדק גם פרק המתמטיקה הרשמי הנפרד לתשפ״ו (עשרה עמודים): https://ugportal.technion.ac.il/wp-content/uploads/2025/09/10-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%AA%D7%A9%D7%A4%D7%B4%D7%95.pdf . גם בו מופיעה תכנית מפורטת תלת־שנתית בלבד. תכניות ארבע־שנתיות משנים קודמות לא הועתקו לתשפ״ו.');
const csQuantum=programs.find(p=>p.programId==='cs-quantum-minor');
csQuantum.groups=csQuantum.groups.map(g=>g.id==='quantum-f'?{...g,exclude:['02340292'],conditions:[...g.conditions,'לוגיקה למדמ״ח אינה מוכרת בקבוצת הליבה הנלווית במסלול הבסיס התלת־שנתי הזה; היא נשארת חובת תואר הבסיס.']}:g);// The 159-credit Physics bachelor exit has its own table, unlike the 162/178-credit routes.
const physicsEE=programs.find(program=>program.programId==='physics-ee-concentration');
Object.assign(physicsEE,{
 status:'partial',partial:true,mandatoryComplete:false,electivesComplete:false,visuallyVerified:true,
 mandatory:['184R:66:70','184L:1:4','184L:13:18','184L:26:33','184L:40:48','184L:57:63','185R:2:3','185R:9:9'],
 mandatoryExclude:['01040064','01040016','01140246','04401400'],
 groups:[
  group('physics-ee-algebra','אלגברה 1 — אחת משתי חלופות',['184R:68:70'],{role:'mandatory-choice',minimumCourses:1}),
  group('physics-ee-fields','אלקטרומגנטיות ואלקטרודינמיקה או שדות אלקטרומגנטיים',['184L:44:47'],{role:'mandatory-choice',minimumCourses:1,conditions:['המספר 04401400 מודפס כך במקור ונשמר כבלתי פתור, ללא תיקון משוער. בחירה ב־01140246 מזכה 1.5 נקודות בבחירה בפיזיקה לפי ההערה.']}),
  group('physics-ee-lab-project','מעבדה לפיזיקה 5ת או פרויקט ת׳',['185R:14:16'],{role:'mandatory-choice',minimumCourses:1}),
  group('physics-ee-six','בחירה מפיזיקה — שתי אפשרויות לפחות משש',['185R:29:34'],{minimumCourses:2,conditions:['מכסת הבחירה בפיזיקה היא 12–16 נקודות לפי התכנית; מי שלמד 01140246 מקבל 1.5 נקודות בחירה ולכן המינימום הנותר עשוי להיות 10.5.']}),
  {...physicsList3,id:'physics-ee-physics3',conditions:['יתרת מכסת הבחירה בפיזיקה ניתנת להשלמה מרשימה 3 של התכנית התלת־שנתית, לפי ההפניה המפורשת בעמוד 185.']},
  ...[
   ['networks','רשתות מחשבים',['108R:60','108L:1:9']],
   ['control','בקרה ורובוטיקה',['108L:11:31']],
   ['communication','תקשורת ואינפורמציה',['108L:33:58']],
   ['microelectronics','מיקרואלקטרוניקה וננואלקטרוניקה',['108L:60','109R:1:19']],
   ['photonics','אלקטרומגנטיות ופוטוניקה',['109R:21:46']],
   ['computers','מחשבים',['109R:48','109L:1:16']],
   ['biological','אותות ומערכות ביולוגיים',['109L:18:35']],
   ['signal-image','עיבוד אותות ותמונות',['109L:37:59']],
   ['circuits','מעגלים אלקטרוניים משולבים',['109L:61','110R:3:12']],
   ['honors','קבוצת המצטיינים',['110R:14:33']],
   ['machine-learning','למידת מכונה ומערכות נבונות',['110R:35:58']],
   ['energy','אנרגיה ומערכות הספק',['110R:60','110L:1:4']],
   ['quantum','טכנולוגיות קוונטיות',['110L:6:25']],
  ].map(([id,name,regions])=>group(`physics-ee-elective-${id}`,`בחירה מרשימת חשמל — ${name}`,regions,{conditions:['התכנית מפנה לרשימת קבוצות ההתמחות בהנדסת חשמל כמקור אפשרויות בחירה; אין כאן דרישה להשלמת כל קבוצה בת שלושה קורסים. חלים תנאי הרישום, החפיפות והמצטיינים של המקצוע והקבוצה.']})),
  group('physics-ee-two-lab-credits','חובת שתי נקודות מעבדה — רשימת ההכרה טעונה בירור',[],{role:'mandatory-choice',creditsMin:2,rules:[{id:'physics-ee-lab-pool-unresolved',kind:'approval',automatic:false,description:'בתכנית 159 נקודות נדרשות שתי נקודות במקצועות מעבדה (עמוד 185). רשימת מעבדות החשמל בעמוד 108 מתארת במפורש מסלולי חשמל וחשמל–פיזיקה ומכסות אחרות, ואינה מפנה במפורש ליציאת התואר בפיזיקה. אין להציג אוטומטית את כל המעבדות כמאושרות למסלול זה; נדרש בירור פקולטי.'}],sourceRefs:refs([185,108],'מקצועות מעבדה והבדלי תחולה בין המסלולים')}),
  open('physics-ee',12),
 ],
 sourceRefs:refs([184,185,108,109,110,181],'פיזיקה במגמה להנדסת חשמל ומחשבים — תואר ראשון 159 נקודות'),
 requirementRules:[
  any('01040064','01040016'),any('01140246','04401400'),any('01140250','01140252'),
  {type:'choose',label:'שתי בחירות בפיזיקה מתוך שש',minimumCourses:2,items:['01160210','01160029','01160031','01160354','01160004','01160027'].map(course)},
  condition('159 נקודות לתואר B.Sc. אחד בפיזיקה: 85 חובה בפיזיקה, 41 חובה במגמה, לפחות 21 בחירה במצטבר (12–16 בפיזיקה ו־5–9 בחשמל לפי התכנית) ועוד 12 כלל־טכניוניות.'),
  condition('שתי נקודות מעבדה נוספות מחייבות רשימת הכרה מאושרת. הרשימה לא הוסקה ממעבדות התואר העצמאי בהנדסת חשמל.'),
  condition('המשך למחקר ול־M.Sc. לאחר שלוש שנים מותנה בקבלה ובתנאי התואר השני; המלצות למקצועות 118129/118122 אינן חובת B.Sc. ולא יובאו אוטומטית.'),
 ],
 notes:[
  'יובאה התכנית העצמאית בת 159 הנקודות, לרבות כל חובות הסמסטרים, חלופות, שש אפשרויות פיזיקה, רשימה 3 ושלוש־עשרה רשימות הבחירה המופנות מחשמל. אין זה איחוד תכניות התארים העצמאיים.',
  'שני מספרים חריגים מאומתים חזותית נותרו בדיוק כפי שנדפסו: 00404105 (תורת המעגלים החשמליים) ו־04401400 (שדות אלקטרומגנטיים). שיוכם לקורסים תקניים דורש אימות רשמי.',
  'הברירה של שתי נקודות מעבדה בעמוד 185 אינה מגדירה רשימה מפורשת למסלול זה. מקור מעבדות החשמל בעמוד 108 מגדיר מכסות ותחולה למסלולים אחרים; לא הוסקה זכאות אוטומטית. חובה זו וקטגוריות פתוחות מונעות טענת שלמות.',
  'התואר הראשון הוא B.Sc. אחד; M.Sc. הוא שלב המשך נפרד המותנה בקבלה, ולא תואר כפול ראשון.',
 ],
});const learningAlgebra=programs.find(p=>p.programId==='cs-learning-data').groups.find(g=>g.id==='learning-algebra');
learningAlgebra.sourceRefs=refs([255,248],'למידה וניתוח מידע — חלופת אלגברה המודפסת בהערה לסמסטר 2');
learningAlgebra.conditions.push('01040134 אומת חזותית בהערה בעמוד 255; ספרותיו מפוצלות בסדר חילוץ הטקסט. אזור 248L:53 משמש לאימות מספר אותו קורס באותה שנת קטלוג, והזכאות למגמה נקבעת בהערה בעמוד 255.');