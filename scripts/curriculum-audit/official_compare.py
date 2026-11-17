# Independent official-course comparison; no importer code is used.
import json,re,unicodedata
from collections import defaultdict,Counter
from audit_engine import digest

def normalized(value):
    value=unicodedata.normalize('NFKC',str(value or ''))
    return re.sub(r'[\s\u0591-\u05c7\x22\x27\u05f3\u05f4]+','',value).lower()

def parse_official_strong(rows):
    if not rows:return None
    tokens=[]
    for row in sorted(rows,key=lambda row:int(row.get('LineNumber','0'))):
        bracket=row.get('Bracket','').strip();module=row.get('ModuleId','').strip();operator=row.get('Operator','').strip().upper()
        has_course=bool(module and set(module)!={'0'})
        if bracket and not re.fullmatch(r'[()]+',bracket):raise ValueError('Unsupported bracket encoding')
        if has_course and ')' in bracket:raise ValueError('Closing bracket and course on one row require manual interpretation')
        if '(' in bracket:tokens.extend('(' for _ in range(bracket.count('(')))
        if has_course:
            if not re.fullmatch(r'\d{8}',module):raise ValueError('Unresolved official prerequisite identifier '+module)
            tokens.append(module)
        if ')' in bracket:tokens.extend(')' for _ in range(bracket.count(')')))
        if operator:
            if operator not in ('AND','OR'):raise ValueError('Unsupported logical operator '+operator)
            tokens.append(operator)
    position=0
    def expression():
        nonlocal position
        items=[atom()];operators=[]
        while position<len(tokens) and tokens[position]!=')':
            operator=tokens[position]
            if operator not in ('AND','OR'):raise ValueError('Missing explicit operator')
            position+=1;operators.append(operator);items.append(atom())
        if len(set(operators))>1:raise ValueError('Mixed unparenthesized operators; precedence not assumed')
        return items[0] if not operators else {'type':'and' if operators[0]=='AND' else 'or','items':items}
    def atom():
        nonlocal position
        if position>=len(tokens):raise ValueError('Missing operand')
        token=tokens[position];position+=1
        if token=='(':
            value=expression()
            if position>=len(tokens) or tokens[position]!=')':raise ValueError('Unbalanced parentheses')
            position+=1;return value
        if re.fullmatch(r'\d{8}',token):return {'type':'course','courseId':token,'relation':'strong'}
        raise ValueError('Invalid operand '+token)
    result=expression()
    if position!=len(tokens):raise ValueError('Unconsumed prerequisite tokens')
    return result

def strong_component(rule):
    if not rule:return None
    if rule.get('type')=='course':return rule if rule.get('relation')=='strong' else None
    children=[strong_component(child) for child in rule.get('items',[])]
    if rule.get('type')=='or' and any(child is None for child in children) and any(child is not None for child in children):raise ValueError('Mixed concurrent/strong OR needs full relationship authority')
    children=[child for child in children if child is not None]
    return None if not children else children[0] if len(children)==1 else {'type':rule['type'],'items':children}

def monotone_dnf(rule,limit=2048):
    def minimize(terms):
        bounded=set()
        for term in terms:
            bounded.add(term)
            if len(bounded)>limit:raise ValueError('Boolean expansion exceeds audit limit')
        terms=bounded
        ordered=sorted(terms,key=lambda term:(len(term),sorted(term)));result=[]
        for term in ordered:
            if not any(kept<=term for kept in result):result.append(term)
        return frozenset(result)
    if rule is None:return frozenset([frozenset()])
    if rule['type']=='course':return frozenset([frozenset([rule['courseId']])])
    children=[monotone_dnf(child,limit) for child in rule.get('items',[])]
    if rule['type']=='or':return minimize(term for child in children for term in child)
    if rule['type']=='and':
        result=frozenset([frozenset()])
        for child in children:result=minimize(a|b for a in result for b in child)
        return result
    raise ValueError('Unsupported runtime prerequisite operator')
