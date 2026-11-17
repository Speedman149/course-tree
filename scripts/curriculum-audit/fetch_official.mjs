/** Read-only official course evidence. No importer, GitHub snapshot or app parser imports. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const cache=resolve(root,'.cache/curriculum-audit/official');await mkdir(cache,{recursive:true});
const actual=JSON.parse(await readFile(resolve(root,'public/data/courses.json'),'utf8'));
const terms=[...new Set(actual.courses.map(course=>course.source?.term).filter(term=>/^\d{4}_\d{3}$/.test(term)))].sort();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let previousSources=new Map();try{const previous=JSON.parse(await readFile(resolve(root,'audits/curriculum-accuracy/official-sources.json'),'utf8'));previousSources=new Map(previous.sources.map(source=>[source.term,source]));}catch(error){if(error.code!=='ENOENT')throw error;}
const manifest={schemaVersion:1,authority:'Technion public OData service, not third-party SAP exports',purpose:'Course metadata and strong-prerequisite evidence in each runtime record’s own term; curriculum membership remains governed by2025–2026 PDF.',sources:[]};
for(const term of terms){
 const file=resolve(cache,`${term}.json`);let bytes=null;let fromCache=false;
 if(!process.argv.includes('--refresh')){try{bytes=await readFile(file);fromCache=true;}catch(error){if(error.code!=='ENOENT')throw error;}}
 const [year,session]=term.split('_');const url=new URL('https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/SmObjectSet');
 for(const [key,value]of Object.entries({'sap-client':'700','$filter':`Peryr eq '${year}' and Perid eq '${session}'`,'$select':'Otjid,Points,Name,OrgText,SmPrereq,ZzSemesterNote','$expand':'SmPrereq','$top':'10000','$format':'json'}))url.searchParams.set(key,value);
 const record={term,url:url.toString(),method:'GET',checkedAt:new Date().toISOString(),fromCache,relativeFile:`.cache/curriculum-audit/official/${term}.json`};
 try{
  if(!bytes){const response=await fetch(url,{headers:{Accept:'application/json','Accept-Language':'he'},signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
  const previous=previousSources.get(term);
  if(fromCache&&previous?.sha256&&hash(bytes)!==previous.sha256)throw new Error('Cached official response changed; preserve snapshot and explicitly refresh after review.');
  if(fromCache&&previous?.checkedAt){record.reusedAt=record.checkedAt;record.checkedAt=previous.checkedAt;}
  const payload=JSON.parse(bytes.toString('utf8'));if(!Array.isArray(payload?.d?.results))throw new Error('Official response is not a result collection');
  const count=Number(payload.d.__count??payload.d.results.length);
  record.sha256=hash(bytes);record.byteCount=bytes.length;record.recordCount=payload.d.results.length;record.advertisedCount=count;record.complete=record.recordCount===count&&!payload.d.__next;record.status='retrieved';
  if(!fromCache)await writeFile(file,bytes);
  console.log(`${term}: ${record.recordCount}/${count} official records; ${bytes.length} bytes; complete=${record.complete}`);
 }catch(error){record.status='unavailable';record.complete=false;record.error=error.message;console.log(`${term}: unavailable (${error.message})`);}
 manifest.sources.push(record);
 await writeFile(resolve(root,'audits/curriculum-accuracy/official-sources.json'),JSON.stringify(manifest,null,2)+'\n');
}