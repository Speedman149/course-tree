#!/usr/bin/env python3
"""Run read-only comparisons against fresh original-PDF extraction and independent reviews."""
import argparse,csv,json,re,sys
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
from report_support import augment_report,official_markdown
from audit_engine import (digest,build_claims,structural_checks,internal_checks,apply_assertions,course_metadata_checks,year_differences,eligible)

ROOT=Path(__file__).resolve().parents[2]
def load(path):return json.loads(path.read_text(encoding='utf8'))
def write_json(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def count_claims(claims):
    counts=Counter(claim['status'] for claim in claims)
    total=len(claims);checked=counts['confirmed_correct']+counts['confirmed_incorrect']
    return {'identifiedRequirementClaims':total,'requirementsComparedAgainstEvidence':checked,'verifiedMatches':counts['confirmed_correct'],'confirmedDiscrepancies':counts['confirmed_incorrect'],'unresolvedDiscrepancies':counts['unresolved_discrepancy'],'requirementsNotChecked':counts['unverified'],'sourceCheckedCoveragePercent':round(100*checked/total,3) if total else 0,'confirmedCorrectCoveragePercent':round(100*counts['confirmed_correct']/total,3) if total else 0,'observedAgreementAmongCheckedPercent':round(100*counts['confirmed_correct']/checked,3) if checked else None}

def build_report(catalog,courses,source,reviews,inputs):
    baseline=[program for program in catalog.get('programs',[]) if program.get('catalogYear')=='2025-2026']
    structural=structural_checks(catalog,courses);internal,prerequisites=internal_checks(catalog,courses)
    claims=build_claims(baseline);findings,comparisons=apply_assertions(baseline,claims,reviews,source)
    claim_rows=list(claims.values());paths=[]
    for program in baseline:
        selected=[claim for claim in claim_rows if claim['pathId']==program['id']];counts=count_claims(selected)
        fully=bool(selected) and all(claim['status']=='confirmed_correct' for claim in selected)
        status='fully_verified' if fully else 'partially_verified' if counts['requirementsComparedAgainstEvidence'] else 'not_verified'
        relevant=[item for item in internal if not item['passed'] and (item.get('details')==program['id'] or isinstance(item.get('details'),dict) and item['details'].get('pathId')==program['id'])]
        risk=len(eligible(program))/35+len(program.get('electiveGroups',[]))/3+len(program.get('requirementRules',[]))*2
        risk+=25 if program.get('programCategory')=='double-degree' else 15 if program.get('programCategory') in ('combined','dual-major') else 0
        risk+=counts['confirmedDiscrepancies']*2+counts['unresolvedDiscrepancies']
        paths.append({'pathId':program['id'],'programId':program['programId'],'academicPath':program.get('officialName'),'facultyIds':program.get('facultyIds',[]),'category':program.get('programCategory'),'auditStatus':status,'advertisedImportStatus':program.get('coverage',{}).get('status'),'counts':counts,'internalWarnings':len(relevant),'riskScore':round(risk,2),'sourceEvidencePages':sorted({item['pdfPage'] for claim in selected for item in claim.get('evidence',[]) if 'pdfPage' in item}),'remaining':'Every unverified or unresolved claim remains unchecked. Source list completeness, conditions and exceptions cannot be inferred from matching imported IDs.'})
    faculties=[]
    for faculty in sorted({faculty for path in paths for faculty in path['facultyIds']}):
        selected_paths=[path for path in paths if faculty in path['facultyIds']];ids={path['pathId'] for path in selected_paths};counts=count_claims([claim for claim in claim_rows if claim['pathId'] in ids])
        faculties.append({'facultyId':faculty,'pathCount':len(selected_paths),'fullyVerified':sum(path['auditStatus']=='fully_verified' for path in selected_paths),'partiallyVerified':sum(path['auditStatus']=='partially_verified' for path in selected_paths),'notVerified':sum(path['auditStatus']=='not_verified' for path in selected_paths),'counts':counts,'note':'Joint paths appear under each participating faculty; faculty counts must not be summed to obtain global totals.'})
    metadata=course_metadata_checks(catalog,courses,source)
    checklist=[]
    for review in reviews:
        for item in review.get('manualChecklist',[]):
            record={'question':item} if isinstance(item,str) else dict(item)
            record['reviewerFacultyIds']=review.get('facultyIds',[]);checklist.append(record)
    failed_pages=[{'pdfPage':page['pdfPage'],'status':page['extractionStatus']} for page in source['pages'] if page.get('extractionStatus')!='text-extracted-not-semantically-verified']
    totals=count_claims(claim_rows);totals.update({'totalAcademicPaths':len(baseline),'pathsFullyVerified':sum(path['auditStatus']=='fully_verified' for path in paths),'pathsPartiallyVerified':sum(path['auditStatus']=='partially_verified' for path in paths),'pathsNotVerified':sum(path['auditStatus']=='not_verified' for path in paths),'independentAssertions':sum(len(review.get('assertions',[])) for review in reviews),'structuralChecks':len(structural),'structuralFailures':sum(not check['passed'] for check in structural),'internalChecks':len(internal),'internalWarnings':sum(not check['passed'] for check in internal),'otherYearEditionsNotJudgedAgainst2025Pdf':sum(program.get('catalogYear')!='2025-2026' for program in catalog['programs']),'underlyingCourseRecords':len(metadata),'baselineReferencedCourseRecords':sum(check['referencedByBaseline'] for check in metadata),'baselineIdsNotLocatedExactlyInPdf':sum(check['referencedByBaseline'] and check['identifierStatus']!='exact_source_occurrence' for check in metadata),'exactSourceNameMatches':sum(check['nameStatus']=='confirmed_exact_row_name_match' for check in metadata),'facultyAssociationsIndependentlyVerified':0,'prerequisiteRelationshipsIndependentlyVerified':0})
    return {'schemaVersion':1,'generatedAt':datetime.now(timezone.utc).isoformat(),'auditScope':'Independent read-only accuracy audit of 2025–2026 curriculum claims. This verification run does not modify curriculum data.','methodology':{'source':'Original PDF freshly extracted with pdfplumber/pdfminer.six; existing importer output, definitions, tests and coverage reports are not source oracles.','semanticEvidence':'Independent source-review assertions, pinned to PDF checksum, compared with runtime claims. Source occurrence alone never verifies mandatory/elective role.','claimUnit':'Each path field, mandatory membership, group membership, numeric constraint, prose condition, logical root and list-completeness obligation is a separate claim. Missing discovered requirements are added. This is not a claim that all true catalog requirements have been discovered; completeness obligations remain unverified. Shared facts repeat as path-specific instances.','coverage':'Source-checked coverage=(confirmed correct+confirmed incorrect)/all identified claims; confirmed-correct coverage=confirmed correct/all claims. Observed agreement is only for checked claims, not estimated overall accuracy.','fullyVerified':'Every identified claim must be source-correct, including explicit mandatory and eligibility completeness obligations. Structural/internal passes never qualify.','samplingBias':'Extra effort targets risky curricula. The checked subset is not random and its agreement rate must not be extrapolated.','courseMetadata':'Exact same-line names are compared separately. Numeric cells remain credit candidates until their column/context is verified. Faculty ownership is not inferred from degree membership. Missing source occurrence is not proof that a course does not exist.','years':'2026–2027 changes are reported independently; no2026 requirement is judged wrong merely because it differs from the 2025 PDF.'},'source':{'pdfSha256':source['sha256'],'pdfPageCount':source['pageCount'],'engine':source['engine'],'extractionManualReviewPages':failed_pages,'pagesWithIndependentAssertions':sorted({e['pdfPage'] for review in reviews for assertion in review.get('assertions',[]) for e in assertion.get('evidence',[]) if 'pdfPage'in e}),'visuallyReviewedPages':sorted({e['pdfPage'] for review in reviews for assertion in review.get('assertions',[]) for e in assertion.get('evidence',[]) if e.get('visuallyReviewed') and 'pdfPage'in e})},'inputIntegrity':inputs,'totals':totals,'faculties':faculties,'paths':paths,'requirements':claim_rows,'discrepancies':findings,'structuralValidation':structural,'internalConsistency':internal,'courseDataChecks':metadata,'prerequisiteAuthority':prerequisites,'catalogYearDifferences':year_differences(catalog),'riskRankedPaths':sorted([{'pathId':path['pathId'],'academicPath':path['academicPath'],'riskScore':path['riskScore'],'confirmedDiscrepancies':path['counts']['confirmedDiscrepancies'],'unresolvedDiscrepancies':path['counts']['unresolvedDiscrepancies']} for path in paths],key=lambda path:path['riskScore'],reverse=True),'manualReviewQuestions':checklist,'reviewLimitations':[{'facultyIds':review.get('facultyIds',[]),'limitations':review.get('limitations',[])} for review in reviews]}

def cell(value):
    text=json.dumps(value,ensure_ascii=False) if isinstance(value,(dict,list)) else str(value)
    return text.replace('|','\\|').replace('\n',' ').replace('\r',' ')

def markdown(report):
    totals=report['totals'];lines=['# Independent curriculum accuracy audit','','**This is an independent evidence-limited audit, not a certification of the entire database. The audit runner does not modify curriculum data; prior corrections are recorded separately.**','','The original 2025–2026 PDF was freshly parsed using pdfplumber/pdfminer.six. Source-review assertions were written independently of the importer. Internal/structural checks, exact-ID sightings and the previous coverage report are not counted as academic verification.','','## Measured results','','| Measure | Result |','|---|---:|']
    lines += [f'| {key} | {value} |' for key,value in totals.items()]
    lines += ['','A source-checked claim can be correct or incorrect. Confirmed-correct coverage is reported separately. The observed agreement among checked claims is not an estimate of overall accuracy: the subset is deliberately weighted toward risky curricula. Shared course/list facts are counted as path-specific claim instances. Numeric-cell credit candidates, source ID occurrence and structural/internal passes contribute zero curriculum verification credit.','','## Trust assessment','','Do not rely on the current data as a graduation, registration, or mandatory-course checker. A path is fully verified only when every identified claim, all source list completeness obligations and relevant exceptions are checked. Every unreviewed or ambiguous requirement remains unverified.','','## Source evidence and scope','','- PDF SHA-256: `'+report['source']['pdfSha256']+'`.','- Physical PDF pages: '+str(report['source']['pdfPageCount'])+'.','- Pages with independent semantic assertions: '+', '.join(map(str,report['source']['pagesWithIndependentAssertions']))+'.','- Visually reviewed pages: '+', '.join(map(str,report['source']['visuallyReviewedPages']))+'.','- Source extraction failures/low-text pages are listed in JSON; blank or ambiguous pages do not receive automatic passes.','','## Confirmed discrepancies','','Each row below is a source-backed claim mismatch. Previously advertised inventory-only omissions are labeled as coverage gaps. The JSON/CSV provides full source quotes, confidence, expected/actual values and exact pages.','','| Path | Course / group | Requirement | Expected | Actual | PDF page | Severity | Confidence |','|---|---|---|---|---|---|---|---|']
    for finding in report['discrepancies']:
        if finding['status']!='confirmed_incorrect':continue
        expected=cell(finding.get('expected'));actual=cell(finding.get('actual'))
        if len(expected)>170:expected=expected[:167]+'...'
        if len(actual)>170:actual=actual[:167]+'...'
        lines.append('| '+' | '.join(map(cell,[finding.get('academicPath') or finding['pathId'],finding.get('courseId') or finding.get('groupId') or '',finding.get('requirement'),expected,actual,', '.join(map(str,finding.get('pdfPages',[]))),finding.get('severity'),finding.get('confidence')]))+' |')
    lines += ['','## Faculty breakdown','','Joint paths appear under every participating faculty; do not sum these rows.','','| Faculty | Paths | Fully verified | Partially verified | Not verified | Checked claims | Correct | Incorrect | Unresolved |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for faculty in report['faculties']:
        c=faculty['counts'];lines.append('| '+' | '.join(map(str,[faculty['facultyId'],faculty['pathCount'],faculty['fullyVerified'],faculty['partiallyVerified'],faculty['notVerified'],c['requirementsComparedAgainstEvidence'],c['verifiedMatches'],c['confirmedDiscrepancies'],c['unresolvedDiscrepancies']]))+' |')
    lines += ['','## Every academic path','','| Path | Status | Claims | Source checked | Correct | Incorrect | Unresolved | Unchecked | PDF pages |','|---|---|---:|---:|---:|---:|---:|---:|---|']
    for path in report['paths']:
        c=path['counts'];lines.append('| '+' | '.join(map(cell,[path['academicPath'],path['auditStatus'],c['identifiedRequirementClaims'],c['requirementsComparedAgainstEvidence'],c['verifiedMatches'],c['confirmedDiscrepancies'],c['unresolvedDiscrepancies'],c['requirementsNotChecked'],path['sourceEvidencePages']]))+' |')
    lines += ['','## Underlying course data','','Course IDs and exact same-line source names were independently located. These checks do not establish degree membership. Full per-course results appear in JSON, including missing records, placeholders, source-term provenance and ambiguous credit candidates. Offering faculty is not inferred from a degree chapter. Strong prerequisites were separately checked against direct official term records where possible; concurrent semantics remain unverified. The stored third-party export and semester order were not treated as sufficient authority.','','## Catalog years','','There are '+str(totals['otherYearEditionsNotJudgedAgainst2025Pdf'])+' separate non-baseline editions. Mandatory/eligible/logic deltas are recorded in JSON. A difference between 2025–2026 and 2026–2027 is not itself an error. The current course metadata may come from a newer SAP snapshot, so a credit/name difference requires term-specific authority before a correction.','','## Remaining manual verification','','See [manual-review.md](manual-review.md) for a short risk-prioritized checklist. All unresolved and unchecked claims remain listed in the machine-readable report; they must never be treated as correct matches.','','## Repeatability and limitations','','The audit reads runtime JSON, original-PDF extraction and independently maintained review assertions. It imports no application/importer/coverage validation functions. Review assertions are pinned to this PDF checksum; a new catalog requires new evidence review. Rerunning tests validates the audit mechanism, not the academic database. The report is valid only for the input hashes in `input-lock.json`.','']
    return '\n'.join(lines)
def write_csv(path,rows,fields):
    with path.open('w',encoding='utf-8-sig',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields,extrasaction='ignore');writer.writeheader()
        for row in rows:writer.writerow({key:json.dumps(row.get(key),ensure_ascii=False) if isinstance(row.get(key),(list,dict)) else row.get(key) for key in fields})

def manual_markdown(report):
    buckets={}
    for item in report.get('manualReviewQuestions',[]):
        key=','.join(item.get('reviewerFacultyIds',[]))
        buckets.setdefault(key,[]).append(item)
    selected=[];seen=set();position=0
    while len(selected)<12 and any(position<len(items) for items in buckets.values()):
        for items in buckets.values():
            if position>=len(items):continue
            item=items[position]
            text=item.get('question') or item.get('requirement') or item.get('text') or item.get('issue') or item.get('reason') or item.get('topic') or 'Inspect source context.'
            key=re.sub(r'\d+','',text)[:110]
            if key in seen:continue
            seen.add(key);selected.append({**item,'question':text})
            if len(selected)>=12:break
        position+=1
    lines=['# Strategic manual review checklist','','These questions are unresolved, not matches. Inspect original 2025–2026 headings and footnotes. Record answers as new independent source assertions before proposing data corrections.','']
    for index,item in enumerate(selected,1):
        pages=item.get('pdfPages') or item.get('pages') or item.get('pdfPage') or [e.get('pdfPage') for e in item.get('evidence',[]) if e.get('pdfPage')]
        lines += [str(index)+'. **PDF pages '+str(pages)+':** '+item['question'],'']
    lines += ['## Highest-risk paths','']
    for item in report['riskRankedPaths'][:8]:lines.append('- '+item['academicPath']+' ('+item['pathId']+'): risk score '+str(item['riskScore'])+'.')
    lines += ['', '## Official historical prerequisite gaps', '', 'Four old-term official records returned empty prerequisite fields while the stored historical exports contain rules. Obtain authoritative archival confirmation before treating the old graph edges as errors. Current strong-rule differences and concurrent semantics remain separate from curriculum verification.']
    return '\n'.join(lines)+'\n'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pdf',type=Path,required=True);parser.add_argument('--source-json',type=Path,default=ROOT/'.cache/curriculum-audit/source.json');parser.add_argument('--output',type=Path,default=ROOT/'audits/curriculum-accuracy');parser.add_argument('--reviews',type=Path,default=ROOT/'audits/curriculum-accuracy/reviews');parser.add_argument('--fail-on-confirmed',action='store_true');args=parser.parse_args()
    output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
    catalog_path=ROOT/'public/data/catalogs.json';course_path=ROOT/'public/data/courses.json'
    actual_hash=digest(args.pdf)
    source=load(args.source_json)
    if source.get('sha256')!=actual_hash:raise SystemExit('Independent extraction does not match original PDF bytes. Re-extract original PDF; no report generated.')
    lock_path=output/'input-lock.json'
    current={'public/data/catalogs.json':{'bytes':catalog_path.stat().st_size,'sha256':digest(catalog_path)},'public/data/courses.json':{'bytes':course_path.stat().st_size,'sha256':digest(course_path)}}
    if lock_path.exists():
        locked=load(lock_path)
        if locked.get('inputs')!=current:raise SystemExit('Runtime input changed during initial audit. Preserve the old audit snapshot; explicitly create a new audit output directory for a new dataset.')
    else:locked={'schemaVersion':1,'policy':'Read-only initial audit; no curriculum correction authorized or performed.','inputs':current}
    locked['policy']='Read-only source comparison; this auditor performs no data mutations. Prior corrections, if any, are tracked separately.'
    locked.update(sourcePdf={'fileName':args.pdf.name,'sha256':actual_hash,'bytes':args.pdf.stat().st_size},sourceExtraction={'sha256':digest(args.source_json),'engine':source.get('engine')})
    review_paths=sorted(args.reviews.glob('*.json'))
    reviews=[load(path) for path in review_paths]
    locked['reviewFiles']={str(path.relative_to(ROOT)):digest(path) for path in review_paths}
    locked['auditToolingHashes']={str(path.relative_to(ROOT)):digest(path) for path in sorted((ROOT/'scripts/curriculum-audit').glob('*')) if path.suffix in ('.py','.mjs')}
    report=build_report(load(catalog_path),load(course_path),source,reviews,locked)
    report=augment_report(report,load(catalog_path),load(course_path),ROOT)
    # A successful structural check has no influence on confirmed source counts.
    report['inputIntegrity']['runtimeUnchangedAtEnd']=digest(catalog_path)==current['public/data/catalogs.json']['sha256'] and digest(course_path)==current['public/data/courses.json']['sha256']
    if not report['inputIntegrity']['runtimeUnchangedAtEnd']:raise SystemExit('Runtime data changed while audit ran; discard this run.')
    write_json(lock_path,locked)
    (output/'accuracy-report.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    (output/'accuracy-report.md').write_text(markdown(report)+official_markdown(report),encoding='utf8')
    (output/'manual-review.md').write_text(manual_markdown(report),encoding='utf8')
    write_csv(output/'discrepancies.csv',report['discrepancies'],['id','pathId','academicPath','courseId','groupId','requirement','expected','actual','pdfPages','printedPages','type','severity','confidence','status','assertionId','explanation','evidence'])
    official_differences=[{'courseId':row['courseId'],'term':row['runtimeSourceTerm'],'field':field,**value,'evidence':row.get('evidence')} for row in report.get('officialCourseDataAudit',{}).get('records',[]) for field,value in {**row.get('metadata',{}),'strongPrerequisites':row['strongPrerequisites']}.items() if value.get('status') in ('confirmed_incorrect','unresolved_discrepancy')]
    write_csv(output/'official-course-differences.csv',official_differences,['courseId','term','field','expected','actual','status','severity','type','limitation','evidence'])
    write_csv(output/'requirements.csv',report['requirements'],['id','pathId','kind','courseId','groupId','field','actual','expected','status','confidence','assertionId','reason','evidence'])
    write_csv(output/'course-data.csv',report['courseDataChecks'],['courseId','referencedByBaseline','storedName','storedCredits','storedFaculty','storedSourceTerm','catalogOnly','identifierStatus','sourceOccurrenceCount','nameStatus','creditStatus','candidateCreditValues','facultyStatus','prerequisiteStatus','sourceEvidence','creditCandidates'])
    print(json.dumps(report['totals'],indent=2));print('Runtime inputs unchanged:',report['inputIntegrity']['runtimeUnchangedAtEnd'])
    if args.fail_on_confirmed and report['totals'].get('confirmedPublishedClaimDiscrepancies',0):
        print('SOURCE_ACCURACY_GATE_FAILED: confirmed published curriculum discrepancies remain.')
        raise SystemExit(2)
    return report
if __name__=='__main__':main()