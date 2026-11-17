"""Independent audit logic; imports no application, importer or existing coverage code."""
from collections import Counter,defaultdict
from copy import deepcopy
import hashlib,json,re,unicodedata

STATUSES=('confirmed_correct','confirmed_incorrect','unresolved_discrepancy','unverified')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(value):
    if isinstance(value,dict):
        result={key:canonical(item) for key,item in value.items() if key not in ('id','label','sourceRefs','description')}
        if result.get('type') in ('all','any'):
            result['items']=sorted(result.get('items',[]),key=lambda item:json.dumps(item,sort_keys=True,ensure_ascii=False))
        return result
    if isinstance(value,list):return [canonical(item) for item in value]
    return value

def walk_rules(value):
    if isinstance(value,dict):
        yield value
        for child in value.get('items',[]):yield from walk_rules(child)
        if value.get('requirement'):yield from walk_rules(value['requirement'])

def rule_equivalent(expected,actual):return canonical(expected)==canonical(actual)
def source_rules(program):
    return [node for rule in program.get('requirementRules',[]) for node in walk_rules(rule)]

def eligible(program):
    return set(program.get('mandatoryCourseIds',[]))|set(program.get('additionalEligibleCourseIds',[]))|{course for group in program.get('electiveGroups',[]) for course in group.get('courseIds',[])}

def structural_checks(catalog,courses):
    checks=[]
    def add(code,ok,details):checks.append({'category':'structural','code':code,'passed':bool(ok),'details':details,'sourceVerified':False})
    programs=catalog.get('programs',[]);sources={source['id']:source for source in catalog.get('sources',[])}
    add('unique_program_editions',len({program.get('id') for program in programs})==len(programs),len(programs))
    for program in programs:
        pid=program.get('id');groups=program.get('electiveGroups',[])
        add('group_ids_unique',len({group.get('id') for group in groups})==len(groups),pid)
        add('course_ids_are_strings',all(isinstance(value,str) and re.fullmatch(r'\d{8}',value) for value in eligible(program)),pid)
        refs=program.get('sourceRefs',[])+[ref for group in groups for ref in group.get('sourceRefs',[])]
        add('reference_year_and_page_bounds',all(ref.get('sourceId') in sources and sources[ref['sourceId']].get('catalogYear')==program.get('catalogYear') and ref.get('pages') and all(isinstance(page,int) and 1<=page<=sources[ref['sourceId']].get('pageCount',0) for page in ref['pages']) for ref in refs),pid)
        group_ids={group.get('id') for group in groups}
        add('logic_group_references_resolve',all(node.get('groupId') in group_ids for node in source_rules(program) if node.get('type')=='group'),pid)
        add('logic_operators_supported',all(node.get('type') in {'course','all','any','choose','group','condition','substitution'} for node in source_rules(program)),pid)
    records=courses.get('courses',[])+catalog.get('referencedCourses',[])
    duplicates=[key for key,count in Counter(course.get('id') for course in records).items() if count>1]
    add('course_record_ids_unique',not duplicates,duplicates)
    return checks

