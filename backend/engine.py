"""Sponge schematic -> color-aware downsample -> cube/cuboid/hybrid cover.
Coordinates: x=width, y=vertical, z=depth.
"""
from __future__ import annotations
import csv
import io
import json
from collections import Counter, defaultdict
from math import prod
from hybrid import hybrid_partition

PALETTE = {
    'yellow': {'label': 'Sarı', 'hex': '#F1D16F'},
    'pink': {'label': 'Pembe', 'hex': '#ED9DC2'},
    'darkpink': {'label': 'Koyu pembe', 'hex': '#C77B9E'},
    'white': {'label': 'Beyaz', 'hex': '#F1EDE8'},
    'black': {'label': 'Siyah', 'hex': '#37313B'},
    'blue': {'label': 'Turkuaz', 'hex': '#83CCD3'},
    'brown': {'label': 'Kahverengi', 'hex': '#9B775C'},
    'other': {'label': 'Diğer / kontrol et', 'hex': '#A5A39C'},
}
COLOR_NAMES = ['air'] + list(PALETTE)

def categorize(block: str) -> str:
    n=block.lower().split(':')[-1]
    if any(s in n for s in ('air','structure_void')): return 'air'
    if any(s in n for s in ('cherry','pink','magenta')): return 'pink'
    if any(s in n for s in ('ochre','yellow','gold','honey','end_stone')): return 'yellow'
    if any(s in n for s in ('snow','white','quartz')): return 'white'
    if any(s in n for s in ('black','coal','deepslate')): return 'black'
    if any(s in n for s in ('cyan','blue','diamond')): return 'blue'
    if any(s in n for s in ('brown','soul_sand','mud')): return 'brown'
    return 'other'

def _parse_nbt(data: bytes):
    """Read the NBT tag types needed for Sponge schematic, using only stdlib."""
    import struct
    buf=memoryview(data); offset=0
    def take(n):
        nonlocal offset
        if n<0 or offset+n>len(buf):raise ValueError('NBT dosyası eksik veya bozuk')
        part=buf[offset:offset+n];offset+=n;return part
    def numeric(fmt):return struct.unpack('>'+fmt,take(struct.calcsize('>'+fmt)))[0]
    def string():
        length=numeric('H')
        return take(length).tobytes().decode('utf-8')
    def payload(t):
        if t==1:return numeric('b')
        if t==2:return numeric('h')
        if t==3:return numeric('i')
        if t==4:return numeric('q')
        if t==5:return numeric('f')
        if t==6:return numeric('d')
        if t==7:
            return take(numeric('i')).tobytes()
        if t==8:return string()
        if t==9:
            inner=numeric('B');length=numeric('i')
            if length<0 or length>8_000_000:raise ValueError('Geçersiz NBT liste boyutu')
            return [payload(inner) for _ in range(length)]
        if t==10:
            out={}
            while True:
                child=numeric('B')
                if child==0:return out
                key=string()
                out[key]=payload(child)
        if t in (11,12):
            length=numeric('i');fmt='i' if t==11 else 'q'
            return [numeric(fmt) for _ in range(length)]
        raise ValueError('Desteklenmeyen NBT etiket türü: '+str(t))
    root_type=numeric('B')
    if root_type!=10:raise ValueError('NBT kök etiketi Compound değil')
    name=string()
    return name,payload(root_type)

