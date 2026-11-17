import sys,json,unittest,tempfile,hashlib
from pathlib import Path
from copy import deepcopy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from audit_engine import structural_checks,internal_checks,build_claims,apply_assertions,evidence_gate,canonical
from official_compare import parse_official_strong,monotone_dnf,strong_component,compare_official

SHA='a'*64
A='01000001';B='01000002';C='01000003'
def course(cid):return {'type':'course','courseId':cid,'relation':'strong'}
def node(op,*items):return {'type':op,'items':list(items)}
def fixture():
 p={'id':'sample-2025-2026','programId':'sample','officialName':'Sample','catalogYear':'2025-2026','degreeType':'B.Sc.','facultyIds':['test'],'mandatoryCourseIds':[A],'additionalEligibleCourseIds':[],'electiveGroups':[{'id':'choices','role':'mandatory-choice','courseIds':[B,C],'minimumCourses':1,'conditions':[],'rules':[],'sourceRefs':[]}],'requirementRules':[],'sourceRefs':[{'sourceId':'pdf','pages':[1]}],'coverage':{'status':'verified-listed'}}
 catalog={'programs':[p],'sources':[{'id':'pdf','catalogYear':'2025-2026','pageCount':1}],'referencedCourses':[]}
 courses={'courses':[{'id':cid,'name':'Name','faculty':'Test','credits':3,'requirementsStatus':'none','requirements':None,'source':{'term':'2025_200'}} for cid in [A,B,C]]}
 source={'sha256':SHA,'pages':[{'pdfPage':1,'extractionStatus':'text-extracted-not-semantically-verified','columns':{'R':[{'text':'Mandatory courses '+A+' and permitted alternative courses '+B+' or '+C}]}}]}
 return p,catalog,courses,source

def assertion(kind,**values):
 return {'id':'independent-fact','pathIds':['sample-2025-2026'],'kind':kind,'mode':'contains','confidence':'high','evidence':[{'pdfPage':1,'printedPage':1,'quote':'Mandatory courses '+A,'explanation':'Original mandatory heading and its course row independently reviewed.'}],**values}

def audit(p,source,fact):
 claims=build_claims([p]);findings,_=apply_assertions([p],claims,[{'sourcePdfSha256':SHA,'assertions':[fact]}],source);return claims,findings

class StructuralValidation(unittest.TestCase):
 def test_duplicate_course_records_fail_structure(self):
  p,c,d,s=fixture();d['courses'].append(deepcopy(d['courses'][0]));self.assertTrue(any(not row['passed'] for row in structural_checks(c,d) if row['code']=='course_record_ids_unique'))
 def test_cross_year_reference_fails_structure(self):
  p,c,d,s=fixture();c['sources'][0]['catalogYear']='2026-2027';self.assertTrue(any(not row['passed'] for row in structural_checks(c,d) if row['code']=='reference_year_and_page_bounds'))
 def test_numeric_or_wrong_width_ids_fail_structure(self):
  p,c,d,s=fixture();p['mandatoryCourseIds']=[123];self.assertTrue(any(not row['passed'] for row in structural_checks(c,d) if row['code']=='course_ids_are_strings'))
 def test_structural_pass_never_verifies_academic_claim(self):
  p,c,d,s=fixture();self.assertTrue(all(row['passed'] for row in structural_checks(c,d)));self.assertTrue(all(row['status']=='unverified' for row in build_claims([p]).values()))

class InternalConsistencyValidation(unittest.TestCase):
 def test_choice_overlap_is_warning_not_source_error(self):
  p,c,d,s=fixture();p['mandatoryCourseIds'].append(B);checks,_=internal_checks(c,d);self.assertTrue(any(not row['passed'] for row in checks));self.assertTrue(all(not row['sourceVerified'] for row in checks))
 def test_missing_record_is_not_proof_course_nonexistent(self):
  p,c,d,s=fixture();p['mandatoryCourseIds'].append('09999999');checks,_=internal_checks(c,d);self.assertTrue(any(not row['passed'] for row in checks if row['code']=='all_curriculum_ids_have_runtime_records'))
 def test_impossible_minimum_fails_internal_check(self):
  p,c,d,s=fixture();p['electiveGroups'][0]['minimumCourses']=4;checks,_=internal_checks(c,d);self.assertTrue(any(not row['passed'] for row in checks if row['code']=='group_minimum_not_larger_than_pool'))

