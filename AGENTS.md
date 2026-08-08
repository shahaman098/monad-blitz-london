# AGENTS.md

This file defines how AI agents should work in this repository.

## Mission

Build and iterate quickly for a hackathon without requiring the user to hand-write code.

## Source Of Truth

Before changing code, read these files in order:

1. `docs/product.md`
2. `docs/architecture.md`
3. `docs/monad-reference.md`
4. `docs/tasks.md`
5. `README.md`

If those files conflict, `docs/tasks.md` is the execution queue and `docs/product.md` is the product boundary.

## Operating Rules

1. Do not ask the user to manually code, refactor, or wire files together if the agent can do it directly.
2. Prefer small end-to-end increments that result in a runnable state.
3. Update `docs/tasks.md` when starting or finishing meaningful work.
4. Keep implementation aligned with the current MVP. Avoid speculative work.
5. When the stack is still undefined, propose one concrete stack and then implement against that choice after approval or clear repo direction.
6. If a command or dependency choice is uncertain, choose the simplest option that optimizes for speed during a hackathon.
7. After each implementation step, run the relevant validation commands and report failures clearly.

## Definition Of Done

A task is done only when:

- the code is updated,
- the app still runs or builds,
- relevant tests or checks were run when they exist,
- `docs/tasks.md` reflects the new status,
- any new environment variables are documented in `.env.example`.

## File Layout

- `docs/product.md`: product brief and MVP scope
- `docs/architecture.md`: technical decisions and system design
- `docs/tasks.md`: prioritized backlog and current execution state
- `prompts/`: reusable prompt templates for common AI workflows

## Prompting Standard

Good prompts in this repo should:

- name the exact files to read first,
- define the desired user outcome,
- constrain scope to one task or feature slice,
- require the agent to run checks,
- require the agent to update docs when it changes the plan.

## Default Execution Pattern

1. Read the docs.
2. Pick the highest-priority open task.
3. Implement it fully.
4. Run checks.
5. Update `docs/tasks.md`.
6. Summarize what changed and what is next.
