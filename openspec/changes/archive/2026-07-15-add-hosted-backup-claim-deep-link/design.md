## Context

The HTTPS email CTA and Substrate token verification are working. The missing
boundary is native URL registration/routing, and the copy/paste fallback is too
deep to serve as a paid onboarding path. The approved cross-repo design is in
`docs/superpowers/specs/2026-07-15-hosted-backup-claim-onboarding-design.md`.

## Goals / Non-Goals

- Goals: native cold/warm claim launch, prefilled setup, obvious manual fallback,
  exact cross-surface wording, and installed Windows verification.
- Non-goals: automatic claim consumption, token/API changes, recovery-flow
  weakening, or unrelated auth refactoring.

## Decisions

- Keep the email CTA HTTPS. The verified web page remains the trampoline for
  email-client compatibility and users without the app.
- Use Tauri's official deep-link plugin with the statically configured
  `endstate` scheme.
- Register the single-instance plugin first with its `deep-link` feature so a
  warm link focuses the existing `main` window and reaches the frontend event.
- Keep installed/static protocol registration as the primary path, then call
  the deep-link plugin's explicit `register("endstate")` during packaged
  Windows and Linux startup as a best-effort self-heal. Debug builds skip the
  repair so local development cannot replace the installed handler.
- Parse URLs in a pure TypeScript helper. Accept only host `claim`, no path,
  exactly one `token`, no unrelated query parameters, and a 43-character
  base64url token.
- Store a pending token only in React memory. Key the auth flow by a monotonic
  claim request id so a warm link reliably resets a half-entered form.
- If another account is signed in, require `Sign out and continue`; never
  overwrite cached credentials silently.
- Keep the existing engine `backup claim` command and recovery dialog as the
  only claim-consumption path.

## Risks / Trade-offs

- Custom protocols can be blocked by browsers. The verified web page always
  keeps Download Endstate and Copy code visible.
- Native plugin wiring is not proven by jsdom tests. Build checks and an
  installed Windows registry/cold/warm smoke are release gates.
- Runtime registration targets the current executable. A moved development
  binary or AppImage can therefore replace an older association; the next
  launch repairs it again. Registration failure must not block the app from
  opening, and no URL or token is involved in or logged by this step.
- Claim links are bearer credentials. Invalid URLs are rejected without
  echoing or logging the URL, and accepted tokens are never persisted.

## Migration Plan

No data migration is required. The next installed Endstate release registers
the scheme, and each Windows or Linux startup repairs missing registration for
the current executable. The installer remains responsible for removing its
owned registration during uninstall. Older versions continue to use the
promoted manual purchase-code path.