class IndependentSourceComparison(unittest.TestCase):
 def test_missing_source_mandatory_detected(self):
  p,c,d,s=fixture();claims,findings=audit(p,s,assertion('mandatory',expectedCourseIds=[B]));self.assertEqual(claims[p['id']+'|mandatory|'+B]['status'],'confirmed_incorrect')
 def test_source_positive_is_narrow_not_whole_degree(self):
  p,c,d,s=fixture();claims,_=audit(p,s,assertion('mandatory',expectedCourseIds=[A]));self.assertEqual(claims[p['id']+'|mandatory|'+A]['status'],'confirmed_correct');self.assertEqual(claims[p['id']+'|complete-mandatory']['status'],'unverified')
 def test_wrong_extra_group_course_detected(self):
  p,c,d,s=fixture();fact=assertion('group',groupId='choices',mode='exact',expectedCourseIds=[B]);claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|group|choices|member|'+C]['status'],'confirmed_incorrect')
 def test_credit_constraint_compared_separately(self):
  p,c,d,s=fixture();p['electiveGroups'][0]['creditsMin']=4;fact=assertion('group',groupId='choices',expectedCourseIds=[B,C],expectedMinimumCredits=6);claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|group|choices|creditsMin']['expected'],6)
 def test_equivalent_one_of_group_not_falsely_missing_ast(self):
  p,c,d,s=fixture();fact=assertion('rule',expected={'type':'any','items':[{'type':'course','courseId':B},{'type':'course','courseId':C}]});claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|semantic|independent-fact']['status'],'confirmed_correct')
 def test_syntactic_difference_alone_not_confirmed_error(self):
  p,c,d,s=fixture();fact=assertion('rule',expected={'type':'all','items':[{'type':'course','courseId':B},{'type':'course','courseId':C}]});claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|semantic|independent-fact']['status'],'unresolved_discrepancy')
 def test_conflicting_review_facts_not_counted_correct(self):
  p,c,d,s=fixture();one=assertion('mandatory',expectedCourseIds=[A]);two=assertion('not-mandatory',id='conflicting-fact',expectedCourseIds=[A]);claims=build_claims([p]);apply_assertions([p],claims,[{'sourcePdfSha256':SHA,'assertions':[one,two]}],s);self.assertEqual(claims[p['id']+'|mandatory|'+A]['status'],'unresolved_discrepancy')

class ManualReviewRequired(unittest.TestCase):
 def test_identifier_occurrence_is_not_role_evidence(self):
  p,c,d,s=fixture();fact=assertion('mandatory',expectedCourseIds=[A]);fact['evidence'][0]['quote']=A;self.assertFalse(evidence_gate(fact,s)[0])
 def test_missing_evidence_is_unverified_not_match(self):
  p,c,d,s=fixture();fact=assertion('mandatory',expectedCourseIds=[A],evidence=[]);claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|mandatory|'+A]['status'],'unverified')
 def test_wrong_pdf_hash_never_confirms(self):
  p,c,d,s=fixture();claims=build_claims([p]);apply_assertions([p],claims,[{'sourcePdfSha256':'wrong','assertions':[assertion('mandatory',expectedCourseIds=[A])]}],s);self.assertEqual(claims[p['id']+'|mandatory|'+A]['status'],'unverified')
 def test_failed_extraction_requires_manual_review(self):
  p,c,d,s=fixture();s['pages'][0]['extractionStatus']='extraction-failed-manual-review-required';self.assertFalse(evidence_gate(assertion('mandatory'),s)[0])
 def test_plain_prose_not_boolean_equivalence(self):
  p,c,d,s=fixture();claims,_=audit(p,s,assertion('rule',expected='One of B or C and a credit exception.'));self.assertEqual(claims[p['id']+'|semantic|independent-fact']['status'],'unresolved_discrepancy')
class OfficialAuthoritativeComparison(unittest.TestCase):
 def test_grouped_official_and_or_is_preserved(self):
  rows=[{'LineNumber':'1','Bracket':'(','ModuleId':A,'Operator':'AND'},{'LineNumber':'2','Bracket':'','ModuleId':B,'Operator':''},{'LineNumber':'3','Bracket':')','ModuleId':'00000000','Operator':'OR'},{'LineNumber':'4','Bracket':'','ModuleId':C,'Operator':''}]
  expected=node('or',node('and',course(A),course(B)),course(C));self.assertEqual(monotone_dnf(parse_official_strong(rows)),monotone_dnf(expected))
 def test_ambiguous_mixed_operators_are_rejected(self):
  rows=[{'LineNumber':'1','ModuleId':A,'Operator':'AND'},{'LineNumber':'2','ModuleId':B,'Operator':'OR'},{'LineNumber':'3','ModuleId':C}]
  with self.assertRaises(ValueError):parse_official_strong(rows)
 def test_boolean_distributive_equivalence(self):
  self.assertEqual(monotone_dnf(node('and',course(A),node('or',course(B),course(C)))),monotone_dnf(node('or',node('and',course(A),course(B)),node('and',course(A),course(C)))))
 def test_and_not_equivalent_to_or(self):
  self.assertNotEqual(monotone_dnf(node('and',course(A),course(B))),monotone_dnf(node('or',course(A),course(B))))
 def test_mixed_relation_or_not_pruned(self):
  with self.assertRaises(ValueError):strong_component(node('or',course(A),{'type':'course','courseId':B,'relation':'concurrent'}))
 def test_unknown_operator_not_guessed(self):
  with self.assertRaises(ValueError):parse_official_strong([{'LineNumber':'1','ModuleId':A,'Operator':'XOR'}])
 def test_other_year_is_never_substituted(self):
  p,c,d,s=fixture()
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);raw=json.dumps({'d':{'results':[{'Otjid':'SM'+A,'Name':'Name','Points':'3','OrgText':'Test','SmPrereq':{'results':[]}}]}}).encode();(root/'evidence.json').write_bytes(raw)
   manifest={'sources':[{'status':'retrieved','term':'2026_200','relativeFile':'evidence.json','sha256':hashlib.sha256(raw).hexdigest(),'url':'https://portalex.technion.ac.il/evidence','checkedAt':'test'}]}
   result=compare_official(d['courses'],manifest,root);self.assertEqual(result['summary']['metadataFieldsCompared'],0)
 def test_official_payload_hash_is_enforced(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'evidence.json').write_text('{}')
   with self.assertRaises(ValueError):compare_official([],{'sources':[{'status':'retrieved','term':'2025_200','relativeFile':'evidence.json','sha256':'wrong'}]},root)


