"""PixelPath — local-only model API used by the Electron shell.
Run directly with ``python backend/app.py`` for backend development.
"""
from __future__ import annotations
import csv
import io
import json
import os
import re
import shutil
import socket
import sys
import threading
import uuid
import webbrowser
import mimetypes
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from engine import from_schem, load_csv, model_from_pieces

BUNDLE_ROOT=Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent))
ROOT=Path(__file__).resolve().parent
PROJECT_ROOT=ROOT.parent
if os.environ.get('PIXELPATH_DATA') or os.environ.get('VOXEL_STUDIO_DATA'):
    DATA=Path(os.environ.get('PIXELPATH_DATA') or os.environ['VOXEL_STUDIO_DATA']).resolve()
elif os.name=='nt':
    DATA=Path(os.environ.get('LOCALAPPDATA') or (Path.home()/'AppData'/'Local'))/'PixelPath'
else:
    DATA=Path.home()/'.pixelpath'
MODELS=DATA/'models'
WEB=(BUNDLE_ROOT/'web') if getattr(sys,'frozen',False) else (PROJECT_ROOT/'web')
SEED=(BUNDLE_ROOT/'seed') if getattr(sys,'frozen',False) else (ROOT/'seed')
MAX_UPLOAD=30*1024*1024

def safe_id(value):
    if not re.fullmatch(r'[0-9a-f]{32}',str(value)):raise ValueError('Geçersiz model kimliği')
    return str(value)

def model_dir(mid):return MODELS/safe_id(mid)
def get_metadata(mid):
    with (model_dir(mid)/'metadata.json').open(encoding='utf-8') as f:return json.load(f)
