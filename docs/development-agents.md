# Development agent workflow

The project defines eight specialist development agents. They support the primary coding agent; they are separate from CRM users, administrators and access roles.

## Agent catalogue

| Agent                                                                | Responsibility                                                                           | Default sandbox | Current use                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| [senior_architect](../.codex/agents/senior_architect.toml)           | Software and solutions architecture, safe refactoring plans and independent code reviews | Read-only       | Frontend architecture now; whole-system decisions when assigned |
| [product_designer](../.codex/agents/product_designer.toml)           | Journeys, visual hierarchy, approved design and interaction specifications               | Read-only       | Frontend design review                                          |
| [frontend_engineer](../.codex/agents/frontend_engineer.toml)         | React UI implementation, shared components, hooks and safe refactoring                   | Workspace write | Assigned frontend files                                         |
| [qa_accessibility](../.codex/agents/qa_accessibility.toml)           | Independent acceptance, regression, keyboard, responsive and visual verification         | Workspace write | Assigned tests, fixtures and evidence                           |
| [security_engineer](../.codex/agents/security_engineer.toml)         | Authentication, workspace authorization, exposure and security review                    | Read-only       | Review current boundaries and later backend security            |
| [backend_database](../.codex/agents/backend_database.toml)           | CRM API, PostgreSQL, migrations, persistence and audit integrity                         | Workspace write | Explicitly assigned backend phase                               |
| [devops_release](../.codex/agents/devops_release.toml)               | Automated checks, environments, release, monitoring and recovery                         | Workspace write | Frontend CI when assigned; hosted operations later              |
| [integrations_engineer](../.codex/agents/integrations_engineer.toml) | Email, WhatsApp and Calendar provider authorization, delivery and sync                   | Workspace write | Explicitly assigned integrations phase                          |

The architect combines software architecture (code, domains, data and service contracts) and solutions architecture (business fit, hosting and provider boundaries). Separate these roles if their workload later requires independent ownership.

## Shared rules

Every definition directs the specialist to read `AGENTS.md`, this workflow, the architecture and relevant feature documentation. UI decisions follow the [Product design standards](design-standards.md), [approved refresh](design-refresh.md) and its reference previews.

- Keep each changed code, configuration or test file within 150 physical lines after formatting. Split by responsibility; preserve CSS import order and specificity.
- Preserve storage keys, record relationships, workbook mappings, backups, media and calculations.
- Keep records, reports, exports and recipient directories in the correct workspace. Preserve Super Admin visibility and actor attribution.
- Preserve existing uncommitted work. Own only assigned files and coordinate shared changes with the primary agent.
- Return concrete evidence and limitations. A plan, successful mock or passing automated check does not establish completed implementation, provider delivery or full accessibility conformance.
- Use existing task authorization; reviews and handoffs are coordination steps, not new user approval gates.

The active phase remains frontend development. Authentication, invitations and messaging are local previews; Calendar connection and sync stay deferred. Adding agent definitions does not create backend services, connect accounts, send messages, publish a deployment or provision paid resources.

## Task assignment and handoffs

The primary agent retains the user's objective and decides which specialists are useful. It should assign a concrete outcome, affected files/contracts, allowed write set, acceptance criteria and relevant checks. Specialists do not start nested agents.

The frontend workflow is:

1. **Architecture:** trace the affected code, identify contracts and plan safe changes.
2. **Product design:** specify the interaction and layout using the approved baseline.
3. **Frontend implementation:** make the assigned changes and run appropriate checks.
4. **QA and review:** independently exercise the flow and review architecture/security where relevant.
5. **Completion:** the primary agent resolves findings, confirms the evidence and reports results and remaining limitations.

Scale the workflow to the task. A small copy change needs fewer specialists than a new workspace or messaging flow. Independent research may run in parallel. Keep shared CSS/configuration edits coordinated and browser suites sequential when they use the same server port or artifact directory.

The project configuration caps specialist concurrency at three, alongside the primary agent. Actual session limits may be lower. Run only the specialists needed for the current task.

QA owns tests, fixtures and evidence rather than application fixes. Architecture, product design and security return findings/specifications without editing files. The frontend or appropriate later-phase engineer implements fixes; the primary agent checks acceptance.

## Proportionate process (owner decision 2026-10-14)

Match the process to the risk so small changes ship quickly.

