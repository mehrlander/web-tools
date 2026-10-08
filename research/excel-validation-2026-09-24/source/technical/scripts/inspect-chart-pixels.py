from collections import Counter
from PIL import Image
im = Image.open('outputs/excel-validation/charts/excel-column.png').convert('RGB')
print('Dimensions:', im.size)
print('Frequent colors:', Counter(im.getdata()).most_common(6))
px = im.load()
rows = []
for y in range(40,im.height-40):
    xs = [x for x in range(120,im.width-30) if max(px[x,y])-min(px[x,y]) < 3 and 90 < px[x,y][0] < 200]
    if len(xs)>im.width*.70:
        rows.append((y,len(xs),min(xs),max(xs)))
print('Long gray horizontal rows (y,count,left,right):', rows)
cols = []
for x in range(150,300):
    ys = [y for y in range(160,1195) if max(px[x,y])-min(px[x,y]) < 3 and 90 < px[x,y][0] < 200]
    if len(ys)>800:
        cols.append((x,len(ys),min(ys),max(ys)))
print('Long gray vertical columns:', cols)
