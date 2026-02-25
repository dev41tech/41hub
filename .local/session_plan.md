# Objective
Implement Approval Workflow + SLA Escalation + Webhooks:
1. Categories can require approval before TI starts working
2. SLA pauses during approval wait
3. SLA risk/breach auto-notifications with dedup
4. Configurable webhooks for n8n integration

# Tasks

### T001: Schema changes (shared/schema.ts) + DB push
- **Blocked By**: []
- **Details**:
  - Add AGUARDANDO_APROVACAO to ticketStatusEnum
  - Add to ticket_categories: requiresApproval (bool), approvalMode (varchar), approvalUserIds (text[])
  - Create ticket_approvals table (id, ticketId, cycleNumber, requestedBy, requesterSectorId, status, approverUserId, decisionNote, requestedAt, decidedAt) with unique(ticketId, cycleNumber)
  - Create ticket_alerts_dedup table (id, ticketId, cycleNumber, alertType, createdAt) with unique(ticketId, cycleNumber, alertType)
  - Add new event types to ticketEventTypeEnum: "approved", "rejected"
  - Add insert schemas and types for new tables
  - Run npm run db:push
  - Files: shared/schema.ts
  - Acceptance: Schema changes applied, db:push passes

### T002: Backend — Approval workflow (storage + routes)
- **Blocked By**: [T001]
- **Details**:
  - IStorage: add resolveApprovers, getTicketApproval, createTicketApproval, updateTicketApproval methods
  - Modify createTicket: if category.requiresApproval, set status=AGUARDANDO_APROVACAO, create approval record, pause SLA
  - Add routes: GET /api/tickets/:id/approval, POST .../approve, POST .../reject
  - Block status changes from AGUARDANDO_APROVACAO to EM_ANDAMENTO/RESOLVIDO without prior approval (409)
  - SLA pause on AGUARDANDO_APROVACAO entry, resume on approval (reuse existing pause/resume mechanics)
  - Create ticket_events and audit_logs for approve/reject
  - Send notifications on approve/reject
  - Files: server/storage.ts, server/routes.ts
  - Acceptance: Approval workflow functional end-to-end

### T003: Backend — SLA escalation job
- **Blocked By**: [T001]
- **Details**:
  - Create server/lib/sla-escalation.ts with startSlaEscalationJob()
  - setInterval every 5 minutes
  - Query active tickets with current SLA cycle (not paused, not resolved)
  - Check FIRST_RISK (within 4h), FIRST_BREACH (past due), RES_RISK (within 4h), RES_BREACH (past due)
  - Dedup via ticket_alerts_dedup unique constraint (insert ignore/catch)
  - Create notifications for admins and assignees
  - Import and call startSlaEscalationJob() in server/index.ts after registerRoutes
  - Files: server/lib/sla-escalation.ts, server/index.ts
  - Acceptance: Job runs, creates deduped alerts

### T004: Backend — Webhooks system
- **Blocked By**: [T001]
- **Details**:
  - Create server/lib/webhooks.ts with emitEvent(type, payload)
  - Read WEBHOOK_EVENTS_URL and WEBHOOK_EVENTS_ENABLED from admin_settings table
  - POST JSON with 5s timeout, 1 retry, fire-and-forget (async, no await in caller)
  - Include idempotencyKey: `${type}:${ticketId}:${timestamp}`
  - Types: ticket_created, ticket_approved, ticket_rejected, ticket_status_changed, ticket_commented, ticket_resolved
  - Call emitEvent at: ticket create (routes.ts POST /api/tickets), approve/reject endpoints, status change in PATCH, comment POST, resolve
  - Add admin routes: GET/PUT /api/admin/settings/webhooks
  - Files: server/lib/webhooks.ts, server/routes.ts
  - Acceptance: Webhooks fire on events when enabled

### T005: Frontend — Approval UI in ticket detail + status updates everywhere
- **Blocked By**: [T002]
- **Details**:
  - Add AGUARDANDO_APROVACAO to statusLabels, statusColors in detail.tsx
  - Show "Aprovação" card when status == AGUARDANDO_APROVACAO with approve/reject buttons (admin/approver only)
  - Modal with note field for approve/reject
  - For non-approvers: show "Aguardando aprovador" text
  - Add AGUARDANDO_APROVACAO to admin status select options
  - Update tickets/index.tsx status filter to include AGUARDANDO_APROVACAO
  - Files: client/src/pages/tickets/detail.tsx, client/src/pages/tickets/index.tsx
  - Acceptance: Approval flow visible and functional in UI

### T006: Frontend — Category approval config + Webhook settings
- **Blocked By**: [T002, T004]
- **Details**:
  - Admin ticket-categories.tsx: in General tab for subcategories, add toggle "Exigir aprovação", select approval mode (REQUESTER_COORDINATOR/TI_ADMIN/SPECIFIC_USERS), multi-select for SPECIFIC_USERS
  - Admin settings page: add "Integrações" section with webhook URL input and enable toggle
  - Save via existing PATCH category / PUT webhook settings
  - Files: client/src/pages/admin/ticket-categories.tsx, client/src/pages/admin/settings.tsx
  - Acceptance: Admin can configure approval requirements and webhooks

### T007: Final validation + listTicketsForUser update
- **Blocked By**: [T001-T006]
- **Details**:
  - Update listTicketsForUser in storage.ts to include AGUARDANDO_APROVACAO in active ticket filters
  - Run app, check health
  - Verify all status references updated
  - Files: server/storage.ts
  - Acceptance: App runs clean, all features integrated
