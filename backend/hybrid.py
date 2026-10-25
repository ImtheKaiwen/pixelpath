"""Deterministic voxel-to-physical-module partitioning for PixelPath.

The hybrid layer never changes source occupancy.  It assigns every occupied
voxel to exactly one face-connected physical module and keeps per-voxel colour
metadata so visual geometry and printable parts remain separate concepts.
"""
from __future__ import annotations

from collections import Counter, deque
import heapq
from mesh import validate_mesh, voxel_surface

NEIGHBORS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def _neighbors(position):
    x, y, z = position
    for dx, dy, dz in NEIGHBORS:
        yield x + dx, y + dy, z + dz


def connected_components(occupied):
    """Return deterministic face-connected components of an occupancy map."""
    pending = set(occupied)
    components = []
    while pending:
        root = min(pending, key=lambda p: (p[1], p[0], p[2]))
        pending.remove(root)
        queue = deque([root])
        component = []
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in _neighbors(current):
                if neighbor in pending:
                    pending.remove(neighbor)
                    queue.append(neighbor)
        components.append(sorted(component, key=lambda p: (p[1], p[0], p[2])))
    return components


def _complexity(component, occupied):
    cells = set(component)
    exposed = 0
    color_edges = 0
    internal_edges = 0
    for position in component:
        color = occupied[position]
        for neighbor in _neighbors(position):
            if neighbor not in cells:
                exposed += 1
            elif position < neighbor:
                internal_edges += 1
                if occupied[neighbor] != color:
                    color_edges += 1
    surface_ratio = exposed / max(1, 6 * len(component))
    color_ratio = color_edges / max(1, internal_edges)
    return round(min(1.0, surface_ratio * 0.72 + color_ratio * 0.28), 5)


def _allocate_parts(components, occupied, target):
    allocations = [1] * len(components)
    complexity = [_complexity(component, occupied) for component in components]
    remaining = target - len(components)
    while remaining > 0:
        choices = []
        for index, component in enumerate(components):
            if allocations[index] >= len(component):
                continue
            # Simple bulky areas receive more assembly pieces; detailed areas
            # remain in larger modules. Division by the current allocation
            # produces stable, balanced module sizes.
            score = len(component) / ((1.0 + complexity[index] * 1.8) * allocations[index])
            choices.append((score, len(component), -index, index))
        if not choices:
            break
        index = max(choices)[-1]
        allocations[index] += 1
        remaining -= 1
    return allocations, complexity


def _farthest_seeds(component, count):
    ordered = sorted(component, key=lambda p: (p[1], p[0], p[2]))
    seeds = [ordered[0]]
    available = set(ordered[1:])
    while len(seeds) < count and available:
        def distance_key(position):
            distance = min(
                (position[0] - seed[0]) ** 2
                + (position[1] - seed[1]) ** 2
                + (position[2] - seed[2]) ** 2
                for seed in seeds
            )
            return distance, -position[1], -position[0], -position[2]

        selected = max(available, key=distance_key)
        available.remove(selected)
        seeds.append(selected)
    return seeds


def _partition_component(component, occupied, count, color_penalty):
    allowed = set(component)
    seeds = _farthest_seeds(component, count)
    owners = {}
    costs = {}
    queue = []
    for owner, seed in enumerate(seeds):
        owners[seed] = owner
        costs[seed] = 0
        heapq.heappush(queue, (0, owner, seed[1], seed[0], seed[2], seed))
    while queue:
        cost, owner, _y, _x, _z, position = heapq.heappop(queue)
        if costs.get(position) != cost or owners.get(position) != owner:
            continue
        source_color = occupied[position]
        for neighbor in _neighbors(position):
            if neighbor not in allowed:
                continue
            step = 1 + (color_penalty if occupied[neighbor] != source_color else 0)
            candidate = cost + step
            previous = costs.get(neighbor)
            previous_owner = owners.get(neighbor, owner)
            if previous is None or (candidate, owner) < (previous, previous_owner):
                costs[neighbor] = candidate
                owners[neighbor] = owner
                heapq.heappush(queue, (candidate, owner, neighbor[1], neighbor[0], neighbor[2], neighbor))
    groups = [[] for _ in seeds]
    for position in component:
        groups[owners[position]].append(position)
    return [group for group in groups if group]


