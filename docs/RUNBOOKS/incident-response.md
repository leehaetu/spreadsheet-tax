# Runbook: Incident response

**Owner:** _TBD_ · **Last tested:** _

## Severity

| Level | Definition | Response |
|-------|------------|----------|
| SEV1 | Data breach, live wrong submissions at scale, total outage in filing window | Immediate all-hands |
| SEV2 | Partial outage, security control failure without confirmed breach | Same day |
| SEV3 | Degraded feature | Next business day |

## Steps

1. Detect (alert / user report)  
2. Triage severity  
3. Contain (disable submit, rotate secrets, take offline if needed)  
4. Assess impact (tenants, time range) — **do not put NINOs in chat logs**  
5. Eradicate / fix  
6. Recover  
7. Notify (users, ICO if personal data breach criteria met — follow legal advice)  
8. Post-incident review within 5 business days  

## Contacts

| Role | Contact |
|------|---------|
| Product | Lee Hine |
| Engineering | |
| Legal | |
| Hosting | |

## Evidence to capture

- Timeline  
- Systems affected  
- Data categories (not raw tax IDs in tickets if avoidable)  
- Customer communications  
