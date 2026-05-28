# Pull Request

## Summary

<!-- 1-3 bullet points describing what this PR changes -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / chore
- [ ] Documentation
- [ ] Infra / CI
- [ ] Security

## Test plan

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:e2e`
- [ ] Manual smoke (specify steps below)

```
<paste steps>
```

## Security & privacy

- [ ] No new secrets committed (verified via `git diff --stat`)
- [ ] Touched RBAC, auth, or API surface? Updated `docs/SECURITY.md` if behaviour changed
- [ ] Touched scoring or AI prompts? Updated `docs/SCORING_ALGORITHM.md` / `docs/AI_PROMPTING.md`

## Screenshots / demos

<!-- For UX changes, attach before/after -->

## Rollout

- [ ] Backwards compatible
- [ ] Requires DB migration (`npx prisma migrate`)
- [ ] Requires new env var (documented in `.env.sample`)
