"""Primary-source regression checks, separate from application/importer helpers."""
import hashlib,json,sys,unittest
from pathlib import Path
REPO=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(REPO/'scripts/curriculum-audit'))
from official_compare import parse_official_strong,monotone_dnf,strong_component

def read(path):return json.loads((REPO/path).read_text(encoding='utf8'))

class IndependentRepairSourceTests(unittest.TestCase):
    def test_official_response_and_term_are_pinned(self):
        correction=read('data/course-corrections.json')[0]
        raw=(REPO/correction['evidenceFile']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),correction['source']['sha256'])
        records=json.loads(raw)['d']['results'];self.assertEqual(len(records),1)
        self.assertEqual(records[0]['Otjid'],'SM00540417')
        self.assertIn("Peryr='2026',Perid='200'",records[0]['__metadata']['uri'])

    def test_runtime_and_declared_override_match_independently_parsed_official_rule(self):
        correction=read('data/course-corrections.json')[0]
        source=read(correction['evidenceFile'])['d']['results'][0]
        expected=parse_official_strong(source['SmPrereq']['results'])
        runtime=next(c for c in read('public/data/courses.json')['courses'] if c['id']=='00540417')
        self.assertEqual(monotone_dnf(expected),monotone_dnf(strong_component(runtime['requirements'])))
        self.assertEqual(correction['requirements'],expected)
        self.assertEqual(len(monotone_dnf(expected)),4)
        self.assertNotEqual(monotone_dnf(expected),monotone_dnf(correction['expectedInputRequirements']))

    def test_every_repaired_catalog_fact_has_independent_source_and_explicit_runtime_membership(self):
        evidence=read('audits/curriculum-repairs/evidence/catalog-verification.json')
        catalog=read('public/data/catalogs.json')
        self.assertEqual(evidence['pdfSha256'],'aff2590a80708d6df4ef4cbbb9b429677f6814beebe84441dba7f69075e339f3')
        for fact in evidence['observations']:
            self.assertTrue(fact['visuallyRechecked'])
            self.assertTrue(all(any(p['pdfPage']==page for p in evidence['independentTextEvidence']) for page in fact['pages']))
            for path in fact['paths']:
                program=next(p for p in catalog['programs'] if p['id']==path+'-2025-2026')
                eligible=set(program['mandatoryCourseIds']+program['additionalEligibleCourseIds'])
                eligible.update(c for g in program['electiveGroups'] for c in g['courseIds'])
                for course in fact['courseIds']:self.assertIn(course,eligible,f'{path}/{course}')

if __name__=='__main__':unittest.main()