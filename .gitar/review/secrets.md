# Secrets

The repo and every container image are public.

- Never put an API key, token, password or kubeconfig in code, manifests, a Dockerfile, a build argument, a test fixture, a log line or a commit message.
- Services read credentials from environment variables. In the cluster those come from Kubernetes Secrets via `secretKeyRef`, created by hand outside git (Secret `elastic` with keys `url` and `api-key`). Locally they come from `apps/*/.env.local`, which is gitignored.
- `.env.local.example` files contain placeholders only.
- The one credential allowed in client-side code is the Dash0 **browser** token, which can only ingest telemetry. Any other key reachable from the browser is a bug, including anything prefixed `NEXT_PUBLIC_` that holds a secret.
- Don't log request bodies or headers that may carry attendee contact details or tokens.
