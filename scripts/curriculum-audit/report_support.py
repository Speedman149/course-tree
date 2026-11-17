# Report storage, evidence deduplication and same-term official-audit integration.
import json,hashlib
from collections import Counter
from official_compare import compare_official

def augment_report(report,catalog,courses,root):
    manifest_path=root/'audits/curriculum-accuracy/official-sources.json'
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text(encoding='utf8'))
        official=compare_official(courses.get('courses',[])+catalog.get('referencedCourses',[]),manifest,root)
        report['officialCourseDataAudit']=official
        summary=official['summary'];report['totals']['officialCourseMetadataFieldsCompared']=summary['metadataFieldsCompared'];report['totals']['officialCourseMetadataFieldMatches']=summary['metadataFieldMatches'];report['totals']['officialCourseMetadataFieldDifferences']=summary['metadataFieldDifferences'];report['totals']['officialStrongPrerequisiteRecordsCompared']=summary['strongPrerequisiteRecordsCompared'];report['totals']['officialStrongPrerequisiteRecordMatches']=summary['strongPrerequisiteRecordMatches'];report['totals']['officialStrongPrerequisiteRecordDifferences']=summary['strongPrerequisiteRecordDifferences']
        report['totals']['facultyAssociationsIndependentlyVerified']=sum(row.get('metadata',{}).get('faculty',{}).get('status')=='confirmed_correct' for row in official['records'])
        report['totals'].pop('prerequisiteRelationshipsIndependentlyVerified',None)
        report['prerequisiteAuthority']['authorityStatus']='Official OData strong-prerequisite rows were independently fetched and compared in each stored source term. Concurrent prerequisite semantics remain unverified. Third-party exports and semester ordering were not used as source truth.'
        report['methodology']['officialCourseMetadata']='Direct official OData responses, checksum-pinned per term. Metadata/strong-prerequisite results are separate from PDF curriculum coverage. Same-term live differences may reflect official corrections after the runtime snapshot.'
    report['totals']['confirmedPublishedClaimDiscrepancies']=sum(f['status']=='confirmed_incorrect' and f.get('type')!='documented_inventory_coverage_gap' for f in report['discrepancies'])
    report['totals']['confirmedInventoryCoverageGaps']=sum(f['status']=='confirmed_incorrect' and f.get('type')=='documented_inventory_coverage_gap' for f in report['discrepancies'])
    registry={}
    for record in report['requirements']+report['discrepancies']:
        refs=[]
        for evidence in record.get('evidence',[]):
            key='E-'+hashlib.sha256(json.dumps(evidence,ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:16]
            registry[key]=evidence
            quote=evidence.get('quote','');course=record.get('courseId');position=quote.find(course) if course else -1
            excerpt=quote[max(0,position-130):position+220] if position>=0 else quote[:350]
            refs.append({'evidenceId':key,'pdfPage':evidence.get('pdfPage'),'printedPage':evidence.get('printedPage',evidence.get('pdfPage')),'bbox':evidence.get('bbox'),'quoteExcerpt':excerpt,'explanation':evidence.get('explanation'),'visuallyReviewed':evidence.get('visuallyReviewed',False)})
        record['evidence']=refs
    report['sourceEvidence']=registry
    report['methodology']['evidenceStorage']='Requirement/finding evidenceId references resolve to full original source quotes in sourceEvidence. Excerpts alone are not complete source context.'
    return report

def official_markdown(report):
    official=report.get('officialCourseDataAudit')
    if not official:return ''
    s=official['summary']
    lines=['','## Direct official course-data cross-check','','These results use live Technion OData records in the exact source term stored for each course. They are separate from curriculum verification and do not increase the PDF requirement-coverage numerator.','','| Measure | Count |','|---|---:|']+[f'| {key} | {value} |' for key,value in s.items() if isinstance(value,int)]
    lines += ['','Names, credits and primary offering-unit labels are compared directly. Structured strong prerequisites use a separate strict parser and Boolean equivalence check. Ambiguous syntax, missing term records, unknown runtime rules and concurrent requirements remain unverified. A live same-term metadata difference may be an official correction since the old snapshot.','','Full official URLs, response checksums, JSON pointers, expected/actual fields and parsed rules are in `accuracy-report.json` and `official-course-differences.csv`.']
    return '\n'.join(lines)+'\n'