def load_schematic(data: bytes):
    import gzip
    payload=gzip.decompress(data)
    name,root=_parse_nbt(payload)
    if name=='Schematic':schematic=root
    else:schematic=root.get('Schematic',root)
    width,height,length=[int(schematic[k]) for k in ('Width','Height','Length')]
    total=width*height*length
    if total<=0 or total>8_000_000:raise ValueError('Model en fazla 8 milyon voxel içerebilir.')
    blocks=schematic.get('Blocks')
    if blocks is not None and 'Data' in blocks and 'Palette' in blocks:
        palette,raw=blocks['Palette'],blocks['Data']
    elif 'Palette' in schematic and 'BlockData' in schematic:
        palette,raw=schematic['Palette'],schematic['BlockData']
    else:
        raise ValueError('Sponge .schem v2/v3 dosyası değil (Palette/BlockData eksik).')
    index_to_category={int(idx):COLOR_NAMES.index(categorize(name)) for name,idx in palette.items()}
    occupied={};value=shift=count=0
    for byte in raw:
        b=byte&255;value|=(b&127)<<shift
        if b&128:
            shift+=7
            if shift>35:raise ValueError('Geçersiz block varint')
        else:
            cat=index_to_category.get(value,0)
            if cat:
                x=count%width;z=(count//width)%length;y=count//(width*length)
                occupied[(x,y,z)]=cat
            count+=1
            if count==total:break
            value=shift=0
    if count!=total:raise ValueError('Blok verisi eksik: '+str(count)+'/'+str(total))
    return occupied,len(occupied),[width,height,length]

def reduce_voxels(occupied, dimensions, factor):
    if factor==1:return occupied.copy(),dimensions
    shape=[(s+factor-1)//factor for s in dimensions]
    counts={}
    for (x,y,z),category_id in occupied.items():
        key=(x//factor,y//factor,z//factor)
        if key not in counts:counts[key]=[0]*len(COLOR_NAMES)
        counts[key][category_id]+=1
    # np.bincount.argmax equivalent: smallest index wins a tie
    reduced={key:max(range(1,len(row)),key=lambda i:row[i]) for key,row in counts.items()}
    return reduced,shape

def greedy_cube_cover(occupied, shape):
    """Greedy largest-first with only exact, axis-aligned, same-color CUBES."""
    remaining=occupied.copy();pieces=[]
    for size in range(min(shape),0,-1):
        for x in range(shape[0]-size+1):
            for y in range(shape[1]-size+1):
                for z in range(shape[2]-size+1):
                    col=remaining.get((x,y,z),0)
                    if not col:continue
                    cells=((a,b,c) for a in range(x,x+size) for b in range(y,y+size) for c in range(z,z+size))
                    if all(remaining.get(pos)==col for pos in cells):
                        pieces.append({'id':len(pieces)+1,'x':x,'y':y,'z':z,'size':size,'color':COLOR_NAMES[col]})
                        for a in range(x,x+size):
                            for b in range(y,y+size):
                                for c in range(z,z+size):del remaining[(a,b,c)]
    if remaining:raise AssertionError('Unassigned voxels remain')
    return pieces

def _piece_dimensions(piece):
    size=int(piece.get('size',1))
    return (int(piece.get('sx',size)),int(piece.get('sy',size)),int(piece.get('sz',size)))

def _piece_cells(piece):
    if piece.get('voxels'):
        return ((int(v[0]),int(v[1]),int(v[2])) for v in piece['voxels'])
    x,y,z=piece['x'],piece['y'],piece['z'];sx,sy,sz=_piece_dimensions(piece)
    return ((a,b,c) for a in range(x,x+sx) for b in range(y,y+sy) for c in range(z,z+sz))

def greedy_cuboid_cover(occupied, shape):
    """Cover same-color voxels with axis-aligned rectangular prisms.

    Six growth orders are evaluated for each seed and the largest candidate is
    selected. This keeps the implementation deterministic while generally
    producing substantially fewer pieces than cube-only covering.
    """
    from itertools import permutations
    remaining=occupied.copy();pieces=[]
    axes=(0,1,2)
    while remaining:
        origin=min(remaining,key=lambda pos:(pos[1],pos[0],pos[2]))
        color=remaining[origin]
        best=(1,1,1)
        for order in permutations(axes):
            dims=[1,1,1]
            for axis in order:
                while origin[axis]+dims[axis] < shape[axis]:
                    trial=dims.copy();trial[axis]+=1
                    valid=True
                    for x in range(origin[0],origin[0]+trial[0]):
                        for y in range(origin[1],origin[1]+trial[1]):
                            for z in range(origin[2],origin[2]+trial[2]):
                                if remaining.get((x,y,z))!=color:
                                    valid=False;break
                            if not valid:break
                        if not valid:break
                    if not valid:break
                    dims=trial
            if dims[0]*dims[1]*dims[2] > best[0]*best[1]*best[2]:best=tuple(dims)
        x,y,z=origin;sx,sy,sz=best
        pieces.append({'id':len(pieces)+1,'x':x,'y':y,'z':z,
                       'sx':sx,'sy':sy,'sz':sz,'color':COLOR_NAMES[color]})
        for a in range(x,x+sx):
            for b in range(y,y+sy):
                for c in range(z,z+sz):del remaining[(a,b,c)]
    return pieces

def load_csv(data: bytes):
    s=data.decode('utf-8-sig')
    reader=csv.DictReader(io.StringIO(s))
    pieces=[]
    for row in reader:
        try:
            size=int(row.get('küp_birim') or row.get('boyut_birim') or row.get('size') or 1)
            item={'id':len(pieces)+1, 'x':int(row['x']),'y':int(row['y']),'z':int(row['z']),
                  'size':size,
                  'sx':int(row.get('x_birim') or row.get('sx') or size),
                  'sy':int(row.get('y_birim') or row.get('sy') or size),
                  'sz':int(row.get('z_birim') or row.get('sz') or size),
                  'color':(row.get('renk') or row.get('color') or 'other').strip().lower()}
        except (ValueError,TypeError,KeyError) as e:
            raise ValueError(f'CSV satır {len(pieces)+2} geçersiz: {e}') from e
        if min(item[k] for k in ('sx','sy','sz'))<1 or max(item[k] for k in ('sx','sy','sz'))>100 or min(item[k] for k in ('x','y','z'))<0:
            raise ValueError('Geçersiz parça ölçüsü veya koordinat')
        if item['color'] not in PALETTE:item['color']='other'
        pieces.append(item)
        if len(pieces)>20000:raise ValueError('Maksimum 20.000 parça')
    if not pieces:raise ValueError('CSV boş veya tanınmadı')
    return pieces

def contact_network(pieces):
    """Build face-adjacency in O(total exposed faces) with a voxel occupancy map.
    Face-edge/corner-only contacts are not counted.
    """
    voxel_owner={}
    for p in pieces:
        for key in _piece_cells(p):
            if key in voxel_owner: raise ValueError('Fiziksel parçalar çakışıyor')
            voxel_owner[key]=p['id']
        if len(voxel_owner)>600000:raise ValueError('Montaj sınırı: 600.000 voxel')
    links=defaultdict(lambda:defaultdict(lambda:defaultdict(int)))
    directions=[('x+',1,0,0),('x-',-1,0,0),('y+',0,1,0),('y-',0,-1,0),('z+',0,0,1),('z-',0,0,-1)]
    for p in pieces:
        pid=p['id']
        for a,b,c in _piece_cells(p):
            for face,dx,dy,dz in directions:
                other=voxel_owner.get((a+dx,b+dy,c+dz))
                if other is not None and other != pid:links[pid][other][face]+=1
    return {p['id']:{q:dict(face_area) for q,face_area in links[p['id']].items()} for p in pieces}

def assembly_order(pieces):
    links=contact_network(pieces)
    byid={p['id']:p for p in pieces}
    import heapq
    seen=set();order=[];warnings=[];frontier=[]
    def enqueue(pid):
        if pid in seen:return
        p=byid[pid]
        attachments=[]
        for other,faces in links[pid].items():
            if other in seen:
                face, area=max(faces.items(),key=lambda fa:fa[1])
                attachments.append((area,other,face))
        if attachments:
            area,anchor,face=max(attachments)
            volume=prod(_piece_dimensions(p))
            score=(p['y'],-sum(t[0] for t in attachments),-len(attachments),-volume,p['x'],p['z'],pid)
            heapq.heappush(frontier,(score,pid,anchor,face,area))
    while len(seen)<len(pieces):
        if not frontier:
            remaining=[p for p in pieces if p['id'] not in seen]
            root=min(remaining,key=lambda p:(p['y'],p['x'],p['z'],p['id']))
            if seen:warnings.append(f'Bağımsız parça grubu: #{root["id"]} ile başlıyor; ayrıca destek gerekir.')
            seen.add(root['id'])
            order.append({**root,'anchor':None,'face':None,'area':0,'step':len(order)+1})
            for other in links[root['id']]:enqueue(other)
            continue
        _score,pid,anchor,face,area=heapq.heappop(frontier)
        if pid in seen:continue
        # Re-evaluate anchor and scoring, as previously queued priorities are stale.
        available=[]
        for other,faces in links[pid].items():
            if other in seen:
                for f, a in faces.items():available.append((a,other,f))
        if not available:continue
        area,anchor,face=max(available)
        p=byid[pid];seen.add(pid)
        order.append({**p,'anchor':anchor,'face':face,'area':area,'step':len(order)+1})
        for other in links[pid]:enqueue(other)
    return order,warnings

def model_from_pieces(pieces, name, factor, cube_cm, source_blocks=None, source_dims=None, algorithm='cube', extra=None):
    ordered,warnings=assembly_order(pieces)
    material=[]
    counters=Counter((p['color'],*_piece_dimensions(p)) for p in pieces)
    for (color,sx,sy,sz),count in sorted(counters.items(),key=lambda k:k[0]):
        material.append({'color':color,'label':PALETTE[color]['label'],'hex':PALETTE[color]['hex'],
                         'size':sx if sx==sy==sz else None,'sx':sx,'sy':sy,'sz':sz,
                         'edge_cm':round(sx*cube_cm,3),'count':count})
    dims=[max(p[axis]+_piece_dimensions(p)[i] for p in pieces) for i,axis in enumerate(('x','y','z'))]
    sizes={str(k):v for k,v in sorted(Counter(_piece_dimensions(p)[0] for p in pieces if len(set(_piece_dimensions(p)))==1).items())}
    shape_counts=Counter(_piece_dimensions(p) for p in pieces)
    shapes={f'{sx}x{sy}x{sz}':count for (sx,sy,sz),count in shape_counts.items()}
    model={'name':name,'factor':factor,'cube_cm':cube_cm,'source_blocks':source_blocks,
            'source_dims':source_dims,'dimensions':dims,'algorithm':algorithm,
            'reduced_voxels':sum(p.get('voxel_count',prod(_piece_dimensions(p))) for p in pieces),
            'piece_count':len(pieces),'cube_sizes':sizes,'piece_shapes':shapes,'materials':material,
            'palette':PALETTE,'warnings':warnings,'pieces':ordered}
    if extra:model.update(extra)
    return model

def from_schem(data: bytes, name: str, factor: int, cube_cm: float, algorithm='cube', hybrid_options=None):
    grid,source_blocks,source_dims=load_schematic(data)
    reduced,shape=reduce_voxels(grid,source_dims,factor)
    extra=None
    if algorithm=='hybrid':
        options=hybrid_options or {}
        pieces,report=hybrid_partition(reduced,**options)
        # The partitioner works with compact numeric palette ids. Convert at
        # this boundary so the persisted model keeps the same public colour
        # contract used by the existing cube/cuboid engines and the viewer.
        for piece in pieces:
            piece['color_id']=piece['color']
            piece['color']=COLOR_NAMES[piece['color_id']]
            piece['colors']={COLOR_NAMES[int(color)]:count for color,count in piece['colors'].items()}
            piece['voxels']=[[*voxel[:3],COLOR_NAMES[voxel[3]]] for voxel in piece['voxels']]
        extra={'hybrid':report,'visual_voxel_count':len(reduced),'physical_piece_count':len(pieces)}
    else:
        pieces=greedy_cuboid_cover(reduced,shape) if algorithm=='cuboid' else greedy_cube_cover(reduced,shape)
    if not pieces:raise ValueError('Modelde dolu voxel bulunamadı')
    model=model_from_pieces(pieces,name,factor,cube_cm,source_blocks,source_dims,algorithm,extra)
    if extra:model['warnings'].extend(report['warnings'])
    return model
