import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

for (const page of ['pets', 'discovery-consolidated-draft']) {
  const html = readFileSync(`public/${page}.next.html`, 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => ts.createSourceFile('page.js', m[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS))
  const fn = (name: string) => {
    for (const source of scripts) {
      const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
      if (node) return node.getText(source)
    }
    throw new Error(name)
  }
  const setup = (signedIn = true, ok = true) => {
    const button = { disabled: false, textContent: '' }
    const scope: any = {
      ME: signedIn ? { email: 'customer@example.test' } : null,
      document: { getElementById: () => button },
      fetch: vi.fn(async () => ({ ok, json: async () => ({ ok }) })),
      openSignin: vi.fn(), clearResume: vi.fn(), location: { reload: vi.fn() },
      console: { warn: vi.fn() }, REAL_PIECES: true,
      renderCollection: vi.fn(async () => {}), refreshWhileCrafting: vi.fn(),
    }
    runInNewContext(fn('onAuthButton') + '\n' + fn('paintMe'), scope)
    return { scope, button }
  }
  describe(`${page} same-button authentication`, () => {
    it('opens the existing sign-in dialog without issuing a sign-out request', () => {
      const { scope } = setup(false)
      scope.onAuthButton()
      expect(scope.openSignin).toHaveBeenCalledOnce()
      expect(scope.fetch).not.toHaveBeenCalled()
      expect(html).toContain('id="mhName" onclick="onAuthButton()"')
    })
    it('shows Sign out for an authenticated customer', () => {
      const { scope, button } = setup()
      scope.paintMe()
      expect(button.textContent).toBe('Sign out')
    })
    it('posts once, clears pending resume, and reloads the current category after success', async () => {
      const { scope, button } = setup()
      scope.onAuthButton()
      scope.onAuthButton()
      expect(button.disabled).toBe(true)
      await vi.waitFor(() => expect(scope.location.reload).toHaveBeenCalledOnce())
      expect(scope.fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/auth/signout', {
        method: 'POST', credentials: 'same-origin',
      })
      expect(scope.clearResume).toHaveBeenCalledOnce()
    })
    it('does not claim sign-out or clear work after a failed request', async () => {
      const { scope, button } = setup(true, false)
      scope.onAuthButton()
      await vi.waitFor(() => expect(button.disabled).toBe(false))
      expect(scope.clearResume).not.toHaveBeenCalled()
      expect(scope.location.reload).not.toHaveBeenCalled()
      expect(scope.ME).not.toBeNull()
    })
  })
}