def set_metadata(mid,meta):
    (model_dir(mid)/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
def get_model(mid):
    with (model_dir(mid)/'model.json').open(encoding='utf-8') as f:return json.load(f)
def save_model(mid,model,meta):
    model_dir(mid).mkdir(parents=True,exist_ok=True)
    (model_dir(mid)/'model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    meta.update({key:model[key] for key in ('name','factor','cube_cm','algorithm','piece_count','dimensions','warnings')})
    set_metadata(mid,meta)

def seed_library():
    MODELS.mkdir(parents=True,exist_ok=True)
    marker=DATA/'installed.txt'
    if marker.exists():return
    sample=SEED/'fluttershy_pieces.csv'
    if sample.exists():
        mid=uuid.uuid4().hex
        items=load_csv(sample.read_bytes())
        model=model_from_pieces(items,'Fluttershy',5,2.0,source_blocks=14518,source_dims=[50,66,80])
        meta={'id':mid,'source':'schem','created_at':datetime.now().isoformat(timespec='seconds'),'last_step':1,
              'original_filename':'fluttershy.schem'}
        save_model(mid,model,meta)
        shutil.copyfile(sample,model_dir(mid)/'original.csv')
        schem=SEED/'fluttershy.schem'
        if schem.exists():shutil.copyfile(schem,model_dir(mid)/'source.schem')
    marker.write_text('v1',encoding='utf-8')

def summaries():
    result=[]
    for f in MODELS.glob('*/metadata.json'):
        try:result.append(json.loads(f.read_text(encoding='utf-8')))
        except (OSError,ValueError):continue
    return sorted(result,key=lambda a:a.get('created_at',''),reverse=True)

def parse_options(q,default_name='Yeni Model'):
    factor=int(q.get('factor',['5'])[0]);cube_cm=float(q.get('cube_cm',['2'])[0])
    algorithm=str(q.get('algorithm',['cube'])[0])
    name=str(q.get('name',[default_name])[0]).strip()[:90] or default_name
    if not 1<=factor<=15:raise ValueError('Sadeleştirme değeri 1–15 arasında olmalı')
    if not .2<=cube_cm<=20:raise ValueError('Küp kenarı 0,2–20 cm arasında olmalı')
    if algorithm not in ('cube','cuboid'):raise ValueError('Geçersiz parça algoritması')
    return factor,cube_cm,name,algorithm

class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,fmt,*args):pass
    def send_data(self,data,mime='application/json',code=200):
        if isinstance(data,(dict,list)):data=json.dumps(data,ensure_ascii=False).encode('utf-8')
        elif isinstance(data,str):data=data.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type',mime+'; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers()
        self.wfile.write(data)
    def fail(self,err,code=400):self.send_data({'error':str(err)},code=code)
    def read_body(self):
        size=int(self.headers.get('Content-Length','0'))
        if size<=0 or size>MAX_UPLOAD:raise ValueError('Dosya boş veya 30 MB sınırını aşıyor')
        return self.rfile.read(size)
    def do_GET(self):
        path=urlsplit(self.path).path
        try:
            if path=='/api/health':return self.send_data({'app':'PixelPath','status':'ok'})
            if path=='/api/models':return self.send_data({'models':summaries()})
            if path.startswith('/api/models/'):
                parts=path.strip('/').split('/')
                if len(parts)==3:
                    mid=safe_id(parts[2]);m=get_model(mid);m['id']=mid;m['last_step']=get_metadata(mid).get('last_step',1)
                    return self.send_data(m)
                if len(parts)==4 and parts[3]=='export.csv':
                    mid=safe_id(parts[2]);m=get_model(mid)
                    s=io.StringIO();w=csv.writer(s)
                    w.writerow(['adim','parca_id','x','y','z','x_birim','y_birim','z_birim','x_cm','y_cm','z_cm','renk','baglanacak_parca','yapistirma_yuzu'])
                    for p in m['pieces']:
                        size=p.get('size',1);sx=p.get('sx',size);sy=p.get('sy',size);sz=p.get('sz',size)
                        w.writerow([p['step'],p['id'],p['x'],p['y'],p['z'],sx,sy,sz,sx*m['cube_cm'],sy*m['cube_cm'],sz*m['cube_cm'],p['color'],p['anchor'],p['face']])
                    return self.send_data('\ufeff'+s.getvalue(),'text/csv')
            # Vite fingerprints production assets, so serve files from the web
            # directory without hard-coding bundle names. resolve() prevents
            # traversal outside the local frontend directory.
            filename='index.html' if path in ('/','/index.html') else path.lstrip('/')
            candidate=(WEB/filename).resolve()
            if candidate.is_relative_to(WEB.resolve()) and candidate.is_file():
                mime=mimetypes.guess_type(candidate.name)[0] or 'application/octet-stream'
                return self.send_data(candidate.read_bytes(),mime)
            self.fail('Bulunamadı',404)
        except (OSError,ValueError,KeyError) as e:self.fail(e,404)
    def do_POST(self):
        parsed=urlsplit(self.path);path=parsed.path
        try:
            if path=='/api/models/import':
                q=parse_qs(parsed.query);name=q.get('name',['Yeni Model'])[0]
                factor,cube_cm,name,algorithm=parse_options(q)
                filename=q.get('filename',['new.schem'])[0]
                ext=Path(filename).suffix.lower()
                data=self.read_body()
                if ext=='.schem':
                    model=from_schem(data,name,factor,cube_cm,algorithm);source='schem'
                elif ext=='.csv':
                    pieces=load_csv(data)
                    model=model_from_pieces(pieces,name,None,cube_cm,algorithm='custom');source='csv'
                else:raise ValueError('Yalnızca .schem veya V2 pieces.csv destekleniyor')
                mid=uuid.uuid4().hex
                meta={'id':mid,'source':source,'created_at':datetime.now().isoformat(timespec='seconds'),
                      'original_filename':Path(filename).name[:150],'last_step':1}
                save_model(mid,model,meta)
                (model_dir(mid)/('source.schem' if ext=='.schem' else 'original.csv')).write_bytes(data)
                return self.send_data({'id':mid,'piece_count':model['piece_count'],'warnings':model['warnings']},code=201)
            parts=path.strip('/').split('/')
            if len(parts)==4 and parts[:2]==['api','models'] and parts[3]=='settings':
                mid=safe_id(parts[2]);meta=get_metadata(mid);old=get_model(mid)
                body=json.loads(self.read_body().decode('utf-8'))
                opts={k:[str(v)] for k,v in body.items() if k in ('name','factor','cube_cm','algorithm')}
                if 'algorithm' not in opts:opts['algorithm']=[old.get('algorithm','cube')]
                if meta['source']!='schem':opts['algorithm']=['cube']
                factor,cube_cm,name,algorithm=parse_options(opts,old['name'])
                if meta['source']=='schem':
                    model=from_schem((model_dir(mid)/'source.schem').read_bytes(),name,factor,cube_cm,algorithm)
                else:
                    pieces=load_csv((model_dir(mid)/'original.csv').read_bytes())
                    model=model_from_pieces(pieces,name,None,cube_cm,algorithm='custom')
                meta['last_step']=1
                save_model(mid,model,meta)
                return self.send_data({'id':mid,'piece_count':model['piece_count'],'warnings':model['warnings']})
            if len(parts)==4 and parts[:2]==['api','models'] and parts[3]=='progress':
                mid=safe_id(parts[2]);body=json.loads(self.read_body().decode('utf-8'))
                meta=get_metadata(mid);model=get_model(mid)
                meta['last_step']=min(model['piece_count'],max(1,int(body['step'])))
                set_metadata(mid,meta)
                return self.send_data({'ok':True,'step':meta['last_step']})
            self.fail('Geçersiz işlem',404)
        except Exception as e:self.fail(e)
    def do_DELETE(self):
        try:
            parts=urlsplit(self.path).path.strip('/').split('/')
            if len(parts)!=3 or parts[:2]!=['api','models']:return self.fail('Geçersiz işlem',404)
            mid=safe_id(parts[2]);get_metadata(mid)
            shutil.rmtree(model_dir(mid));self.send_data({'ok':True})
        except Exception as e:self.fail(e)

def launch_window(addr):
    """Open Chrome in a dedicated window if available, else default browser."""
    import subprocess
    if sys.platform=='win32':
        candidates=[Path(os.environ.get('PROGRAMFILES',r'C:\Program Files'))/'Google'/'Chrome'/'Application'/'chrome.exe',
                    Path(os.environ.get('PROGRAMFILES(X86)',r'C:\Program Files (x86)'))/'Google'/'Chrome'/'Application'/'chrome.exe',
                    Path(os.environ.get('LOCALAPPDATA',''))/'Google'/'Chrome'/'Application'/'chrome.exe']
        for exe in candidates:
            if exe.is_file():
                try:
                    subprocess.Popen([str(exe),f'--app={addr}','--window-size=1480,900'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                    return
                except OSError:pass
    webbrowser.open(addr)

def serve(port=8765, open_window=True):
    import urllib.request
    seed_library()
    # Reopen an already running instance instead of silently multiplying servers.
    if port:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=.5) as r:
                if json.load(r).get('app')=='PixelPath':
                    if open_window:launch_window(f'http://127.0.0.1:{port}')
                    return
        except (OSError,ValueError):pass
    try:srv=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    except OSError:
        # If another program already owns the default port, use an available port.
        srv=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    addr=f'http://127.0.0.1:{srv.server_address[1]}'
    print('PIXELPATH_READY '+addr,flush=True)
    print('Data directory:',DATA,flush=True)
    if open_window:
        def delayed_open():
            import time
            time.sleep(.5)
            launch_window(addr)
        threading.Thread(target=delayed_open,daemon=True).start()
    try:srv.serve_forever()
    except KeyboardInterrupt:pass
    finally:srv.server_close()

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='PixelPath local backend')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--no-open',action='store_true')
    args=parser.parse_args()
    try:serve(port=args.port,open_window=not args.no_open)
    except Exception:
        import traceback
        (ROOT/'hata.log').write_text(traceback.format_exc(),encoding='utf-8')
        raise