def internal_checks(catalog,courses):
    checks=[];records=courses.get('courses',[])+catalog.get('referencedCourses',[]);index={course['id']:course for course in records}
    def add(code,ok,details,severity='medium'):checks.append({'category':'internal_consistency','code':code,'passed':bool(ok),'details':details,'severity':severity,'sourceVerified':False})
    for program in catalog.get('programs',[]):
        ids=eligible(program);mandatory=set(program.get('mandatoryCourseIds',[]))
        add('all_curriculum_ids_have_runtime_records',all(course in index for course in ids),{'pathId':program['id'],'missing':sorted(ids-index.keys())})
        for group in program.get('electiveGroups',[]):
            overlap=mandatory&set(group.get('courseIds',[])) if group.get('role')=='mandatory-choice' else set()
            if overlap:add('mandatory_and_choice_overlap_requires_source_review',False,{'pathId':program['id'],'groupId':group['id'],'courseIds':sorted(overlap)},'high')
            minimum=group.get('minimumCourses')
            if minimum is not None and not group.get('rules'):add('group_minimum_not_larger_than_pool',minimum<=len(group.get('courseIds',[])),{'pathId':program['id'],'groupId':group['id'],'minimumCourses':minimum,'poolSize':len(group.get('courseIds',[]))})
            if group.get('maximumCredits') is not None and group.get('creditsMin') is not None:add('group_credit_bounds_consistent',group['creditsMin']<=group['maximumCredits'],{'pathId':program['id'],'groupId':group['id']})
        if program.get('coverage',{}).get('status')=='inventory-only':add('inventory_only_has_no_published_membership',not ids,program['id'])
    unknown_prerequisites=[];missing_prerequisites=[]
    def leaves(rule):
        if not isinstance(rule,dict):return
        if rule.get('type')=='course':yield rule
        for child in rule.get('items',[]):yield from leaves(child)
    for course in records:
        if course.get('requirementsStatus') in ('unknown','unparsed'):unknown_prerequisites.append(course['id'])
        for leaf in leaves(course.get('requirements')):
            if leaf.get('courseId') not in index:missing_prerequisites.append({'courseId':course['id'],'referencedCourseId':leaf.get('courseId')})
    add('prerequisite_references_have_records',not missing_prerequisites,missing_prerequisites)
    return checks,{'unknownOrUnparsedPrerequisiteCourses':unknown_prerequisites,'missingPrerequisiteTargets':missing_prerequisites,'authorityStatus':'Unverified. Stored SAP-export snapshots are third-party exports; no independent authoritative prerequisite source was supplied. Semester ordering is not prerequisite evidence.'}

def build_claims(programs):
    claims={}
    def add(key,program,kind,actual,**extra):claims[key]={'id':key,'pathId':program['id'],'kind':kind,'actual':actual,'status':'unverified','reason':'No independently reviewed semantic source evidence for this claim.','evidence':[],**extra}
    for program in programs:
        pid=program['id'];prefix=pid+'|'
        for field in ('officialName','degreeType','programCategory','durationYears','facultyIds','qualificationAwarded'):
            if field in program:add(prefix+'field|'+field,program,'path_field',program[field],field=field)
        add(prefix+'complete-mandatory',program,'mandatory_list_completeness','not-independently-established')
        add(prefix+'complete-eligibility',program,'eligible_universe_completeness','not-independently-established')
        for course in program.get('mandatoryCourseIds',[]):add(prefix+'mandatory|'+course,program,'mandatory_membership',True,courseId=course)
        for course in program.get('additionalEligibleCourseIds',[]):add(prefix+'eligible|'+course,program,'eligible_membership',True,courseId=course)
        for group in program.get('electiveGroups',[]):
            gp=prefix+'group|'+group['id']+'|'
            add(gp+'role',program,'group_role',group.get('role'),groupId=group['id'])
            add(gp+'complete',program,'group_list_completeness','not-independently-established',groupId=group['id'])
            for course in group.get('courseIds',[]):add(gp+'member|'+course,program,'group_membership',True,courseId=course,groupId=group['id'])
            for field in ('creditsMin','minimumCourses','maximumCredits','requiredCourseIds'):
                if field in group:add(gp+field,program,'group_constraint',group[field],field=field,groupId=group['id'])
            for i,condition in enumerate(group.get('conditions',[])):add(gp+'condition|'+str(i),program,'group_condition',condition,groupId=group['id'])
            for i,rule in enumerate(group.get('rules',[])):add(gp+'rule|'+str(i),program,'eligibility_rule',rule,groupId=group['id'])
        for i,rule in enumerate(program.get('requirementRules',[])):add(prefix+'rule|'+str(i),program,'completion_rule',rule,ruleIndex=i)
    return claims

def token_text(value):
    value=unicodedata.normalize('NFKD',value)
    value=re.sub(r'[\u0591-\u05c7]','',value)
    return re.sub(r'[^\w\u0590-\u05ff]+','',value).lower()

