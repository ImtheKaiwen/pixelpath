import tempfile,subprocess,sys,os,time,json,urllib.request,urllib.parse,csv,io
from pathlib import Path
from engine import greedy_cuboid_cover
root=Path(__file__).resolve().parent

rect=greedy_cuboid_cover({(x,y,z):1 for x in range(3) for y in range(2) for z in range(4)},[3,2,4])
assert len(rect)==1 and (rect[0]['sx'],rect[0]['sy'],rect[0]['sz'])==(3,2,4)

def request(port,path,method='GET',body=None):
  req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',method=method,data=body)
  with urllib.request.urlopen(req,timeout=60) as res:
    b=res.read()
    return res.status, (json.loads(b) if res.headers.get('Content-Type','').startswith('application/json') else b)

with tempfile.TemporaryDirectory() as folder:
  import socket
  s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close()
  env={**os.environ,'PIXELPATH_DATA':folder}
  script=f"import sys;sys.path.insert(0,{str(root)!r});from app import serve;serve(port={port},open_window=False)"
  proc=subprocess.Popen([sys.executable,'-c',script],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
    for _ in range(50):
      try:st,items=request(port,'/api/models');break
      except Exception:time.sleep(.1)
    else:raise RuntimeError('Server failed start')
    assert st==200 and len(items['models'])==1,items
    mid=items['models'][0]['id']
    st,model=request(port,f'/api/models/{mid}')
    assert model['piece_count']==442 and model['cube_sizes']=={'1':423,'2':18,'3':1}
    assert model['dimensions']==[10,14,16]
    assert model['materials'] and model['pieces'][0]['step']==1
    st,html=request(port,'/');assert b'PixelPath' in html
    import re
    asset_paths=re.findall(rb'(?:src|href)="(/[^"]+\.(?:js|css))"',html)
    assert asset_paths,html[:500]
    for asset in asset_paths:
      st,content=request(port,asset.decode());assert st==200 and content
    status,data=request(port,'/api/models/'+mid+'/progress','POST',b'{"step":101}')
    assert status==200 and data['step']==101
    status,m2=request(port,f'/api/models/{mid}');assert m2['last_step']==101
    status,csvdata=request(port,f'/api/models/{mid}/export.csv');assert csvdata.startswith(b'\xef\xbb\xbf')
    print('INITIAL LIBRARY:',items['models'][0]['name'],model['piece_count'],'pieces; all 4 assets served')
    print('CSV export bytes',len(csvdata),'progress',m2['last_step'])
    params=urllib.parse.urlencode({'name':'Fluttershy Test','filename':'mesh.schem','factor':'4','cube_cm':'2'})
    status,data=request(port,'/api/models/import?'+params,'POST',(root/'seed/fluttershy.schem').read_bytes())
    assert status==201 and data['piece_count']==710
    nid=data['id'];print('SCHEM import factor4:',data)
    params=urllib.parse.urlencode({'name':'Cuboid Test','filename':'mesh.schem','factor':'4','cube_cm':'2','algorithm':'cuboid'})
    status,data=request(port,'/api/models/import?'+params,'POST',(root/'seed/fluttershy.schem').read_bytes())
    assert status==201 and data['piece_count']<710
    rid=data['id'];status,rect_model=request(port,f'/api/models/{rid}')
    assert rect_model['algorithm']=='cuboid' and any(p.get('sx')!=p.get('sy') or p.get('sy')!=p.get('sz') for p in rect_model['pieces'])
    print('CUBOID import factor4:',data)
    params=urllib.parse.urlencode({'name':'CSV Test','filename':'pieces.csv','factor':'5','cube_cm':'2'})
    status,data=request(port,'/api/models/import?'+params,'POST',(root/'seed/fluttershy_pieces.csv').read_bytes())
    assert data['piece_count']==442
    cid=data['id'];print('CSV import:',data)
    upd={'name':'Fluttershy Yenilendi','factor':5,'cube_cm':2}
    status,data=request(port,f'/api/models/{nid}/settings','POST',json.dumps(upd).encode())
    assert data['piece_count']==442
    print('SETTINGS recompute factor5:',data)
    status,m3=request(port,'/api/models/'+nid)
    assert m3['piece_count']==442 and m3['name']=='Fluttershy Yenilendi'
    status,d=request(port,f'/api/models/{cid}','DELETE')
    assert d['ok']
    status,items=request(port,'/api/models');assert len(items['models'])==3
    print('DELETE / LIBRARY persistence test: pass')
  finally:
    proc.terminate()
    try:proc.communicate(timeout=3)
    except subprocess.TimeoutExpired:proc.kill()
