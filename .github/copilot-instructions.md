# linos — Agent Instructions

## Mission
Maintain a minimalist, Linux-centered homelab OS: secure, reproducible, maintainable.
Focus on small, composable components and predictable behavior.

## Core Principles
- Security > Reproducibility > Simplicity
- No secrets in plaintext (use placeholders)
- Prefer minimal, reversible changes
- Documentation and tests are mandatory

## Architecture Assumptions
- Container-based services
- Reverse proxy in front of services
- Home automation integration supported
- Remote git hosting workflow

## Decision Rules (If → Then)
- If a change touches secrets → Abort PR, replace with <SECRET>, document setup.
- If a service needs a port → Use env variable; document mapping.
- If change is breaking → Bump major version; add migration note.
- If fix can be minimal → Keep patch small; include quick test.
- If cloud dependency proposed → Justify; prefer local/open-source first.

## Code Change Checklist
- Commit format: area(scope): short-description (≤72 chars)
- Update example.env or example config (no real values)
- Add minimal reproducible test or run command
- Healthcheck required for new services
- Keep commits small and focused

## Service Add Checklist
1. Dedicated service block
2. Healthcheck + restart policy
3. Proxy routing integration
4. Example environment file
5. Basic CI smoke test

## Security Rules (Hard)
- Never commit tokens, keys, passwords
- Use <SECRET>, <TOKEN>, <DOMAIN>
- Enforce least-privilege
- Prefer network isolation

## CI Requirements
- Lint config files
- docker compose config must pass
- Health-check smoke test required
- Larger changes require integration smoke test

## PR Policy
- Include purpose and scope
- Label: bug | feature | breaking | security
- Breaking changes require approval
- Keep PRs under 300 LOC when possible

## Failure Handling
- Reproducible bug → Add minimal failing test + issue
- Secret leak → Mark security, notify maintainers, rotate credentials
- If uncertain → Stop and mark help-needed

## Output Format
- Provide copyable commands or full config blocks
- Include exact file path
- No long explanations

## Placeholder Convention
- <SECRET>
- <TOKEN>
- <DOMAIN>
- Example user: linus
- Example port: ${SERVICE_PORT:-0}
