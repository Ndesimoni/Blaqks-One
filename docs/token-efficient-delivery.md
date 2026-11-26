# Token-efficient delivery protocol

Owner-approved default from 18 October 2026. Use this protocol for future work unless the owner asks for a different process.

The packet order and DeepSeek-to-Codex handoff are defined in [Blaqks One implementation plan for DeepSeek delivery](deepseek-delivery-plan.md).

## One packet per session

- Use one fresh session for each roadmap packet or clearly bounded feature.
- Read only `AGENTS.md`, the relevant roadmap/design section, affected files and a compact Git status/diff summary.
- Keep durable decisions, completed checks, limitations and the next packet in the relevant project document. Do not rely on a long conversational handoff.

## Proportionate specialists

| Change                                                                       | Default process                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Small copy, field, style or focused fix                                      | Primary agent implements directly                              |
| Medium screen, workflow or endpoint                                          | One implementing specialist; CI is the broad QA pass           |
| Sensitive authentication, permissions, finance, deletion or integration work | Focused design/security review, one implementer and focused QA |

Do not start several specialists for routine work. Specialist reports should stay near ten lines: changes, checks, problems and limitations.

## Layered verification

During implementation, run only tests for the changed feature plus relevant quick checks:

- formatting and `npm run check:lines:ci`;
- `npm run check:i18n` or `npm run check:boundaries` when affected;
- one focused connected browser specification when UI/API wiring changes;
- focused Rust formatting, Clippy or tests when Rust changes.

At packet completion, run `npm test`, `npm run build` and the applicable focused service checks. GitHub Actions runs the complete API and connected browser suites. Read the CI summary first and fetch logs only for failed jobs. Use the disposable Docker database for connected tests and never development data.

## Compact output

Tool output should normally report only the command name and pass/fail status. Show the relevant error tail when a command fails. Avoid printing complete files, full test logs or broad repository searches when a focused read answers the question.

Progress updates use this format:

```text
Changed:
- ...

Checks:
- ...

Problems:
- ...

Next:
- ...
```

## Packet checkpoint

Before moving to the next packet:

1. Review the focused diff and `git diff --stat`.
2. Complete the packet checks.
3. Update the roadmap or feature handoff once.
4. Commit only when the owner authorizes it.
5. Start the next packet in a fresh session.
