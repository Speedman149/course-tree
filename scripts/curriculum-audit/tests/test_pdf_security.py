"""Security regressions for the isolated, maintainer-only PDF tool."""
import gzip
import os
import pickle
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extract_source import extract
from pdfminer.cmapdb import CMapDB


class PDFSecurityTests(unittest.TestCase):
    def test_stale_parser_is_refused_before_reading_any_pdf(self):
        with patch('extract_source.version', return_value='20250506'):
            with self.assertRaisesRegex(SystemExit, 'Update the PDF audit environment'):
                extract(Path('must-not-be-read.pdf'), Path('must-not-be-written.json'))

    def test_external_pickle_cmap_is_never_deserialized(self):
        # The canary is ordinary data. Any pickle deserialization fails the test.
        with tempfile.TemporaryDirectory(prefix='course-tree-cmap-test-') as directory:
            with gzip.open(Path(directory) / 'CourseTreeSecurityCanary.pickle.gz', 'wb') as handle:
                pickle.dump({'CODE2CID': {}, 'IS_VERTICAL': False}, handle)
            with patch.dict(os.environ, {'CMAP_PATH': directory}):
                with patch('pickle.loads', side_effect=AssertionError('Unsafe pickle load')) as loads:
                    with self.assertRaises(CMapDB.CMapNotFound):
                        CMapDB.get_cmap('CourseTreeSecurityCanary')
                    loads.assert_not_called()
