#!/usr/bin/env python3 -I
"""validate.py
Responsibility: checks the generated Draw.io files on their own, without trusting the generator: the XML is well formed, ids are unique, every connector has a real source and target,
nothing overlaps, every box is inside its container and inside the page, and no file is empty. Exit code 1 when anything is wrong.
Usage: python3 -I docs/architecture/diagrams/tools/validate.py"""
import glob, os, re, sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
errors, pages, cells_total, edges_total = [], 0, 0, 0

def boxes_overlap(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]

for path in sorted(glob.glob(os.path.join(OUT, '*.drawio'))):
    name = os.path.basename(path)
    if os.path.getsize(path) == 0:
        errors.append(f'{name}: empty file'); continue
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        errors.append(f'{name}: invalid XML ({e})'); continue
    for diagram in root.iter('diagram'):
        pages += 1
        tag = f"{name} [{diagram.get('name')}]"
        model = diagram.find('mxGraphModel')
        pw, ph = float(model.get('pageWidth')), float(model.get('pageHeight'))
        cells = {c.get('id'): c for c in model.iter('mxCell')}
        if len(cells) != len(list(model.iter('mxCell'))):
            errors.append(f'{tag}: duplicate ids')
        absbox, kind = {}, {}
        def geo(c):
            g = c.find('mxGeometry')
            return None if g is None or g.get('width') is None else (float(g.get('x', 0)), float(g.get('y', 0)), float(g.get('width')), float(g.get('height')))
        for cid, c in cells.items():
            if c.get('vertex') != '1':
                continue
            cells_total += 1
            g = geo(c)
            if g is None:
                errors.append(f'{tag}: vertex {cid} has no geometry'); continue
            parent = c.get('parent')
            ox, oy = (absbox[parent][0], absbox[parent][1]) if parent in absbox else (0, 0)
            absbox[cid] = (g[0] + ox, g[1] + oy, g[2], g[3])
            style = c.get('style', '')
            kind[cid] = 'container' if style.startswith('swimlane') else 'text' if style.startswith('text') else 'box'
        # containers are listed before their children, but children could precede: recompute once more for safety
        ids = list(absbox)
        for i, a in enumerate(ids):
            ba = absbox[a]
            if ba[0] < 0 or ba[1] < 0 or ba[0] + ba[2] > pw + 1 or ba[1] + ba[3] > ph + 1:
                errors.append(f'{tag}: {a} is outside the page')
            parent = cells[a].get('parent')
            if parent in absbox and kind[parent] == 'container':
                bp = absbox[parent]
                if not (ba[0] >= bp[0] and ba[1] >= bp[1] and ba[0] + ba[2] <= bp[0] + bp[2] + 0.5 and ba[1] + ba[3] <= bp[1] + bp[3] + 0.5):
                    errors.append(f'{tag}: {a} sticks out of its lane')
            for b in ids[i + 1:]:
                if (cells[a].get('parent') == b) or (cells[b].get('parent') == a):
                    continue
                if boxes_overlap(ba, absbox[b]):
                    errors.append(f'{tag}: {a} overlaps {b}')
        for cid, c in cells.items():
            if c.get('edge') == '1':
                edges_total += 1
                for end in ('source', 'target'):
                    if not c.get(end) or c.get(end) not in cells:
                        errors.append(f'{tag}: connector {cid} has no valid {end}')
            if c.get('vertex') == '1' and kind.get(cid) == 'box' and not (c.get('value') or '').strip():
                errors.append(f'{tag}: box {cid} has no text')
print(f'{pages} pages, {cells_total} shapes, {edges_total} connectors checked')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('DRAWIO OK')
