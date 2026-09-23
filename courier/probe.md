# Courier message probe

A throwaway test, not part of the courier. It answers one question before any
design depends on it: can a page a session cannot reach hand data to a
signed-in Web Tools window by `postMessage`, and can that window hand a script
back to run on the page?

## The parts

| Part | Where it runs | What it does |
| --- | --- | --- |
| the bookmarklet below | the visited page | opens the receiver as a popup, sends the page's title, URL and links, runs the script it gets back, and sends the result |
| [`probe.html`](probe.html) | the popup, on `mehrlander.github.io` through toss-render's address mode | shows what arrived and from which origin, reads one private file with the stored token, and replies with a small script |

Nothing is committed anywhere, and the token never leaves the popup.

## The bookmarklet

The popup address is pinned to the branch this probe lives on.

```
javascript:(()=>{const R='https://mehrlander.github.io',P=R+'/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/home-719-web-tools-757-84h8rv:courier/probe.html',w=open(P,'courierprobe','width=900,height=800');if(!w){alert('Probe: popup blocked');return}let sent=0;const links=[...document.links].map(a=>({text:a.textContent.trim().slice(0,200),href:a.href}));addEventListener('message',async e=>{if(e.origin!==R)return;const d=e.data||{};if(d.type==='ready'&&!sent){sent=1;w.postMessage({type:'probe',title:document.title,url:location.href,links,htmlBytes:document.documentElement.outerHTML.length},R)}else if(d.type==='run'){let m;try{m={type:'ran',result:await new Function(d.code)()}}catch(x){m={type:'ran',error:String(x)}}w.postMessage(m,R)}else if(d.type==='done')alert('Probe: Web Tools received '+d.links+' links and ran its script here.')});setTimeout(()=>{if(!sent)alert('Probe: no ready signal from the popup in 30 seconds.')},30000)})()
```

## Reading the outcome

| What you see | What it means |
| --- | --- |
| the popup lists the page's links, a `ran` card with a result, and the page shows the closing alert | both directions work on that site |
| a `ran` card with an `error` naming `unsafe-eval` or Content Security Policy | messages work, but that site refuses to run a script handed to it |
| the 30-second alert, and the popup shows **No opener** | the site cuts the link between the windows (`Cross-Origin-Opener-Policy`); the fragment route stays the answer there |
| **Not signed in** in the popup | the popup is not seeing the stored token; the message test still stands |
