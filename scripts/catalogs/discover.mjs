/** Discovery is deliberately separate from importing eligibility.
 * Candidate headings/numbers must be reconciled with maintained source regions.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sourceId=process.argv[2]??'2025-2026-full';
const sources=JSON.parse(await readFile(resolve(root,'data/catalogs/sources.json'),'utf8'));
const source=sources.find(source=>source.id===sourceId);if(!source)throw new Error('Unknown pinned source');
const extracted=JSON.parse(await readFile(resolve(root,'.cache/catalogs/extracted.json'),'utf8'))[sourceId];
if(extracted?.sha256!==source.sha256)throw new Error('Missing or changed extraction');
const pages=JSON.parse(await readFile(resolve(root,`.cache/catalogs/${sourceId}.logical-pages.json`),'utf8'));
const candidates=[];
for(let index=0;index<pages.length;index++){
 const lines=pages[index].split('\n');
 for(let line=0;line<lines.length;line++)if(/תואר כפול|תארים כפולים|תואר נוסף|תואר ראשון|תוכנית הלימודים|תכנית הלימודים|מגמת|מסלול|התמחות|רשימה [א-ת]|מקצועות בחירה/.test(lines[line])){
  candidates.push({pdfPage:index+1,line:line+1,text:lines.slice(Math.max(0,line-1),Math.min(lines.length,line+3)).join(' ').trim(),status:'candidate-requires-review'});
 }
}
await mkdir(resolve(root,'.cache/catalogs'),{recursive:true});
await writeFile(resolve(root,`.cache/catalogs/${sourceId}.discovery.json`),JSON.stringify({sourceId,sourceSha256:source.sha256,pdfPageCount:pages.length,candidateCount:candidates.length,candidates,notice:'Candidates include graduate material and prose. They NEVER establish programs or course eligibility automatically.'},null,2)+'\n');
console.log(`${pages.length} pages scanned; ${candidates.length} heading candidates recorded for second-pass reconciliation.`);