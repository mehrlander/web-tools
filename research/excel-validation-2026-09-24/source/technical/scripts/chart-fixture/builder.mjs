import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const workDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const specs = [
  {sheet:'Column', type:'bar', title:'Column values', headers:['Category','Value'], rows:[['Alpha',8],['Beta',0],['Gamma',-4],['Delta',12]], yAxis:{min:-5,max:15,majorUnit:5}, blankPolicy:'gap'},
  {sheet:'Line', type:'line', title:'Line with blank February', headers:['Month','Value'], rows:[['Jan',2],['Feb',null],['Mar',7],['Apr',3],['May',9]], yAxis:{min:0,max:10,majorUnit:2}, blankPolicy:'gap'},
  {sheet:'Scatter', type:'scatter', title:'Scatter coordinates', headers:['X','Y'], rows:[[0,0],[1,4],[4,1],[10,8]], xAxis:{min:0,max:10,majorUnit:2}, yAxis:{min:0,max:10,majorUnit:2}, blankPolicy:'gap'}
];
await fs.writeFile(path.join(workDir,'specification.json'), JSON.stringify({dataKind:'synthetic controlled inputs', dimensions:{width:700,height:400}, font:{name:'Arial',size:11}, charts:specs},null,2));
if (process.argv.includes('--xlsxwriter')) {
  const pyCode = String.raw`import json, sys, pathlib, xlsxwriter
spec_path = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
spec = json.loads(spec_path.read_text(encoding="utf-8"))
wb = xlsxwriter.Workbook(output)
wb.set_properties({"title":"Controlled chart cases", "comments":"Synthetic inputs for Excel and browser rendering comparisons."})
body = wb.add_format({"font_name":"Arial","font_size":11,"num_format":"0"})
header = wb.add_format({"font_name":"Arial","font_size":11,"bold":True,"bg_color":"#E9EEF4"})
title = wb.add_format({"font_name":"Arial","font_size":12,"bold":True})
font = {"name":"Arial","size":11}
for s in spec["charts"]:
    ws = wb.add_worksheet(s["sheet"])
    ws.set_zoom(100)
    ws.set_default_row(15)
    ws.set_column("A:A",14,body)
    ws.set_column("B:B",10,body)
    ws.set_column("C:D",8,body)
    ws.set_column("E:P",9,body)
    ws.write(0,0,s["sheet"]+" case",title)
    ws.write_row(2,0,s["headers"],header)
    for row_index,row in enumerate(s["rows"],3):
        for col,value in enumerate(row):
            if value is None: ws.write_blank(row_index,col,None,body)
            else: ws.write(row_index,col,value,body)
    chart = wb.add_chart({"type":"column" if s["type"]=="bar" else s["type"]})
    series = {"name":s["headers"][1],"categories":[s["sheet"],3,0,2+len(s["rows"]),0],"values":[s["sheet"],3,1,2+len(s["rows"]),1]}
    if s["type"]=="bar": series.update({"fill":{"color":"#2563EB"},"border":{"color":"#2563EB"}})
    else: series.update({"line":{"color":"#2563EB","width":2},"marker":{"type":"circle","size":6,"border":{"color":"#2563EB"},"fill":{"color":"#2563EB"}}})
    if s["type"]=="scatter": series["line"]={"none":True}
    chart.add_series(series)
    chart.set_title({"name":s["title"],"name_font":{"name":"Arial","size":12}})
    chart.set_legend({"none":True})
    y = s["yAxis"]
    chart.set_y_axis({"min":y["min"],"max":y["max"],"major_unit":y["majorUnit"],"num_format":"0","num_font":font,"name":s["headers"][1],"name_font":font})
    x = {"num_font":font,"name":s["headers"][0],"name_font":font}
    if "xAxis" in s:
        a = s["xAxis"]
        x.update({"min":a["min"],"max":a["max"],"major_unit":a["majorUnit"],"num_format":"0"})
    chart.set_x_axis(x)
    chart.show_blanks_as("gap")
    chart.set_size({"width":700,"height":400})
    ws.insert_chart("E2",chart)
wb.close()
print(json.dumps({"output":str(output),"writer":"XlsxWriter","version":xlsxwriter.__version__,"sheets":[s["sheet"] for s in spec["charts"]]}))
`;
  const outputPath = 'C:/Users/mehrl/Documents/Codex/2026-09-24/tak/outputs/excel-validation/charts/chart-cases.xlsx';
  const result = spawnSync('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe', ['-',path.join(workDir,'specification.json'),outputPath], {input:pyCode,encoding:'utf8'});
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 1);
}
const wb = Workbook.create();
for (const s of specs) {
  const sheet = wb.worksheets.add(s.sheet);
  sheet.showGridLines = true;
  sheet.getRange('A1:P22').format.font = {name:'Arial',size:11};
  sheet.getRange('A1:P22').format.columnWidthPx = 60;
  sheet.getRange('A1:P22').format.rowHeightPx = 20;
  sheet.getRange('A1:A9').format.columnWidthPx = 110;
  sheet.getRange('B1:B9').format.columnWidthPx = 80;
  sheet.getRange('A1').values = [[s.sheet + ' case']];
  sheet.getRange('A1').format.font = {name:'Arial',size:12,bold:true};
  sheet.getRange(`A3:B${3+s.rows.length}`).values = [s.headers,...s.rows];
  sheet.getRange('A3:B3').format.font = {name:'Arial',size:11,bold:true};
  sheet.getRange('A3:B3').format.fill = '#E9EEF4';
  sheet.getRange(`B4:B${3+s.rows.length}`).setNumberFormat('0');
  const chart = sheet.charts.add(s.type,sheet.getRange(`A3:B${3+s.rows.length}`));
  chart.title = s.title;
  chart.titleTextStyle.typeface = 'Arial';
  chart.titleTextStyle.fontSize = 14;
  chart.hasLegend = false;
  chart.setPosition('E2','P22');
  chart.width = 700;
  chart.height = 400;
  chart.xAxis = {numberFormatCode:'0',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:11},...(s.xAxis?{majorUnit:s.xAxis.majorUnit}:{axisType:'textAxis'})};
  chart.yAxis = {majorUnit:s.yAxis.majorUnit,numberFormatCode:'0',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:11}};
  if(s.type==='bar') chart.barOptions.direction='column';
  console.log((await wb.inspect({kind:'table',range:`${s.sheet}!A3:B${3+s.rows.length}`,include:'values,formulas',tableMaxRows:9,tableMaxCols:2,maxChars:1500})).ndjson);
}
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1000})).ndjson);
const output=await SpreadsheetFile.exportXlsx(wb);
const outPath=path.join(workDir,'artifact-tool-attempt.xlsx');
await output.save(outPath);
console.log(JSON.stringify({attempt:outPath,writer:'@oai/artifact-tool',version:'2.8.59',explicitBounds:'not set: absent from documented API lookup',blankControl:'not set: absent from documented API lookup'}));