def _part_record(index, cells, occupied, complexity):
    cells = sorted(cells, key=lambda p: (p[1], p[0], p[2]))
    colors = Counter(occupied[position] for position in cells)
    dominant = min(colors, key=lambda color: (-colors[color], color))
    minimum = [min(position[axis] for position in cells) for axis in range(3)]
    maximum = [max(position[axis] for position in cells) + 1 for axis in range(3)]
    return {
        'id': index,
        'part_code': f'PART-{index:03d}',
        'region': f'REGION-{index:03d}',
        'x': minimum[0], 'y': minimum[1], 'z': minimum[2],
        'sx': maximum[0] - minimum[0],
        'sy': maximum[1] - minimum[1],
        'sz': maximum[2] - minimum[2],
        'color': dominant,
        'colors': {str(color): count for color, count in sorted(colors.items())},
        'voxel_count': len(cells),
        'complexity': complexity,
        'voxels': [[*position, occupied[position]] for position in cells],
    }


def _manifold_groups(cells):
    """Split a digital component when an edge-only pinch is non-manifold.

    Face connectivity alone is not sufficient for an STL: opposite voxels
    can meet around the same lattice edge and create four incident faces.
    Incremental validation keeps each emitted physical module both connected
    and a closed two-manifold without altering source occupancy.
    """
    pending = set(cells)
    result = []
    while pending:
        root = min(pending, key=lambda p: (p[1], p[0], p[2]))
        group = {root}
        pending.remove(root)
        changed = True
        while changed:
            changed = False
            candidates = sorted(
                {neighbor for cell in group for neighbor in _neighbors(cell) if neighbor in pending},
                key=lambda p: (p[1], p[0], p[2]),
            )
            for candidate in candidates:
                proposed = group | {candidate}
                if validate_mesh(voxel_surface(proposed, 1))['manifold']:
                    group.add(candidate)
                    pending.remove(candidate)
                    changed = True
        result.append(sorted(group, key=lambda p: (p[1], p[0], p[2])))
    return result


def hybrid_partition(occupied, target=130, minimum=100, maximum=150, priority='balanced'):
    """Partition occupancy into printable logical modules.

    This first production engine preserves exact voxel occupancy and colour
    boundaries.  It intentionally does not claim structural or printability
    validation; those are separate mesh/connector stages.
    """
    if not occupied:
        return [], {'warnings': ['Modelde dolu voxel bulunamadı.']}
    if not 1 <= minimum <= maximum:
        raise ValueError('Hybrid parça aralığı geçersiz')
    requested = max(minimum, min(maximum, int(target)))
    components = connected_components(occupied)
    achievable = max(len(components), min(requested, len(occupied)))
    allocations, complexities = _allocate_parts(components, occupied, achievable)
    penalties = {'cost': 1, 'assembly': 2, 'detail': 5, 'balanced': 3}
    color_penalty = penalties.get(priority, penalties['balanced'])
    groups = []
    for component, allocation, complexity in zip(components, allocations, complexities):
        for cells in _partition_component(component, occupied, allocation, color_penalty):
            for manifold_cells in _manifold_groups(cells):
                groups.append((manifold_cells, complexity))
    groups.sort(key=lambda item: min((p[1], p[0], p[2]) for p in item[0]))
    parts = [_part_record(index + 1, cells, occupied, complexity) for index, (cells, complexity) in enumerate(groups)]
    warnings = []
    if len(components) > maximum:
        warnings.append(
            f'Modelde {len(components)} bağımsız hacim var; bağlantısız hacimler birleştirilmeden maksimum {maximum} hedefi korunamaz.'
        )
    if not minimum <= len(parts) <= maximum:
        warnings.append(f'Hedef aralık {minimum}–{maximum}; güvenli bağlantılı sonuç {len(parts)} parça üretti.')
    return parts, {
        'mode': 'automatic',
        'priority': priority,
        'minimum': minimum,
        'maximum': maximum,
        'requested_target': requested,
        'actual_parts': len(parts),
        'connected_components': len(components),
        'visual_voxels': len(occupied),
        'warnings': warnings,
    }