def evidence_gate(assertion,source):
    evidence=assertion.get('evidence',[])
    if not evidence:return False,'Missing source-level evidence.'
    pages={page['pdfPage']:page for page in source.get('pages',[])}
    for item in evidence:
        page=pages.get(item.get('pdfPage'))
        if not page or page.get('extractionStatus','').startswith('extraction-failed'):continue
        if not item.get('quote') or not item.get('explanation'):continue
        if item.get('visuallyReviewed') and len(item.get('quote',''))>=3:return True,'Independent analyst visually reviewed the cited original page; quote and interpretation recorded.'
        normalized=token_text(item['quote'])
        texts=[' '.join(row.get('text','') for row in rows) for rows in page.get('columns',{}).values()]
        if len(normalized)>=12 and len(re.findall(r'[A-Za-z\u0590-\u05ff]',item['quote']))>=6 and any(normalized in token_text(text) for text in texts):return True,'Independent semantic assertion has a located source quote.'
        quote_tokens={token_text(token) for token in re.findall(r'[\w\u0590-\u05ff]+',item['quote']) if len(token_text(token))>=2}
        page_tokens={token_text(token) for text in texts for token in re.findall(r'[\w\u0590-\u05ff]+',text) if len(token_text(token))>=2}
        if len(quote_tokens)>=20 and len(quote_tokens&page_tokens)/len(quote_tokens)>=0.90:
            return True,'Analyst source interpretation is pinned to an independently corroborated page-text fingerprint; this is not automatic role inference from an identifier.'
    return False,'Source quote was not located in independent extraction and no visual confirmation was recorded; manual verification required.'

