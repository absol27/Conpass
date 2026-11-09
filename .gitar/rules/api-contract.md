---
title: "API contract change needs its callers updated"
description: "A change to what an API route accepts or returns must update every caller in the same PR"
slug: api-contract
when: "PRs that change the request or response shape of an API route (apps/*/src/app/api/**), or of a type those routes return"
actions: "Find every caller of the changed route in the repo and fail the check if any still uses the old shape; comment with the file and line of each stale caller"
type: check
---

# API contract change needs its callers updated

Services and the browser talk to each other over HTTP, so TypeScript can't always catch a mismatch at build time. When a PR changes an API's contract, the callers have to change in the same PR.

**A contract change is any of:**
- a field added, removed, renamed or retyped in a route's JSON response or request body
- a changed query parameter, path or HTTP method
- a changed status code that callers branch on

**Where callers live:**
- browser code: `apps/web/src/lib/client.ts`, `apps/web/src/lib/store.ts`, and `fetch("/api/...")` calls in `apps/web/src/app/**` and `apps/web/src/components/**`
- other services that call the route over HTTP

**Pass** when every caller is updated, or the change is purely additive (a new optional field) and no caller needs it yet.

**Fail** when any caller still reads a removed or renamed field, sends the old request shape, or calls the old path. List each one with its file and line.
