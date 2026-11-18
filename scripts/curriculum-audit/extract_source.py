#!/usr/bin/env python3
"""Independent geometry extraction. No importer, selector, alias or coverage inputs.
PDF text/geometry is evidence of occurrence, never proof of curriculum membership.
"""
import argparse,hashlib,json,re,sys
from pathlib import Path
from importlib.metadata import version
import pdfplumber

HEBREW=re.compile(r'[\u0590-\u05ff]')
ID_PATTERN=re.compile(r'(?<!\d)\d{6,9}(?!\d)')
def display_word(text):
    return text[::-1] if HEBREW.search(text) else text

def group_rows(words,tolerance=2.2):
    rows=[]
    for word in sorted(words,key=lambda w:(w['top'],w['x0'])):
        candidates=[row for row in rows[-4:] if abs(row['top']-word['top'])<=tolerance]
        if candidates:row=min(candidates,key=lambda row:abs(row['top']-word['top']))
        else:row={'top':word['top'],'bottom':word['bottom'],'words':[]};rows.append(row)
        row['words'].append(word);row['bottom']=max(row['bottom'],word['bottom'])
    result=[]
    for row in sorted(rows,key=lambda row:row['top']):
        words=sorted(row['words'],key=lambda w:w['x0'])
        visual=' '.join(word['text'] for word in words)
        rtl=' '.join(display_word(word['text']) for word in reversed(words))
        # Reconstruct separated number glyphs only within a tightly aligned digit run.
        number_runs=[];run=[]
        for word in words:
            if re.fullmatch(r'\d+',word['text']):
                if run and word['x0']-run[-1]['x1']>2.4: number_runs.append(run);run=[]
                run.append(word)
            elif run:number_runs.append(run);run=[]
        if run:number_runs.append(run)
        ids=[]
        for number_run in number_runs:
            token=''.join(word['text'] for word in number_run)
            if 6<=len(token)<=9:ids.append({'printedId':token,'bbox':[round(number_run[0]['x0'],2),round(row['top'],2),round(number_run[-1]['x1'],2),round(row['bottom'],2)],'reconstructed':len(number_run)>1})
        # Whole word IDs with punctuation are preserved without interpreting aliases.
        for word in words:
            for match in ID_PATTERN.finditer(word['text']):
                if not any(item['printedId']==match.group() for item in ids):ids.append({'printedId':match.group(),'bbox':[round(word['x0'],2),round(row['top'],2),round(word['x1'],2),round(row['bottom'],2)],'reconstructed':False})
        result.append({'bbox':[round(min(word['x0'] for word in words),2),round(row['top'],2),round(max(word['x1'] for word in words),2),round(row['bottom'],2)],'visualText':visual,'text':rtl,'ids':ids,'words':[{key:round(word[key],2) if key!='text' else word[key] for key in ['text','x0','x1','top','bottom']} for word in words]})
    return result

def extract(pdf_path,output):
    parser_version=re.match(r"^(\d{8})(?:$|[.+-])",version("pdfminer.six"))
    if not parser_version or int(parser_version.group(1))<20251230:
        raise SystemExit("Update the PDF audit environment using scripts/curriculum-audit/requirements.txt before processing PDFs.")
    raw=pdf_path.read_bytes();result={'schemaVersion':1,'sourcePdf':pdf_path.name,'sha256':hashlib.sha256(raw).hexdigest(),'engine':{'name':'pdfplumber/pdfminer.six','version':pdfplumber.__version__},'independence':'Read original PDF only; no importer cache, classifications, aliases, selectors or coverage report read.','pages':[]}
    with pdfplumber.open(pdf_path) as pdf:
        result['pageCount']=len(pdf.pages)
        for index,page in enumerate(pdf.pages):
            record={'pdfPage':index+1,'width':float(page.width),'height':float(page.height),'columns':{},'extractionStatus':'text-extracted-not-semantically-verified'}
            try:
                words=page.dedupe_chars(tolerance=0.5).extract_words(x_tolerance=1.0,y_tolerance=2.0,keep_blank_chars=False)
                mid=float(page.width)/2
                for side,pool in [('L',[word for word in words if (word['x0']+word['x1'])/2<mid]),('R',[word for word in words if (word['x0']+word['x1'])/2>=mid])]:record['columns'][side]=group_rows(pool)
                if len(words)<5:record['extractionStatus']='no-or-insufficient-text-manual-review-required'
            except Exception as error:record.update(extractionStatus='extraction-failed-manual-review-required',error=f'{type(error).__name__}: {error}')
            result['pages'].append(record)
            page.close()
            if (index+1)%25==0:print(f'{index+1}/{len(pdf.pages)} pages independently extracted',flush=True)
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    text_path=output.with_suffix('.txt')
    text_path.write_text('\n'.join(f"\n=== PDF {page['pdfPage']} {side} ===\n"+'\n'.join(f"y={row['bbox'][1]:.2f} {row['text']}" for row in rows) for page in result['pages'] for side,rows in page['columns'].items()),encoding='utf8')
    print(json.dumps({'pdfPageCount':result['pageCount'],'sha256':result['sha256'],'output':str(output),'text':str(text_path)},ensure_ascii=False),flush=True)
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--pdf',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();extract(args.pdf,args.output)