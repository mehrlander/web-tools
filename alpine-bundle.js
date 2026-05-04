(function() {
    const registerMagics = () => {
        Alpine.store('browser', { activeFile: null, repo: '', repoObj: null, gh: null, path: '', ref: '', defaultRef: '' })
        const toasts = Alpine.reactive([])
        Alpine.store('toasts', toasts)
        const toast = (icon, msg, cls = 'alert-info', ms = 3000) => {
            toasts.push({ icon, msg, cls, id: Date.now() })
            setTimeout(() => toasts.splice(0, 1), ms)
        }
        Alpine.store('toast', toast)
        Alpine.magic('toast', () => toast)

        const ta = (el, fn) => {
            const t = Object.assign(document.createElement('textarea'), { readOnly: true })
            t.className = 'absolute w-0 h-0 opacity-0'
            el.appendChild(t)
            fn(t)
        }

        Alpine.magic('clip', (el) => (text) => {
            text = typeof text === 'object' ? JSON.stringify(text) : String(text)
            ta(el, t => { t.value = text; t.select(); document.execCommand('copy'); t.remove() })
            toast('clipboard', 'Copied ' + text.split('\n').length + ' lines', 'alert-success')
        })

        Alpine.magic('paste', (el) => (cb) => {
            ta(el, t => {
                t.addEventListener('paste', () => setTimeout(() => cb(t.value), 0))
                t.addEventListener('focusout', () => t.remove(), { once: true })
                t.focus()
            })
        })

        // Outside click always closes any open <details class="dropdown">.
        // Inside-click closing is opt-in via `data-auto-close` on the <details>
        // — use it for picker/menu dropdowns; omit it for panel dropdowns that
        // contain inputs or other interactive content (those self-close on action).
        document.addEventListener('click', (e) => {
            document.querySelectorAll('details.dropdown[open]').forEach(d => {
                if (!d.contains(e.target)) { d.open = false; return }
                if (!d.hasAttribute('data-auto-close')) return
                const summary = d.querySelector(':scope > summary')
                if (!summary.contains(e.target)) d.open = false
            })
        })
    }

    document.addEventListener('alpine:init', registerMagics)

    const load = (src, cb) => {
        const s = document.createElement('script')
        s.src = src
        if (cb) s.onload = cb
        document.head.appendChild(s)
    }

    load('https://unpkg.com/@alpinejs/collapse', () => {
        load('https://unpkg.com/alpinejs')
    })
})()