def apply_assertions(programs,claims,reviews,source):
    index={program['id']:program for program in programs};findings=[];comparisons=[];assertion_ids=set()
    def set_claim(key,program,kind,actual,expected,assertion,evidence_ok,reason,**extra):
        if key not in claims:claims[key]={'id':key,'pathId':program['id'],'kind':kind,'actual':actual,'status':'unverified','evidence':[],**extra}
        claim=claims[key];match=canonical(actual)==canonical(expected)
        status=('confirmed_correct' if match else 'confirmed_incorrect') if evidence_ok else ('unverified' if match else 'unresolved_discrepancy')
        if claim.get('status') in ('confirmed_correct','confirmed_incorrect') and evidence_ok and 'expected' in claim and canonical(claim['expected'])!=canonical(expected):status='unresolved_discrepancy';reason='Independent review assertions conflict; do not count either as a verified match.'
        claim.update(status=status,expected=expected,evidence=assertion.get('evidence',[]),assertionId=assertion['id'],confidence=assertion.get('confidence','medium') if evidence_ok else 'low',reviewerConfidence=assertion.get('confidence','medium'),reason=reason,**extra)
        comparisons.append({'claimId':key,'assertionId':assertion['id'],'pathId':program['id'],'status':status,'evidenceGatePassed':evidence_ok})
        if status in ('confirmed_incorrect','unresolved_discrepancy'):
            finding={'id':'F-'+str(len(findings)+1).zfill(5),'pathId':program['id'],'academicPath':program.get('officialName'), 'courseId':extra.get('courseId',claim.get('courseId')),'groupId':extra.get('groupId',claim.get('groupId')),'requirement':kind+(':'+str(extra['field']) if extra.get('field') else ''),'claimId':key,'field':extra.get('field'),'expected':expected,'actual':actual,'pdfPages':sorted({e['pdfPage'] for e in assertion.get('evidence',[]) if 'pdfPage'in e}),'printedPages':sorted({e.get('printedPage',e.get('pdfPage')) for e in assertion.get('evidence',[]) if 'pdfPage'in e}),'type':assertion.get('discrepancyType','source_mismatch' if evidence_ok else 'source_evidence_unresolved'),'severity':assertion.get('severity','high' if kind in ('mandatory_membership','completion_rule','group_membership') else 'medium'),'confidence':assertion.get('confidence','medium'),'status':status,'evidence':assertion.get('evidence',[]),'assertionId':assertion['id'],'explanation':reason}
            if program.get('coverage',{}).get('status')=='inventory-only':finding['type']='documented_inventory_coverage_gap';finding['explanation']+=' This path was already advertised as inventory-only; this is a coverage gap, not evidence of a falsely published course list.'
            findings.append(finding)
    for review in reviews:
        correct_hash=review.get('sourcePdfSha256')==source.get('sha256')
        for assertion in review.get('assertions',[]):
            if assertion['id'] in assertion_ids:raise ValueError('Duplicate independent assertion ID '+assertion['id'])
            assertion_ids.add(assertion['id'])
            gate,reason=evidence_gate(assertion,source)
            gate=gate and correct_hash and assertion.get('confidence')=='high'
            if not correct_hash:reason='Review is not pinned to the original PDF hash.'
            if assertion.get('confidence')!='high':reason='Confidence is not high enough for a confirmed source judgement; manual review remains required.'
            for pid in assertion.get('pathIds',[]):
                if pid not in index:
                    findings.append({'id':'F-'+str(len(findings)+1).zfill(5),'pathId':pid,'academicPath':None,'requirement':'review_target','expected':'existing baseline path','actual':'not found','pdfPages':[e.get('pdfPage') for e in assertion.get('evidence',[])],'type':'audit_target_unresolved','severity':'medium','confidence':'medium','status':'unresolved_discrepancy','evidence':assertion.get('evidence',[]),'assertionId':assertion['id']});continue
                program=index[pid];prefix=pid+'|';kind=assertion.get('kind');ids=assertion.get('expectedCourseIds',[])
                def compare(key,kind,actual,expected,**extra):set_claim(prefix+key,program,kind,actual,expected,assertion,gate,reason,**extra)
                if kind in ('mandatory','not-mandatory','eligible','not-eligible'):
                    actual_ids=set(program.get('mandatoryCourseIds',[])) if 'mandatory' in kind else eligible(program)
                    wanted=not kind.startswith('not-')
                    scope='mandatory' if 'mandatory' in kind else 'eligible'
                    for course in ids:compare(scope+'|'+course,scope+'_membership',course in actual_ids,wanted,courseId=course)
                    if assertion.get('mode')=='exact' and wanted:
                        for course in actual_ids-set(ids):compare(scope+'|'+course,scope+'_membership',True,False,courseId=course)
                        if assertion.get('sourceScopeComplete'):compare('complete-'+scope,scope+'_list_completeness',True,True)
                elif kind=='field':
                    field=assertion.get('field');compare('field|'+str(field),'path_field',program.get(field),assertion.get('expected'),field=field)
                elif kind=='group':
                    group=next((group for group in program.get('electiveGroups',[]) if group['id']==assertion.get('groupId')),None);gid=assertion.get('groupId');gp='group|'+str(gid)+'|'
                    if group is None:compare(gp+'exists','group_presence',False,True,groupId=gid);continue
                    actual_ids=set(group.get('courseIds',[]))
                    for course in ids:compare(gp+'member|'+course,'group_membership',course in actual_ids,True,courseId=course,groupId=gid)
                    for forbidden in assertion.get('forbiddenCourseIds',[]):compare(gp+'member|'+forbidden,'group_membership',forbidden in actual_ids,False,courseId=forbidden,groupId=gid)
                    if assertion.get('mode')=='exact':
                        for course in actual_ids-set(ids):compare(gp+'member|'+course,'group_membership',True,False,courseId=course,groupId=gid)
                        compare(gp+'complete','group_list_completeness',actual_ids==set(ids),True,groupId=gid)
                    for expected_field,actual_field in [('expectedMinimumCredits','creditsMin'),('expectedMinimumCourses','minimumCourses'),('expectedMaximumCredits','maximumCredits'),('expectedRole','role')]:
                        if expected_field in assertion:
                            if group.get(actual_field) is None and actual_field!='role':
                                set_claim(prefix+gp+actual_field,program,'group_constraint',None,assertion[expected_field],assertion,False,'No typed group constraint is present. The value may be retained in prose or another rule, so this is a representation/semantic verification gap, not a confirmed wrong academic minimum.',field=actual_field,groupId=gid)
                            else:compare(gp+actual_field,'group_constraint' if actual_field!='role' else 'group_role',group.get(actual_field),assertion[expected_field],field=actual_field,groupId=gid)
                elif kind=='rule':
                    expected=assertion.get('expected');key='semantic|'+assertion['id']
                    if assertion.get('forbiddenClause'):
                        forbidden=assertion['forbiddenClause']
                        present=any(rule_equivalent(forbidden,rule) for rule in program.get('requirementRules',[]))
                        compare(key,'completion_rule',present,False)
                    elif isinstance(expected,dict) and expected.get('type'):
                        candidates=list(source_rules(program))+[{'type':'course','courseId':cid} for cid in program.get('mandatoryCourseIds',[])]
                        for group in program.get('electiveGroups',[]):
                            if group.get('role')=='mandatory-choice' and group.get('minimumCourses')==1:
                                candidates.append({'type':'any','items':[{'type':'course','courseId':cid} for cid in group.get('courseIds',[])]})
                        matches=[rule for rule in candidates if rule_equivalent(expected,rule)]
                        # Exact subclause matches are narrow; syntactic differences alone do not prove wrong logic.
                        actual=expected if matches else {'matchingStructuredClause':False,'storedRules':program.get('requirementRules',[]),'relevantGroups':[g for g in program.get('electiveGroups',[]) if g['id'] in assertion.get('actualGroupIds',[])]}
                        if matches or assertion.get('semanticAssessment')=='confirmed_incorrect':compare(key,'completion_rule',actual,expected)
                        else:set_claim(prefix+key,program,'completion_rule',actual,expected,assertion,False,'No equivalent structured clause was established. Group bounds or prose may express equivalent logic; expert semantic comparison is required.')
                    elif assertion.get('actualField'):
                        value=program
                        for field in assertion['actualField'].split('.'):
                            if isinstance(value,dict):value=value.get(field)
                            else:value=None;break
                        compare(key,'completion_rule',value,expected)
                    else:
                        unresolved=dict(assertion);unresolved['confidence']='medium'
                        set_claim(prefix+key,program,'completion_rule',program.get('requirementRules',[]),expected,unresolved,False,'Plain-language rule comparison requires independent manual semantic review; text similarity is not logic equivalence.')
                else:compare('unsupported-assertion|'+assertion['id'],'audit_assertion_support',kind,'supported assertion kind')
    # Count unique claims, not repeated assertions about the same claim.
    unique_findings={}
    for finding in findings:unique_findings[finding.get('claimId',finding['id'])]=finding
    final=[]
    for finding in unique_findings.values():
        claim=claims.get(finding.get('claimId'))
        if claim:
            if claim['status'] in ('confirmed_correct','unverified'):continue
            finding.update(status=claim['status'],expected=claim.get('expected'),actual=claim.get('actual'),explanation=claim.get('reason'),evidence=claim.get('evidence',[]),confidence=claim.get('confidence','low'))
        final.append(finding)
    return final,comparisons

