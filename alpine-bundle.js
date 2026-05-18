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

        const ta = (el, fn, readOnly = true) => {
            const t = Object.assign(document.createElement('textarea'), { readOnly })
            t.className = 'absolute w-0 h-0 opacity-0'
            el.appendChild(t)
            fn(t)
        }

        Alpine.magic('clip', (el) => (text) => {
            text = typeof text === 'object' ? JSON.stringify(text) : String(text)
            ta(el, t => { t.value = text; t.select(); document.execCommand('copy'); t.remove() })
            toast('clipboard', 'Copied ' + text.split('\n').length + ' lines', 'alert-success')
        })

        // $paste tries the modern clipboard API first — on iOS Safari this
        // shows the system "Paste from X" pill. Falls back to the hidden
        // textarea + paste-event approach when readText is unavailable or
        // permission is denied (older browsers, data: URLs, etc.).
        Alpine.magic('paste', (el) => async (cb) => {
            if (navigator.clipboard?.readText) {
                try {
                    const text = await navigator.clipboard.readText()
                    cb(text)
                    return
                } catch { /* fall through to legacy textarea path */ }
            }
            ta(el, t => {
                t.addEventListener('paste', () => setTimeout(() => cb(t.value), 0))
                t.addEventListener('focusout', () => t.remove(), { once: true })
                t.focus()
            }, false)
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

    // Small Alpine directives that decorate the host element via
    // dot-modifiers. Three tiers: class shortcuts (x-tip, x-lines, x-btn,
    // x-toolbar), reactive renderers (x-save-indicator, x-metric), and
    // behavior wrappers (x-action). The class-shortcut tier mirrors
    // helpers in kits/fills.js; the others are new. Modifier convention:
    // known variant tokens get the directive-name prefix (e.g. 'primary'
    // → 'btn-primary'); unknown tokens pass through as raw classes so
    // callers can sprinkle in Tailwind utilities (x-btn.xs.shadow-md).
    const registerDirectives = () => {

        const BTN_VARIANTS = new Set([
            'xs','sm','md','lg','xl',
            'primary','secondary','accent','info','success','warning','error',
            'ghost','outline','soft','wide','block','circle','square'
        ])

        // x-tip.<top|bottom|left|right>="'html body'"
        Alpine.directive('tip', (el, { expression, modifiers }, { evaluate }) => {
            const pos = ['top','bottom','left','right'].find(p => modifiers.includes(p)) || 'bottom'
            el.classList.add('tooltip', `tooltip-${pos}`)
            const body = document.createElement('div')
            body.className = 'tooltip-content bg-base-100 text-base-content border border-base-300 rounded-box shadow-lg p-3 text-xs text-left'
            body.innerHTML = expression ? evaluate(expression) : ''
            el.prepend(body)
        })

        // x-lines.<gap-N>  — flex column container; default gap-0.
        Alpine.directive('lines', (el, { modifiers }) => {
            el.classList.add('flex', 'flex-col')
            el.classList.add(modifiers.find(m => /^gap-\d$/.test(m)) || 'gap-0')
        })

        // x-btn.<size|variant|utility>="click expr"  — daisyUI button +
        // optional click handler. Known variant tokens get a 'btn-' prefix;
        // unknown tokens pass through as raw classes.
        Alpine.directive('btn', (el, { expression, modifiers }, { evaluateLater }) => {
            el.classList.add('btn')
            modifiers.forEach(m => el.classList.add(BTN_VARIANTS.has(m) ? `btn-${m}` : m))
            if (expression) {
                const exec = evaluateLater(expression)
                el.addEventListener('click', () => exec())
            }
        })

        // x-toolbar  — flex row with default toolbar layout.
        Alpine.directive('toolbar', (el) => {
            el.classList.add('flex', 'gap-2', 'items-center', 'justify-between', 'mb-2')
        })

        // x-save-indicator  — spinner; auto-shows when `saving` is truthy in scope.
        Alpine.directive('save-indicator', (el, _attrs, { effect, evaluateLater }) => {
            el.classList.add('loading', 'loading-spinner', 'loading-xs')
            const read = evaluateLater('saving')
            effect(() => read(v => { el.style.display = v ? '' : 'none' }))
        })

        // x-metric.<currency|percent>.trend[.invert]="{ label, val, prev }"
        // Renders a card with formatted value and optional trend indicator.
        // Re-renders reactively when the expression's deps change.
        Alpine.directive('metric', (el, { expression, modifiers }, { evaluateLater, effect }) => {
            el.classList.add('p-3','border','border-base-300','bg-base-200','flex','flex-col','min-w-[160px]','shadow-sm','rounded')
            const read = evaluateLater(expression)
            const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' })
            const fmtPercent  = new Intl.NumberFormat('en-US', { style: 'percent' })
            const fmtPct1     = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
            effect(() => read(data => {
                const { label, val, prev } = data || {}
                const disp = modifiers.includes('currency') ? fmtCurrency.format(val)
                          : modifiers.includes('percent')  ? fmtPercent.format(val)
                          : val
                let trend = ''
                if (modifiers.includes('trend') && prev !== undefined && prev !== 0) {
                    const diff = val - prev
                    const fav  = modifiers.includes('invert') ? diff <= 0 : diff >= 0
                    const pct  = fmtPct1.format(Math.abs(diff / prev))
                    trend = `<span class="text-xs ml-auto font-bold ${fav ? 'text-success' : 'text-error'}">${diff > 0 ? '▲' : '▼'} ${pct}</span>`
                }
                el.innerHTML = `
                    <div class="text-[10px] font-bold uppercase opacity-50 tracking-wider mb-1">${label ?? ''}</div>
                    <div class="flex items-baseline font-mono text-lg">${disp ?? ''}${trend}</div>`
            }))
        })

        // x-action[.confirm]="expr"  — wired click. With .confirm, first tap
        // arms (red, "Are you sure?") and second tap within 3s executes;
        // otherwise reverts.
        Alpine.directive('action', (el, { expression, modifiers }, { evaluateLater }) => {
            const exec = evaluateLater(expression)
            if (!modifiers.includes('confirm')) {
                el.addEventListener('click', () => exec())
                return
            }
            let armed = false, timer, orig = el.innerHTML
            el.addEventListener('click', () => {
                if (armed) {
                    exec()
                    armed = false
                    el.innerHTML = orig
                    el.classList.remove('btn-error')
                    clearTimeout(timer)
                } else {
                    armed = true
                    el.innerHTML = 'Are you sure?'
                    el.classList.add('btn-error')
                    timer = setTimeout(() => {
                        armed = false
                        el.innerHTML = orig
                        el.classList.remove('btn-error')
                    }, 3000)
                }
            })
        })
    }

    const initBundle = () => {
        try { registerMagics() }
        catch (e) { console.warn('alpine-bundle: registerMagics failed:', e) }
        try { registerDirectives() }
        catch (e) { console.warn('alpine-bundle: registerDirectives failed:', e) }
    }

    // If Alpine already loaded (e.g. another script raced ahead and
    // alpine:init has already fired), register synchronously.
    // Otherwise wait for the event.
    if (window.Alpine?.directive) {
        initBundle()
    } else {
        document.addEventListener('alpine:init', initBundle)
    }

    const load = (src, cb) => {
        const s = document.createElement('script')
        s.src = src
        if (cb) s.onload = cb
        document.head.appendChild(s)
    }

    if (!window.Alpine) {
        load('https://unpkg.com/@alpinejs/collapse', () => {
            load('https://unpkg.com/alpinejs')
        })
    }
})()
