// shared-uploader.js
// public/js/shared-uploader.js
//
// Reusable upload logic for Miniscape. Used by index.html and module pages.
// Exports a global MS_UPLOADER namespace with:
//   - readFileAsBase64(file): Promise<{b64, dataUrl, name}>
//   - hasSeenAnalyzer(): boolean
//   - markAnalyzerSeen(): void
//   - storeImageForHandoff(b64, name): void
//   - retrieveHandoffImage(): {b64, name, displayName?, suggestedModule?} | null
//   - clearHandoffImage(): void
//   - shouldAutoAnalyze(): boolean (true on first ever upload)
//   - showSubsequentPrompt(container, onYes, onLater): renders inline prompt

(function () {
  const COOKIE_NAME    = 'miniscape_seen_analyzer'
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds
  const HANDOFF_KEY    = 'miniscape_handoff_image'
  const SESSION_PROMPT_DISMISSED = 'miniscape_session_analyzer_dismissed'

  // ── COOKIE / FIRST-TIME LOGIC ───────────────────────────────
  function hasSeenAnalyzer() {
    return document.cookie.split('; ').some(row => row.startsWith(COOKIE_NAME + '='))
  }

  function markAnalyzerSeen() {
    document.cookie = `${COOKIE_NAME}=1; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
  }

  function shouldAutoAnalyze() {
    return !hasSeenAnalyzer()
  }

  function isSessionPromptDismissed() {
    try {
      return sessionStorage.getItem(SESSION_PROMPT_DISMISSED) === '1'
    } catch { return false }
  }

  function dismissSessionPrompt() {
    try { sessionStorage.setItem(SESSION_PROMPT_DISMISSED, '1') } catch {}
  }

  // ── FILE READING ────────────────────────────────────────────
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target.result
        const b64 = String(dataUrl).split(',')[1]
        resolve({ b64, dataUrl, name: file.name })
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  // ── IMAGE HANDOFF ACROSS PAGES ──────────────────────────────
  // We pass the uploaded image from index.html → module page via sessionStorage.
  // Includes optional display_name and suggested_module from the global analyzer.
  function storeImageForHandoff(payload) {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload))
    } catch (e) {
      console.warn('[uploader] sessionStorage write failed', e.message)
    }
  }

  function retrieveHandoffImage() {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function clearHandoffImage() {
    try { sessionStorage.removeItem(HANDOFF_KEY) } catch {}
  }

  // ── INLINE "RUN MINI ANALYZER?" PROMPT ──────────────────────
  // Shown for returning users (cookie set) on subsequent uploads within a module.
  // Sits inline near the upload preview. Dismissible — picking a side is sticky for the session.
  function showSubsequentPrompt(container, opts) {
    if (!container) return
    if (isSessionPromptDismissed()) {
      // Already dismissed this session — call onLater silently and skip
      opts?.onLater?.()
      return
    }

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'ms-subsequent-prompt'
    wrap.innerHTML = `
      <div class="ms-prompt-text">Run Mini Analyzer?</div>
      <div class="ms-prompt-actions">
        <button class="ms-prompt-btn ms-prompt-yes">Yes — analyze</button>
        <button class="ms-prompt-btn ms-prompt-later">Maybe later</button>
      </div>
    `
    container.appendChild(wrap)

    wrap.querySelector('.ms-prompt-yes').addEventListener('click', () => {
      wrap.remove()
      opts?.onYes?.()
    })
    wrap.querySelector('.ms-prompt-later').addEventListener('click', () => {
      dismissSessionPrompt()
      wrap.remove()
      opts?.onLater?.()
    })
  }

  // Inject minimal CSS for the inline prompt (so module pages don't all need to ship it)
  function injectPromptStyles() {
    if (document.getElementById('ms-uploader-styles')) return
    const style = document.createElement('style')
    style.id = 'ms-uploader-styles'
    style.textContent = `
      .ms-subsequent-prompt {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; padding: 0.75rem 1rem; margin-top: 0.5rem;
        background: rgba(184,146,74,0.08); border: 1px solid rgba(184,146,74,0.25);
        border-radius: 6px; font-family: 'Jost', sans-serif;
      }
      .ms-prompt-text { font-size: 0.78rem; letter-spacing: 0.04em; color: #B8924A; font-weight: 500; }
      .ms-prompt-actions { display: flex; gap: 0.5rem; }
      .ms-prompt-btn {
        padding: 0.4rem 0.85rem; font-size: 0.68rem; letter-spacing: 0.08em;
        text-transform: uppercase; border-radius: 4px; cursor: pointer;
        font-family: 'Jost', sans-serif; font-weight: 500; border: 1px solid transparent;
      }
      .ms-prompt-yes {
        background: #B8924A; color: #12100E; border-color: #B8924A;
      }
      .ms-prompt-yes:hover { background: #D4AC6E; }
      .ms-prompt-later {
        background: transparent; color: #8A8170; border-color: transparent;
      }
      .ms-prompt-later:hover { color: #D4AC6E; }
    `
    document.head.appendChild(style)
  }

  // Auto-inject styles on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPromptStyles)
  } else {
    injectPromptStyles()
  }

  // ── PUBLIC NAMESPACE ────────────────────────────────────────
  window.MS_UPLOADER = {
    readFileAsBase64,
    hasSeenAnalyzer,
    markAnalyzerSeen,
    shouldAutoAnalyze,
    storeImageForHandoff,
    retrieveHandoffImage,
    clearHandoffImage,
    showSubsequentPrompt,
    isSessionPromptDismissed,
    dismissSessionPrompt,
  }
})()
