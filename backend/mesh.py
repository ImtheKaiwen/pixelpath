"""Dependency-free watertight voxel surface mesh and binary STL writer."""
from __future__ import annotations

import io
import math
import struct
from collections import Counter

FACES = (
    ((-1, 0, 0), ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0))),
    ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
    ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
    ((0, 1, 0), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0))),
    ((0, 0, -1), ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))),
    ((0, 0, 1), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))),
)


def part_cells(part):
    if part.get('voxels'):
        return {(int(v[0]), int(v[1]), int(v[2])) for v in part['voxels']}
    size = int(part.get('size', 1))
    sx, sy, sz = (int(part.get(axis, size)) for axis in ('sx', 'sy', 'sz'))
    return {
        (x, y, z)
        for x in range(int(part['x']), int(part['x']) + sx)
        for y in range(int(part['y']), int(part['y']) + sy)
        for z in range(int(part['z']), int(part['z']) + sz)
    }


def voxel_surface(cells, unit_mm):
    cells = set(cells)
    triangles = []
    for x, y, z in sorted(cells):
        for normal, corners in FACES:
            neighbor = x + normal[0], y + normal[1], z + normal[2]
            if neighbor in cells:
                continue
            vertices = [
                ((x + cx) * unit_mm, (y + cy) * unit_mm, (z + cz) * unit_mm)
                for cx, cy, cz in corners
            ]
            triangles.append((normal, vertices[0], vertices[1], vertices[2]))
            triangles.append((normal, vertices[0], vertices[2], vertices[3]))
    return triangles


def validate_mesh(triangles):
    edge_counts = Counter()
    for _normal, a, b, c in triangles:
        if a == b or b == c or c == a:
            return {'watertight': False, 'manifold': False, 'error': 'Degenerate triangle'}
        for first, second in ((a, b), (b, c), (c, a)):
            edge_counts[tuple(sorted((first, second)))] += 1
    bad_edges = sum(1 for count in edge_counts.values() if count != 2)
    return {
        'watertight': bad_edges == 0,
        'manifold': bad_edges == 0,
        'triangles': len(triangles),
        'non_manifold_edges': bad_edges,
    }


def binary_stl(triangles, name='PixelPath part'):
    stream = io.BytesIO()
    stream.write(name.encode('ascii', errors='replace')[:80].ljust(80, b' '))
    stream.write(struct.pack('<I', len(triangles)))
    for normal, a, b, c in triangles:
        length = math.sqrt(sum(value * value for value in normal)) or 1.0
        values = tuple(value / length for value in normal) + a + b + c
        stream.write(struct.pack('<12fH', *values, 0))
    return stream.getvalue()


def part_to_stl(part, unit_mm):
    cells = part_cells(part)
    # Printable files use a local origin; assembly coordinates stay in the
    # manifest/model instead of placing the part far from the slicer origin.
    origin = tuple(min(cell[axis] for cell in cells) for axis in range(3))
    local_cells = {
        (cell[0] - origin[0], cell[1] - origin[1], cell[2] - origin[2])
        for cell in cells
    }
    triangles = voxel_surface(local_cells, float(unit_mm))
    report = validate_mesh(triangles)
    if not report['watertight']:
        raise ValueError(f'Parça {part.get("part_code", part.get("id"))} kapalı manifold üretmedi')
    report['solid_volume_mm3'] = round(len(cells) * float(unit_mm) ** 3, 3)
    report['assembly_origin_voxels'] = list(origin)
    return binary_stl(triangles, part.get('part_code', f'PART-{part.get("id", 0):03d}')), report
