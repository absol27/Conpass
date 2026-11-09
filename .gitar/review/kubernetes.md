# Kubernetes and deploys

Every push to `main` deploys to our team's cluster through Argo CD. Manifests live in `deploy/` (kustomize).

## Hard limits of the hackathon cluster

Flag anything that breaks these. The cluster refuses it, and the pod sits in `Pending`.

- No privileged containers and no `hostPath`, `hostNetwork` or `hostPID`. This rules out most node agents and DaemonSet log collectors.
- No Services of type `LoadBalancer` or `NodePort`.
- The public URL routes only to **Service `app`, port 80**. Never rename or remove that Service.
- Total budget for everything we run: 2 CPU / 4 GiB of requests and 4 CPU / 8 GiB of limits, plus 4 PVCs. Point out PRs that add a lot of requests and say how much budget is left.

## Every Deployment

- Sets `resources.requests` and `resources.limits` on every container.
- Has `readinessProbe` (`/readyz`) and `livenessProbe` (`/healthz`), and listens on port 8080.
- Uses the restricted security context: `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `seccompProfile: RuntimeDefault`.
- Uses an image from `ghcr.io/absol27/conpass/<service>`. The package must be public, because the cluster pulls without credentials.

## GitOps

- Don't edit `images:` `newTag`/`newName` in `deploy/kustomization.yaml` by hand. The build workflow's bot commit owns them.
- Don't change replica counts or apply manifests directly on the cluster. Argo CD's self-heal reverts it; change git instead.
- Leave `deploy/httproute.yaml` in place even though it does nothing in our cluster.
