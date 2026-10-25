from engine import COLOR_NAMES, contact_network, from_schem, load_schematic, reduce_voxels
from hybrid import connected_components, hybrid_partition
from mesh import binary_stl, part_cells, part_to_stl, validate_mesh, voxel_surface
from pathlib import Path

root = Path(__file__).resolve().parent


def occupancy(parts):
    result = set()
    for part in parts:
        cells = part_cells(part)
        assert result.isdisjoint(cells), f"overlap in {part['part_code']}"
        result.update(cells)
        assert len(connected_components({cell: 1 for cell in cells})) == 1
    return result


sample = {(x, y, z): 1 for x in range(8) for y in range(5) for z in range(4)}
sample.update({(x, 5, 1): 2 for x in range(3, 7)})
parts, report = hybrid_partition(sample, target=12, minimum=10, maximum=14)
assert 10 <= len(parts) <= 14
assert occupancy(parts) == set(sample)
assert sum(part['voxel_count'] for part in parts) == len(sample)
again, again_report = hybrid_partition(sample, target=12, minimum=10, maximum=14)
assert parts == again and report == again_report
links = contact_network(parts)
assert any(links.values())

stl, mesh_report = part_to_stl(parts[0], 2.0)
assert stl[:80].rstrip().startswith(b'PART-')
assert len(stl) == 84 + mesh_report['triangles'] * 50
assert mesh_report['watertight'] and mesh_report['manifold']

grid, _, dimensions = load_schematic((root / 'seed/fluttershy.schem').read_bytes())
reduced, _ = reduce_voxels(grid, dimensions, 4)
model = from_schem(
    (root / 'seed/fluttershy.schem').read_bytes(),
    'Fluttershy Hybrid',
    4,
    2.0,
    'hybrid',
    {'target': 130, 'minimum': 100, 'maximum': 150, 'priority': 'balanced'},
)
assert model['algorithm'] == 'hybrid'
assert 100 <= model['piece_count'] <= 150
assert model['visual_voxel_count'] == len(reduced)
assert occupancy(model['pieces']) == set(reduced)
assert sum(part['voxel_count'] for part in model['pieces']) == len(reduced)
print('HYBRID:', len(reduced), 'visual voxels ->', model['piece_count'], 'physical parts')
print('MESH:', mesh_report)
