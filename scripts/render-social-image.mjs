import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=new URL('../',import.meta.url);
const svg=await readFile(new URL('public/og-image.svg',root),'utf8');
const fonts=await Promise.all(['hebrew','latin'].map(async language=>{
 const bytes=await readFile(new URL(`node_modules/@fontsource/heebo/files/heebo-${language}-600-normal.woff2`,root));
 return `@font-face{font-family:Heebo;font-weight:600;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');unicode-range:${language==='hebrew'?'U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F':'U+0000-00FF,U+2000-206F'};}`;
}));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(`<style>body{margin:0}${fonts.join('')}</style>${svg}`);
 await page.evaluate(()=>document.fonts.ready);
 const image=await page.screenshot({type:'png'});
 await writeFile(new URL('public/og-image.png',root),image);
 console.log('Rendered '+fileURLToPath(new URL('public/og-image.png',root)));
} finally {await browser.close();}