def compare_official(records,manifest,root):
    by_term={};duplicates=[]
    for source in manifest.get('sources',[]):
        if source.get('status')!='retrieved':continue
        path=root/source['relativeFile']
        if not path.exists() or digest(path)!=source.get('sha256'):raise ValueError('Official response checksum mismatch: '+source['term'])
        raw=json.loads(path.read_text(encoding='utf8'));index=defaultdict(list)
        for row_index,row in enumerate(raw['d']['results']):
            match=re.fullmatch(r'SM(\d{8})',row.get('Otjid',''))
            if match:index[match.group(1)].append((row_index,row))
        for cid,rows in index.items():
            if len(rows)>1:duplicates.append({'term':source['term'],'courseId':cid,'recordCount':len(rows)})
        by_term[source['term']]=(index,source)
    results=[]
    for course in records:
        cid=course['id'];term=course.get('source',{}).get('term')
        result={'courseId':cid,'runtimeSourceTerm':term,'catalogOnly':bool(course.get('catalogOnly')),'metadata':{},'strongPrerequisites':{'status':'unverified'},'concurrentPrerequisites':{'status':'unverified','reason':'These requests do not establish concurrent relationship semantics.'}}
        if term not in by_term or cid not in by_term[term][0]:
            result['status']='unverified_no_matching_term_record';result['availableOtherTerms']=[key for key,(index,_) in by_term.items() if cid in index];result['reason']='No official record for the exact runtime source term. Other years are not substituted. Absence is not proof of nonexistence.';results.append(result);continue
        matches,source=by_term[term][0][cid],by_term[term][1]
        if len(matches)!=1:
            result.update(status='unverified_duplicate_official_records',reason='Duplicate official records are not chosen automatically.');results.append(result);continue
        row_index,official=matches[0];result['status']='official_matching_term_available'
        result['evidence']={'term':term,'url':source['url'],'responseSha256':source['sha256'],'responsePointer':f'/d/results/{row_index}','officialRecordUrl':official.get('__metadata',{}).get('uri'),'retrievedAt':source['checkedAt']}
        expected={'name':official.get('Name'),'credits':float(official['Points']) if official.get('Points') not in (None,'') else None,'faculty':official.get('OrgText')}
        for field,value in expected.items():
            actual=course.get(field)
            match=abs(actual-value)<1e-8 if field=='credits' and isinstance(actual,(int,float)) and isinstance(value,(int,float)) else normalized(actual)==normalized(value)
            result['metadata'][field]={'expected':value,'actual':actual,'status':'confirmed_correct' if match else ('unresolved_discrepancy' if field=='faculty' else 'confirmed_incorrect'),'type':'same_term_official_field_match' if match else 'same_term_official_metadata_difference','severity':'medium' if field=='credits' else 'low','limitation':'Current official value in the same term; differences may reflect later official corrections.'}
        rows=official.get('SmPrereq',{}).get('results')
        if rows is None:result['strongPrerequisites']={'status':'unverified','reason':'Official prerequisite navigation was not expanded.'}
        else:
            try:
                expected_rule=parse_official_strong(rows);actual_rule=strong_component(course.get('requirements'))
                if course.get('requirementsStatus') in ('unknown','unparsed'):
                    result['strongPrerequisites']={'status':'unverified','reason':'Runtime explicitly marks prerequisites unknown/unparsed; no semantic judgement inferred.','officialRowCount':len(rows),'expected':expected_rule}
                else:
                    def ids(rule):
                        if not rule:return set()
                        if rule.get('type')=='course':return {rule['courseId']}
                        return set().union(*(ids(child) for child in rule.get('items',[])))
                    boolean_match=monotone_dnf(expected_rule)==monotone_dnf(actual_rule)
                    reference_match=ids(expected_rule)==ids(actual_rule)
                    match=boolean_match and reference_match
                    result['strongPrerequisites']={'status':'confirmed_correct' if match else ('unresolved_discrepancy' if not rows and actual_rule is not None else 'confirmed_incorrect'),'expected':expected_rule,'actual':actual_rule,'officialRowCount':len(rows),'type':'same_term_strong_logic_match' if match else 'same_term_strong_logic_difference','severity':'high','booleanEquivalent':boolean_match,'referencedCourseIdsMatch':reference_match,'logicComparison':'Independent explicit-operator parser, monotone Boolean DNF equivalence and exact strong-course reference set.','limitation':'Only structured strong prerequisites. Empty fields do not guarantee unrestricted enrollment.'}
            except (ValueError,KeyError,TypeError) as error:result['strongPrerequisites']={'status':'unverified','reason':str(error),'officialRowCount':len(rows)}
        results.append(result)
    metadata_counts=Counter(item['status'] for row in results for item in row['metadata'].values());prerequisite_counts=Counter(row['strongPrerequisites']['status'] for row in results)
    summary={'runtimeCourseRecords':len(records),'exactTermOfficialRecordsFound':sum(row['status']=='official_matching_term_available' for row in results),'metadataFieldsCompared':sum(metadata_counts.values()),'metadataFieldMatches':metadata_counts['confirmed_correct'],'metadataFieldDifferences':metadata_counts['confirmed_incorrect']+metadata_counts['unresolved_discrepancy'],'metadataConfirmedDifferences':metadata_counts['confirmed_incorrect'],'metadataUnresolvedLabelDifferences':metadata_counts['unresolved_discrepancy'],'strongPrerequisiteRecordsCompared':prerequisite_counts['confirmed_correct']+prerequisite_counts['confirmed_incorrect'],'strongPrerequisiteRecordMatches':prerequisite_counts['confirmed_correct'],'strongPrerequisiteRecordDifferences':prerequisite_counts['confirmed_incorrect'],'strongPrerequisiteObservedDifferences':prerequisite_counts['confirmed_incorrect']+prerequisite_counts['unresolved_discrepancy'],'strongPrerequisiteUnresolvedHistoricalDifferences':prerequisite_counts['unresolved_discrepancy'],'strongPrerequisiteRecordsUnverified':prerequisite_counts['unverified']+prerequisite_counts['unresolved_discrepancy'],'concurrentPrerequisiteRecordsVerified':0,'officialDuplicateIdentifiers':len(duplicates),'note':'Separate from curriculum coverage. Every record compared only with its own term.'}
    return {'summary':summary,'sources':manifest.get('sources',[]),'duplicates':duplicates,'records':results}