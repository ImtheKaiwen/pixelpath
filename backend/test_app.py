import tempfile,subprocess,sys,os,time,json,urllib.request,urllib.parse,csv,io,queue,threading,re,zipfile
from pathlib import Path
from engine import greedy_cuboid_cover
root=Path(__file__).resolve().parent
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))

rect=greedy_cuboid_cover({(x,y,z):1 for x in range(3) for y in range(2) for z in range(4)},[3,2,4])
assert len(rect)==1 and (rect[0]['sx'],rect[0]['sy'],rect[0]['sz'])==(3,2,4)

def request(port,path,method='GET',body=None):
  req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',method=method,data=body)
  with opener.open(req,timeout=15) as res:
    b=res.read()
    return res.status, (json.loads(b) if res.headers.get('Content-Type','').startswith('application/json') else b)

with tempfile.TemporaryDirectory() as folder:
  env={**os.environ,'PIXELPATH_DATA':folder}
  env['NO_PROXY']='127.0.0.1,localhost'
  proc=subprocess.Popen([sys.executable,str(root/'app.py'),'--port','0','--no-open'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
    output=queue.Queue()
    threading.Thread(target=lambda:[output.put(line) for line in iter(proc.stdout.readline,b'')],daemon=True).start()
    deadline=time.time()+20;port=None;startup=[]
    while time.time()<deadline and port is None:
      try:line=output.get(timeout=.2)
      except queue.Empty:
        if proc.poll() is not None:break
        continue
      startup.append(line)
      match=re.search(rb'PIXELPATH_READY http://127\.0\.0\.1:(\d+)',line)
      if match:port=int(match.group(1))
    if port is None:
      stderr=proc.stderr.read() if proc.poll() is not None else b''
      raise RuntimeError('Server failed start: '+(b''.join(startup)+stderr).decode(errors='replace'))
    for _ in range(50):
      try:
        st,items=request(port,'/api/models')
        break
      except OSError:
        if proc.poll() is not None:break
        time.sleep(.1)
    else:raise RuntimeError('Server became ready but did not accept requests')
    if proc.poll() is not None:
      raise RuntimeError('Server exited after startup: '+proc.stderr.read().decode(errors='replace'))
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
    params=urllib.parse.urlencode({'name':'Hybrid Test','filename':'mesh.schem','factor':'4','cube_cm':'2','algorithm':'hybrid','hybrid_min':'100','hybrid_target':'130','hybrid_max':'150'})
    status,data=request(port,'/api/models/import?'+params,'POST',(root/'seed/fluttershy.schem').read_bytes())
    assert status==201 and 100<=data['piece_count']<=150
    hid=data['id'];status,hybrid_model=request(port,f'/api/models/{hid}')
    assert hybrid_model['algorithm']=='hybrid' and hybrid_model['visual_voxel_count']==1002
    status,production=request(port,f'/api/models/{hid}/production.zip')
    with zipfile.ZipFile(io.BytesIO(production)) as package:
      names=package.namelist();manifest=json.loads(package.read('manifest.json'))
      assert len([name for name in names if name.endswith('.stl')])==hybrid_model['piece_count']
      assert manifest['geometry_mode']=='solid_voxel_union'
      assert manifest['connectors']['status']=='not_generated'
      first=package.read(next(name for name in names if name.endswith('.stl')))
      assert len(first)>84
    print('HYBRID / production ZIP:',data['piece_count'],'real STL files')
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
    status,items=request(port,'/api/models');assert len(items['models'])==4
    print('DELETE / LIBRARY persistence test: pass')
  finally:
    proc.terminate()
    try:proc.communicate(timeout=3)
    except subprocess.TimeoutExpired:proc.kill()
