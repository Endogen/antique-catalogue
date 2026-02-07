# Ralph BUILDING Loop

## Goal
Build a responsive web platform for cataloguing antique items with:
- Python/FastAPI backend with SQLite
- Next.js frontend with shadcn/ui
- Custom metadata schemas per collection
- Image upload (desktop + mobile browser camera)
- ~80% test coverage

## Context
- Read: specs/*.md (requirements)
- Read: AGENTS.md (commands, backpressure)
- Read: IMPLEMENTATION_PLAN.md (task list)
- Implement one task per iteration

## Rules
1. Pick the highest priority incomplete task from IMPLEMENTATION_PLAN.md
2. Read relevant code before making changes
3. Implement the task completely
4. Run backpressure (lint + test) from AGENTS.md
5. If tests pass: commit with clear message, mark task `[x]` in IMPLEMENTATION_PLAN.md
6. If tests fail: fix (max 3 attempts), then notify if still failing
7. Update AGENTS.md with any operational learnings
8. After each task, update IMPLEMENTATION_PLAN.md progress

## Task Completion
After completing a task:
```bash
git add -A
git commit -m "Task X.Y: <description>"
# Update IMPLEMENTATION_PLAN.md: change - [ ] to - [x]
```

## Notifications
When you need help or finish all tasks:
```bash
mkdir -p .ralph
cat > .ralph/pending-notification.txt << 'EOF'
{"timestamp":"$(date -Iseconds)","message":"<PREFIX>: <message>","status":"pending"}
EOF
```

Prefixes:
- `PROGRESS:` — Completed a major milestone
- `ERROR:` — Tests failing after 3 attempts
- `BLOCKED:` — Need clarification or missing info
- `DONE:` — All tasks complete

## Completion
When all tasks are done:
1. Change IMPLEMENTATION_PLAN.md status to `STATUS: COMPLETE`
2. Write notification with `DONE:` prefix
