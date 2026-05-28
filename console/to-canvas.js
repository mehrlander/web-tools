var w = window.open('', '', 'width=900,height=700');
w.document.write(`<div id="out" style="height:100vh;overflow-y:auto;padding:8px;box-sizing:border-box">
  <button id="btn" style="padding:8px 16px;font-size:14px;cursor:pointer;display:block;margin-bottom:8px">Capture</button>
</div>`);
w.document.close();

var s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/html2canvas';
document.head.appendChild(s);

s.onload = () => {
  w.document.getElementById('btn').onclick = () => {
    html2canvas(document.body).then(c => {
      var box = w.document.createElement('div');
      box.style.cssText = 'height:300px;overflow:auto;border:1px solid #ccc;margin-bottom:8px';
      box.appendChild(c);
      w.document.getElementById('out').appendChild(box);
    });
  };
};