| Change                                                                                                                   | Process                                                                | Checks                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Small, low-risk** (a field, label, option, filter, copy or styling fix)                                                | One specialist builds it; no separate design, security or QA pass      | Targeted tests for the touched area, `npm test`, build, format and `check:lines` |
| **Medium** (new screen section, workflow or API endpoint)                                                                | Implementer plus one QA pass                                           | Add the full `npm run test:api` and connected browser suite once per batch       |
| **Sensitive** (accounts, sessions, passwords, permissions, record visibility, imports, data deletion, external delivery) | Design and security review before building, then implementation and QA | Full suites, security re-check of the fixes                                      |

Batch several small changes and run the full suites once at the end of the batch rather than after each change. The demo is frozen, so demo browser tests are not part of any tier.

### Token-efficient working (owner decision 2026-10-15)

The owner-approved [delivery protocol](token-efficient-delivery.md) is the default operational checklist for this section.

- **Small changes** are made directly by the primary agent, without a specialist.
- **Medium changes** use one implementing specialist; GitHub Actions CI is the QA pass.
- **Sensitive changes** keep the full design and security review.
- **Locally**, run only targeted tests for the touched area plus quick checks (`npm test`, format, `check:lines:ci`, `check:boundaries`, and `cargo fmt`/Clippy/tests when Rust changed).
- **Full suites run in CI.** The API and connected browser suites run there after a push; read only the run summary, and fetch logs only for failing jobs. Run the full suites locally only to diagnose a CI failure, or before merging sensitive work.
- **Specialist reports** are short: changes, check results and problems in about ten lines.
- **Batch the work.** Batch owner decisions and small tasks, and update docs once per feature.
- **Fresh sessions.** Start a new session per feature; decisions live in the docs, the roadmap queue and project memory.
- **Model choice.** Routine mechanical work may use a lighter model. Design, security and finance stay on the strongest model.

## Configuration and compatibility

`.codex/agents/<name>.toml` contains each agent's `name`, `description`, `developer_instructions` and sandbox default. `.codex/config.toml` enables agents and sets the concurrency cap. Model and reasoning settings are omitted so specialists inherit the parent/default selection. Live permission overrides and platform limits still apply.

The files use the project-specific custom-agent format documented in [official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents). Automatic discovery requires a compatible Codex client that loads the project configuration. Follow the client's project-trust and reload behaviour; do not assume files have been discovered just because they exist.

At setup, the installed terminal executable reported `codex-cli 0.31.0`; its help predates this custom-agent configuration. The role definitions were validated as TOML, but native loading was not verified with that older CLI. Use an updated compatible client for automatic discovery.

In a session with delegation tools but without automatic custom-agent discovery, the primary agent can read the selected TOML and pass its instructions into the delegated task. This uses the same role guidance; the session's tool and permission policy governs that agent. If delegation is unavailable, the primary agent can apply the relevant review/implementation checklist itself and describe which checks it performed.

## Invocation examples

These requests name the role and concrete outcome; the primary agent supplies the task boundaries and evidence.

- “Use senior_architect to plan safe splits of the remaining oversized frontend files. Preserve behaviour and identify the required checks.”
- “Have product_designer review the contact picker against the approved look. Have frontend_engineer implement the agreed changes and qa_accessibility verify both themes and keyboard use.”
- “Ask security_engineer to review workspace scopes in recipient searches and exports. Return reproducible findings with file references.”
- “Use devops_release to prepare frontend CI for the existing scripts. Report current failures without disabling checks.”

Backend, real authentication and provider delivery require their own assigned implementation scope. Their agents are defined now so those later tasks have clear owners.

## Verification

Parse configuration and role definitions as TOML; check required fields, unique names, sandbox defaults, references and file sizes. Run formatting checks on the Markdown instructions and documentation. `node scripts/check-file-size.mjs .codex` checks the new configuration files; `npm run check:lines` reports the whole repository, including older outstanding violations.

Creating these instructions does not change application code, so it requires configuration/document checks rather than rerunning unrelated UI flows. On future implementation tasks, follow `AGENTS.md` and the assigned role's unit, build, browser or service checks.

Setup verification passed for all eight definitions and the project configuration: TOML parsing, required fields, unique names, sandbox defaults, documentation references and the focused 150-line check. Repository formatting and whitespace checks passed. A separate architecture agent reviewed the files through role-guided delegation and found no substantive setup defects.

The whole-repository size check still reports 53 existing oversized files. Native automatic discovery and runtime enforcement of the configuration were not tested with the older installed CLI; successful role-guided review does not establish those client behaviours.
