import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

for (const page of ['pets', 'discovery-consolidated-draft']) {
  const html = readFileSync(`public/${page}.next.html`, 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => ts.createSourceFile('page.js', match[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS))
  const fn = (name: string) => {
    for (const source of scripts) {
      const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
      if (node) return node.getText(source)
    }
    throw new Error(`Missing function ${name}`)
  }
  const setup = (status = 200) => {
    const piece = { key: 'pf:0', portfolioId: 'pf', previewId: 'art', locked: true,
      crafting: false, num: 1, art: '/api/v1/portfolios/pf/art/art' }
    const scope: any = {
      PIECES: [piece], UNLOCKED_ART: {}, INCLUDED_BY_PORTFOLIO: { pf: 1 }, JUST_LANDED: {},
      fetch: vi.fn(async () => ({ status, json: async () => ({ image_b64: 'CLEAN_MASTER' }) })),
      clearUnlockNote: vi.fn(), renderMyCollectionGrid: vi.fn(), renderCollection: vi.fn(),
      console: { warn: vi.fn() },
    }
    runInNewContext(fn('requestUnlock') + '\n' + fn('pieceLanded') + '\n' + fn('openFeatured'), scope)
    return { scope, piece }
  }
  describe(`${page}: owned artwork delivery`, () => {
    it('replaces the baked preview with server-authorized clean bytes immediately and through reconciliation', async () => {
      const { scope, piece } = setup()
      expect(await scope.requestUnlock('art', piece.key)).toBe('unlocked')
      expect(piece.locked).toBe(false)
      expect(piece.art).toBe('data:image/png;base64,CLEAN_MASTER')
      expect(scope.UNLOCKED_ART.art).toBe('CLEAN_MASTER')
      scope.pieceLanded({ ...piece, art: 'https://storage.test/signed-clean-master' })
      expect(scope.PIECES[0].art).toBe('data:image/png;base64,CLEAN_MASTER')
    })
    it('does not expose response bytes or change ownership when authorization fails', async () => {
      const { scope, piece } = setup(403)
      expect(await scope.requestUnlock('art', piece.key)).toBe('failed')
      expect(piece.locked).toBe(true)
      expect(piece.art).toBe('/api/v1/portfolios/pf/art/art')
      expect(scope.UNLOCKED_ART).toEqual({})
    })
    it('still refuses to open locked artwork full-size', () => {
      const { scope, piece } = setup()
      expect(() => scope.openFeatured(piece)).not.toThrow()
      // No viewer dependencies exist in this scope: reaching them would throw.
    })
    it('downloads the authorized clean bytes and never requests the baked preview', async () => {
      const { scope, piece } = setup()
      await scope.requestUnlock('art', piece.key)
      const blob = { clean: true }
      scope.fetch = vi.fn(async () => ({ blob: async () => blob }))
      scope.URL = { createObjectURL: vi.fn(() => 'blob:clean') }
      scope.saveBlobAs = vi.fn()
      scope.pieceTitle = () => 'Artwork'
      runInNewContext(fn('downloadPiece'), scope)
      expect(await scope.downloadPiece(piece)).toBe(true)
      expect(scope.fetch).toHaveBeenCalledExactlyOnceWith('data:image/png;base64,CLEAN_MASTER')
      expect(scope.URL.createObjectURL).toHaveBeenCalledWith(blob)
      expect(scope.saveBlobAs).toHaveBeenCalledWith('blob:clean', 'Artwork')
    })
    it('reload reconciliation accepts the clean server image when no cached piece exists', () => {
      const { scope } = setup()
      scope.PIECES = []
      scope.pieceLanded({ key: 'pf:0', previewId: 'art', locked: false, art: 'https://storage.test/clean' })
      expect(scope.PIECES[0].art).toBe('https://storage.test/clean')
    })
    it('removes only the featured-artwork panel from the Collection rail', () => {
      expect(fn('renderMycollRail')).not.toContain('featuredHtml()')
      expect(fn('renderMycollRail')).toContain('mycollBackRail')
    })
  })
}
