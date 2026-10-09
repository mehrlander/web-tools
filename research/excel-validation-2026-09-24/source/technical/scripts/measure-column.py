"""Measure a native column chart capture against its numeric specification.

Plot bounds and series color must be observed in the actual retained image.
This reads pixels only; it never modifies the native reference image.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('image')
p.add_argument('--plot', nargs=4, type=int, required=True, metavar=('LEFT','TOP','RIGHT','BOTTOM'))
p.add_argument('--rgb', nargs=3, type=int, required=True)
p.add_argument('--output', required=True)
a = p.parse_args()
path = Path(a.image)
im = Image.open(path).convert('RGB')
left, top, right, bottom = a.plot
px = im.load()
mask = set()
for y in range(top, bottom + 1):
    for x in range(left, right + 1):
        if max(abs(px[x,y][i] - a.rgb[i]) for i in range(3)) <= 12:
            mask.add((x,y))
components = []
while mask:
    start = mask.pop()
    queue = [start]
    points = []
    while queue:
        x,y = queue.pop()
        points.append((x,y))
        for n in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if n in mask:
                mask.remove(n)
                queue.append(n)
    if len(points) >= 30:
        xs,ys = zip(*points)
        components.append({'bounds':[min(xs),min(ys),max(xs),max(ys)],'pixels':len(points)})
components.sort(key=lambda c: c['bounds'][0])
values = [8,0,-4,12]
baseline = top + (15 / 20) * (bottom-top)
measurements = []
groups = {}
for component in components:
    x0,y0,x1,y1 = component['bounds']
    category = max(0,min(3,int(((x0+x1)/2-left)/(right-left)*4)))
    groups.setdefault(category, []).append(component)
for category, members in sorted(groups.items()):
    # The Gamma label lies over its column. Blue interiors of letters become
    # disconnected regions; group them by category rather than treating them
    # as additional bars or changing a tolerance to discard their results.
    x0=min(c['bounds'][0] for c in members)
    y0=min(c['bounds'][1] for c in members)
    x1=max(c['bounds'][2] for c in members)
    y1=max(c['bounds'][3] for c in members)
    expected = values[category]
    edge = y0 if expected > 0 else y1
    measured = 15 - (edge-top)/(bottom-top)*20
    expected_edge = top + (15-expected)/20*(bottom-top)
    measurements.append({'bounds':[x0,y0,x1,y1],'pixels':sum(c['pixels'] for c in members),
                         'componentCount':len(members),'categoryIndex':category,'expectedValue':expected,
                         'observedPaintEdgeY':edge,'expectedGeometricEdgeY':round(expected_edge,3),
                         'edgeDifferencePixels':round(edge-expected_edge,3),
                         'measuredValue':round(measured,3),'absoluteError':round(abs(measured-expected),3)})
result = {'image':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
          'imageDimensions':im.size,'plotBounds':a.plot,'seriesRgb':a.rgb,
          'axis':{'min':-5,'max':15},'zeroBaselineY':baseline,
          'method':'Connected solid-color regions within observed plot bounds, grouped by categorical X position. Gridline centers determined from native pixels. No image resize or alteration.',
          'limitations':'Measures outer painted edges, including stroke and pixel quantization. This is not a universal pass threshold or independent renderer comparison.',
          'zeroCategoryHasNoColoredComponent':1 not in groups,
          'rawComponents':components,
          'measurements':measurements}
Path(a.output).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
