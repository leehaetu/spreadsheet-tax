# Runbook: Restore from backup

**Owner:** _TBD_ · **Last tested:** _never — required before Production ready_

## Preconditions

- Backup location and credentials known  
- RTO / RPO documented in SECURITY-LAUNCH-GATE OPS-07  

## Steps

1. Declare incident SEV1/2 if production data loss  
2. Select backup snapshot by timestamp  
3. Restore to isolated instance first  
4. Verify row counts, latest submission_attempts, login  
5. Promote or re-point DNS only after verification  
6. Rotate secrets if breach-related  
7. Record exercise evidence (date, duration, gaps)  

## Success criteria

Restore completes within RTO; data loss within RPO; app healthy.