class AuditScopeRegression(unittest.TestCase):
 def test_pool_exclusion_does_not_exclude_parent_degree(self):
  p,c,d,s=fixture();fact=assertion('group',groupId='choices',expectedCourseIds=[],forbiddenCourseIds=[A]);claims,_=audit(p,s,fact);self.assertEqual(claims[p['id']+'|group|choices|member|'+A]['status'],'confirmed_correct');self.assertIn(A,p['mandatoryCourseIds'])
 def test_mandatory_array_already_encodes_course_requirement(self):
  p,c,d,s=fixture();claims,_=audit(p,s,assertion('rule',expected={'type':'course','courseId':A}));self.assertEqual(claims[p['id']+'|semantic|independent-fact']['status'],'confirmed_correct')
 def test_forbidden_root_clause_checked_separately(self):
  p,c,d,s=fixture();extra={'type':'any','items':[{'type':'course','courseId':B},{'type':'course','courseId':C}]};p['requirementRules']=[extra];claims,_=audit(p,s,assertion('rule',forbiddenClause=extra,expected=False));self.assertEqual(claims[p['id']+'|semantic|independent-fact']['status'],'confirmed_incorrect')
 def official_fixture(self,actual,official):
  directory=tempfile.TemporaryDirectory();root=Path(directory.name);raw=json.dumps({'d':{'results':[official]}}).encode();(root/'evidence.json').write_bytes(raw)
  manifest={'sources':[{'status':'retrieved','term':actual['source']['term'],'relativeFile':'evidence.json','sha256':hashlib.sha256(raw).hexdigest(),'url':'https://portalex.technion.ac.il/evidence','checkedAt':'test'}]}
  result=compare_official([actual],manifest,root);directory.cleanup();return result['records'][0]
 def test_empty_historical_api_rules_are_unresolved(self):
  p,c,d,s=fixture();actual=d['courses'][0];actual.update(requirements=course(B),requirementsStatus='known');actual['source']['term']='2024_201';official={'Otjid':'SM'+A,'Name':'Name','Points':'3','OrgText':'Test','SmPrereq':{'results':[]}};result=self.official_fixture(actual,official);self.assertEqual(result['strongPrerequisites']['status'],'unresolved_discrepancy')
 def test_offering_label_change_is_not_proven_wrong_faculty(self):
  p,c,d,s=fixture();actual=d['courses'][0];official={'Otjid':'SM'+A,'Name':'Name','Points':'3','OrgText':'Renamed unit','SmPrereq':{'results':[]}};result=self.official_fixture(actual,official);self.assertEqual(result['metadata']['faculty']['status'],'unresolved_discrepancy')
 def test_credit_difference_in_same_term_is_detected(self):
  p,c,d,s=fixture();actual=d['courses'][0];official={'Otjid':'SM'+A,'Name':'Name','Points':'4','OrgText':'Test','SmPrereq':{'results':[]}};result=self.official_fixture(actual,official);self.assertEqual(result['metadata']['credits']['status'],'confirmed_incorrect')

class RepresentationScope(unittest.TestCase):
 def test_absent_numeric_field_not_automatically_wrong_minimum(self):
  p,c,d,s=fixture();p['electiveGroups'][0]['conditions']=['At least 9 credits from this group.'];claims,_=audit(p,s,assertion('group',groupId='choices',expectedCourseIds=[B,C],expectedMinimumCredits=9));self.assertEqual(claims[p['id']+'|group|choices|creditsMin']['status'],'unresolved_discrepancy')

if __name__=='__main__':unittest.main()