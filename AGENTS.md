# Architecture rules
- Keep the principal command center as a read-only dashboard extension; other roles retain their existing modules and navigation.
- Dashboard aggregates run in authenticated server functions with the caller's RLS client and explicit temple authorization; never use an admin client for statistics.
- Dashboard period, scope and temple search live in URL search parameters so navigation and the existing temple selector share one scope.
- Read large dashboard datasets through paginated narrow projections to prevent silently truncated totals.- Temples link to countries through the `pays` table (`temples.pays_id`); the legacy `temples.pays` text is kept in sync by trigger because matricules and older screens read it.
- Pilotage optional datasets fail independently and are reported as unavailable, so one failing query never blanks the whole dashboard.
- EM is a separate additive module linked to existing members; mentor assignments grant only EM class access through narrow authenticated projections, never general member or financial access.
- EM admissions and report transitions are enforced atomically in database functions and triggers with immutable audit events; only the principal manages admissions and final approvals.
