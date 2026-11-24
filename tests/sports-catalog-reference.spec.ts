import {expect, test} from '@playwright/test';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';
import {openCollection} from './helpers/mobile-tools';
const SPORT='03940901', TEAM='03940902', REG='00140855';
for(const width of [1440,320])test(`existing catalog-only sports course counts and persists without inventing credits at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({key,version,SPORT,TEAM,REG})=>{if(sessionStorage.getItem('catalog-sport-seed'))return;sessionStorage.setItem('catalog-sport-seed','yes');localStorage.setItem(key,JSON.stringify({version,progress:{primaryCourseId:TEAM,addedCourseIds:[TEAM,REG],expandedForward:[],markedCourseIds:[SPORT,TEAM,REG]}}));},{key:PROGRESS_KEY,version:PROGRESS_VERSION,SPORT,TEAM,REG});
 await page.goto('/?course='+TEAM);await expect(page.locator(`.react-flow__node[data-id="${TEAM}"]`)).toHaveCount(1);
 let panel=await openCollection(page,'marked');const row=()=>panel.locator(`[data-marked-course="${SPORT}"]`);
 await expect(row()).toHaveCount(1);await expect(row().locator('output')).toHaveText('1');await expect(row().locator('.repetition-count strong')).toHaveText('חסר נתון נק״ז לקורס');
 await row().getByRole('button',{name:'הוספת מופע של '+SPORT,exact:true}).click();await row().getByRole('button',{name:'הוספת מופע של '+SPORT,exact:true}).click();await expect(row().locator('output')).toHaveText('3');
 await expect(panel.locator('.marked-credit-summary')).toContainText('נק״ז ידוע: 4.5');await expect(panel.locator('.marked-credit-summary')).toContainText('ל־1 מקצועות חסר נתון נק״ז');
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress.markedCourseQuantities,PROGRESS_KEY)).toEqual({[SPORT]:3});
 await page.screenshot({path:info.outputPath(`catalog-only-sport-${width}.png`),fullPage:true});
 await page.reload();panel=await openCollection(page,'marked');await expect(row().locator('output')).toHaveText('3');await row().getByRole('button',{name:'הפחתת מופע של '+SPORT,exact:true}).click();await expect(row().locator('output')).toHaveText('2');
 await expect(panel.locator(`[data-marked-course="${REG}"] .repetition-stepper`)).toHaveCount(0);await expect(panel.locator('[data-marked-course="03940809"],[data-marked-course="03940810"]')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(page.locator('.react-flow__node')).toHaveCount(2);expect(errors).toEqual([]);
});
