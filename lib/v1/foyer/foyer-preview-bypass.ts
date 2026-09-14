// lib/v1/foyer/foyer-preview-bypass.ts
//
// ════════════════════════════════════════════════════════════════════════
//   TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE
// ════════════════════════════════════════════════════════════════════════
//
// Rich's manual foyer testing on the PR #178 Preview needs more than three
// reveals. On a Vercel PREVIEW deployment ONLY, /api/v1/foyer/reveal skips
// the anonymous reveal allowance: GET says available, and POST neither
// claims nor finalizes an allowance row -- so a Preview reveal never adds
// to the allowance table the production deployment counts (the database
// is shared) and never touches the rows already in it.
//
// Nothing else changes, on any deployment: the intake's signed note and its
// age/face check, the intake's own abuse limit, the NB2 render, the prompts,
// the watermark and the six-effect reveal pool.
//
// THE SIGNAL is Vercel's own VERCEL_ENV, set by the platform on every
// deployment: 'production' on the production deployment, 'preview' on
// branch and PR deployments. Nothing a visitor sends can set it -- there is
// no parameter, cookie, header or secret URL. Production, and anything
// without the variable (local runs, tests), takes the normal path.
//
// Manual testing only. A Preview reveal is still a real NB2 render on the
// shared infrastructure; this is not permission for automated load.
//
// To remove: delete this file, and in app/api/v1/foyer/reveal/route.ts the
// marked import, the marked GET line, and the marked POST block (restoring
// the plain claimReveal checks and `claim.id` in the two finalizeReveal
// calls) -- i.e. revert that file to main.

export function previewAllowanceBypass(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === 'preview'
}
