/**
 * Canonical links for the open-source repo. Override with Vite env for forks.
 */
const trimSlash = (s: string) => s.replace(/\/+$/, '')

export const githubRepoUrl = trimSlash(
  (import.meta.env.VITE_GITHUB_REPO_URL as string | undefined)?.trim() ||
    'https://github.com/sp0oby/receivable-factoring-smart-contracts'
)

/** Markdown technical docs on GitHub (state machine, flows). */
export const technicalDocsUrl = `${githubRepoUrl}/tree/main/docs`

/** Single entry doc (deep link). */
export const stateMachineDocUrl = `${githubRepoUrl}/blob/main/docs/STATE_MACHINE.md`
