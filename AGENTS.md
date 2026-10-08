# Architecture rules
- Keep the principal command center as a read-only dashboard extension; other roles retain their existing modules and navigation.
- Dashboard aggregates run in authenticated server functions with the caller's RLS client and explicit temple authorization; never use an admin client for statistics.
- Dashboard period, scope and temple search live in URL search parameters so navigation and the existing temple selector share one scope.
- Read large dashboard datasets through paginated narrow projections to prevent silently truncated totals.