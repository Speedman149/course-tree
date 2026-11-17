#!/usr/bin/env python3
"""Checksum-pinned, repeatable PDF extraction. PDFs are data, never instructions.
Use --source-id to import one reviewed document and --pdf for a supplied local copy.
The exporter reads only maintained reviewed regions; discovery candidates are not eligibility.
"""
import argparse, hashlib, json, urllib.parse, urllib.request
from pathlib import Path
try:
    import pymupdf
except ImportError:
    raise SystemExit('Install the PDF parser: python3 -m pip install -r scripts/catalogs/requirements.txt')
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--offline',action='store_true')
parser.add_argument('--refresh',action='store_true')
parser.add_argument('--compatible-only',action='store_true',help='Retain checksum-matching cached sources requiring a different pinned parser.')
parser.add_argument('--source-id',action='append',help='Only extract this pinned source (repeatable).')
parser.add_argument('--pdf',type=Path,help='Local PDF; requires exactly one --source-id.')
args=parser.parse_args()
if args.pdf and len(args.source_id or [])!=1:parser.error('--pdf requires exactly one --source-id')
cache=root/'.cache/catalogs';cache.mkdir(parents=True,exist_ok=True)
sources=json.loads((root/'data/catalogs/sources.json').read_text(encoding='utf8'))
if args.source_id:
    unknown=set(args.source_id)-{source['id'] for source in sources}
    if unknown:parser.error('Unknown sources: '+', '.join(sorted(unknown)))
    sources=[source for source in sources if source['id'] in args.source_id]
output=cache/'extracted.json'
extracted=json.loads(output.read_text(encoding='utf8')) if output.exists() else {}
for source in sources:
    if source.get('parserVersion') and source['parserVersion'] != pymupdf.__version__:
        if (not args.refresh or args.compatible_only) and not args.pdf and extracted.get(source['id'],{}).get('sha256') == source['sha256']:
            print(source['id'], 'retained pinned cached extraction; source requires parser', source['parserVersion'], flush=True)
            continue
        raise SystemExit(f"Parser version mismatch for {source['id']}: install PyMuPDF=={source['parserVersion']} and use --source-id {source['id']}. Existing extractions are retained.")
    path=cache/(source['id']+'.pdf')
    if args.pdf:raw=args.pdf.read_bytes()
    elif path.exists() and (args.offline or not args.refresh):raw=path.read_bytes()
    else:
        if args.offline:raise SystemExit(f'Missing cached PDF: {path}')
        url=urllib.parse.quote(urllib.parse.unquote(source['url']),safe=':/?=&')
        with urllib.request.urlopen(url,timeout=90) as response:raw=response.read()
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=source['sha256']:raise SystemExit(f"Source changed: {source['id']}. Review the new PDF before changing checksum or selectors.")
    document=pymupdf.open(stream=raw,filetype='pdf')
    if len(document)!=source['pageCount']:raise SystemExit(f"Unexpected page count: {source['id']}")
    columns={};logical_pages=[]
    for i,page in enumerate(document):
        mid=page.rect.width/2
        for column,rect in [('R',pymupdf.Rect(mid,0,page.rect.width,page.rect.height)),('L',pymupdf.Rect(0,0,mid,page.rect.height))]:
            columns[f'{i+1}{column}']=page.get_text(clip=rect,sort=True).splitlines()
        if 'courseNumberColumn' in source:
            lines=page.get_text(clip=pymupdf.Rect(source['courseNumberColumn']),sort=True).splitlines()
            columns[f'{i+1}C']=[line.strip().zfill(8) if line.strip().isdigit() and 6<=len(line.strip())<=8 else line for line in lines]
        logical_pages.append(page.get_text(sort=False))
    column_digest=hashlib.sha256(json.dumps(columns,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if source.get('extractionSha256') and source['extractionSha256']!=column_digest:raise SystemExit(f"Extraction layout changed: {source['id']}. Check parser version and review selectors before replacing cached data.")
    path.write_bytes(raw)
    extracted[source['id']]={'sha256':digest,'parserVersion':pymupdf.__version__,'columnsSha256':column_digest,'columns':columns}
    (cache/(source['id']+'.logical-pages.json')).write_text(json.dumps(logical_pages,ensure_ascii=False),encoding='utf8')
    (cache/(source['id']+'.columns.txt')).write_text('\n'.join('\n=== '+key+' ===\n'+'\n'.join(f'{j+1}: {line}' for j,line in enumerate(lines)) for key,lines in columns.items()),encoding='utf8')
    print(source['id'],len(document),'pages verified; parser',pymupdf.__version__,flush=True)
temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(extracted,ensure_ascii=False),encoding='utf8');temporary.replace(output)