def independent_occurrences(source):
    occurrences=defaultdict(list)
    for page in source.get('pages',[]):
        for column,rows in page.get('columns',{}).items():
            for row in rows:
                for item in row.get('ids',[]):
                    occurrences[item['printedId']].append({'pdfPage':page['pdfPage'],'printedPage':page['pdfPage'],'column':column,'bbox':item['bbox'],'rowBbox':row['bbox'],'sourceText':row.get('text'),'printedId':item['printedId'],'reconstructed':item.get('reconstructed',False),'row':row})
    return occurrences

def course_metadata_checks(catalog,courses,source):
    occurrences=independent_occurrences(source);records=courses.get('courses',[])+catalog.get('referencedCourses',[])
    baseline_ids=set().union(*(eligible(program) for program in catalog.get('programs',[]) if program.get('catalogYear')=='2025-2026'))
    result=[]
    for course in records:
        cid=course.get('id');hits=occurrences.get(cid,[]);record={'courseId':cid,'referencedByBaseline':cid in baseline_ids,'storedName':course.get('name'),'storedCredits':course.get('credits'),'storedFaculty':course.get('faculties') or [course.get('faculty')],'storedSourceTerm':course.get('source',{}).get('term'),'catalogOnly':bool(course.get('catalogOnly')),'identifierStatus':'exact_source_occurrence' if hits else 'not_located_not_proof_of_nonexistence','sourceOccurrenceCount':len(hits),'sourceEvidence':[{k:v for k,v in hit.items() if k!='row'} for hit in hits[:6]],'nameStatus':'unverified','creditStatus':'unverified','facultyStatus':'unverified','prerequisiteStatus':'unverified_no_independent_authoritative_source','creditCandidates':[]}
        name_matches=[];credit_candidates=[]
        for hit in hits:
            row=hit['row'];idbox=hit['bbox'];words=row.get('words',[])
            # Conservative same-line metadata extraction. Never infer offering faculty from degree chapter.
            name_words=[word for word in words if word['x1']<idbox[0]-0.2 and re.search(r'[\u0590-\u05ff]',word['text'])]
            proposed=' '.join(word['text'][::-1] for word in sorted(name_words,key=lambda word:word['x0'],reverse=True))
            if proposed and token_text(proposed)==token_text(course.get('name','')):name_matches.append(hit)
            numeric=[word for word in words if word['x1']<idbox[0]-0.2 and re.fullmatch(r'\d+(?:\.\d+)?',word['text']) and float(word['text'])<=15]
            if len(numeric)>=2:
                left=min(numeric,key=lambda word:word['x0']);value=float(left['text'])
                # Only expose candidates. A numeric table cell is not automatically the credits column.
                credit_candidates.append({'value':value,'pdfPage':hit['pdfPage'],'bbox':[left['x0'],left['top'],left['x1'],left['bottom']],'sourceText':row['text'],'status':'column_meaning_requires_review'})
        if name_matches:record['nameStatus']='confirmed_exact_row_name_match';record['nameEvidence']=[{k:v for k,v in name_matches[0].items() if k!='row'}]
        elif hits and course.get('catalogOnly'):record['nameStatus']='details_missing_placeholder_not_verified_name'
        values=sorted({item['value'] for item in credit_candidates});record['creditCandidates']=credit_candidates[:6]
        if values:
            record['candidateCreditValues']=values
            record['creditStatus']='unresolved_column_or_context' if len(values)>1 or course.get('credits') not in values else 'candidate_matches_stored_value_not_source_verified'
            if len(values)==1 and course.get('credits') is not None and course['credits']!=values[0]:record['creditStatus']='unresolved_source_metadata_difference'
        result.append(record)
    return result

def year_differences(catalog):
    editions=defaultdict(dict)
    for program in catalog.get('programs',[]):editions[program['programId']][program.get('catalogYear')]=program
    changes=[]
    for program_id,years in editions.items():
        if '2025-2026' not in years or '2026-2027' not in years:continue
        older,newer=years['2025-2026'],years['2026-2027']
        old_mand=set(older.get('mandatoryCourseIds',[]));new_mand=set(newer.get('mandatoryCourseIds',[]));old_eligible=eligible(older);new_eligible=eligible(newer)
        changes.append({'programId':program_id,'olderEdition':older['id'],'newerEdition':newer['id'],'mandatoryAdded2026':sorted(new_mand-old_mand),'mandatoryRemoved2026':sorted(old_mand-new_mand),'eligibleAdded2026':sorted(new_eligible-old_eligible),'eligibleRemoved2026':sorted(old_eligible-new_eligible),'completionLogicDifferent':canonical(older.get('requirementRules',[]))!=canonical(newer.get('requirementRules',[])),'interpretation':'Version difference only, not a determination of which edition is correct. 2026–2027 requirements are not checked against the2025–2026 PDF.'})
    return changes