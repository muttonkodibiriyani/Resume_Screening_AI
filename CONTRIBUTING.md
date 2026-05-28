# Contributing

Thanks for taking the time to contribute to Alshaya AI Recruit.

This is an internal Alshaya Group project. External contributions are welcome
on a best-effort basis but the maintainers prioritise internal roadmap items.

---

## 1. Code of conduct

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## 2. Branching & commits

- Branch off `main`, name `feat/<short>`, `fix/<short>`, `docs/<short>` etc.
- Follow **Conventional Commits**: `feat(scope): summary`, `fix(scope): summary`.
- Squash-merge into `main`; the PR title becomes the commit subject.

## 3. PR checklist

The PR template covers this — short version:

- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm run test` green
- [ ] `npm run test:e2e` green (or N/A)
- [ ] No new secrets committed
- [ ] Updated docs for any user-visible change
- [ ] Updated `CHANGELOG.md` under "Unreleased"

## 4. Security

If you find a vulnerability, **email security@alshaya.com** — do not file a
public issue. See [SECURITY.md](./docs/SECURITY.md#9-reporting-a-vulnerability).

## 5. Style

- Prettier + Tailwind plugin (`npm run format`).
- TypeScript strict mode; no `any` unless explicitly justified.
- No comments that narrate code (`// loop over users`); only the why.
- New UI components live under `src/components/ui/` and follow the design
  tokens in `src/app/globals.css`.

## 6. Tests

- New scoring logic must have a Vitest unit test that uses a fixture under
  `sample-resumes/` or `tests/fixtures/`.
- New API routes must have at least one happy-path and one auth-failure test.
- E2E tests live in `tests/e2e/` and run against the dev server.

## 7. Documentation

- Material code changes must update the corresponding doc in `docs/`.
- New AI prompts must bump their `PROMPT_VERSION` and be noted in
  [AI_PROMPTING.md](./docs/AI_PROMPTING.md#8-prompt-versioning).
- New ADRs follow the template in [`docs/ADR/0001-nextjs-app-router.md`](./docs/ADR/0001-nextjs-app-router.md).
