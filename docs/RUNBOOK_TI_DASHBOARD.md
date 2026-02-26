# Runbook: Painel TI (IT Ops Dashboard)

## Overview
The IT Ops Dashboard provides real-time visibility into the ticket queue targeting the Tech sector, SLA compliance, workload distribution, and throughput metrics.

## Access
- **URL**: `/admin/ti`
- **Permission**: Admin-only
- **API**: `GET /api/admin/ti/dashboard?range=7d|30d`

## API Response Structure

```json
{
  "summary": {
    "open": 5,
    "inProgress": 3,
    "waiting": 2,
    "resolved": 10,
    "cancelled": 1,
    "slaOk": 6,
    "slaRisk": 3,
    "slaBreached": 1
  },
  "queue": [
    {
      "id": "uuid",
      "title": "...",
      "number": 42,
      "status": "ABERTO",
      "priority": "ALTA",
      "requesterSectorName": "BPO",
      "categoryName": "Infraestrutura",
      "createdAt": "2026-02-25T...",
      "currentCycle": {
        "firstResponseDueAt": "...",
        "resolutionDueAt": "...",
        "firstResponseAt": null,
        "resolvedAt": null
      },
      "assignees": [{"id": "...", "name": "João"}],
      "slaFirstResponseState": "OK|RISK|BREACHED",
      "slaResolutionState": "OK|RISK|BREACHED",
      "minutesToFirstResponseDue": 120,
      "minutesToResolutionDue": -30
    }
  ],
  "wipByAssignee": [
    {"userId": "...", "name": "João", "countActive": 5, "countRisk": 1, "countBreached": 0}
  ],
  "throughput": [
    {"date": "2026-02-25", "opened": 3, "resolved": 2}
  ],
  "backlogByCategory": [
    {"categoryName": "Infraestrutura", "count": 4}
  ]
}
```

## SLA State Calculation
- **OK**: SLA deadline is in the future with > 20% of time remaining and > 60 minutes left
- **RISK**: SLA deadline is approaching (<=20% of total time remaining OR <=60 minutes left)
- **BREACHED**: SLA deadline has passed (minutesDue is negative)

## Validation Steps

1. Navigate to `/admin/ti`
2. Verify summary cards show correct counts
3. Toggle range between 7d and 30d - throughput data should change
4. Check the queue table shows active tickets with SLA badges
5. Verify WIP table shows assignees with correct ticket counts
6. Verify backlog by category table matches active ticket distribution

## Troubleshooting
- If dashboard shows no data, ensure there are tickets with `target_sector_id` pointing to a sector
- SLA states require `ticket_sla_cycles` entries with `firstResponseDueAt` / `resolutionDueAt` populated
- The dashboard always uses the latest (highest cycle_number) SLA cycle per ticket
