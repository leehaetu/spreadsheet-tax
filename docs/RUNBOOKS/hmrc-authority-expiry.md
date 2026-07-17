# Runbook: HMRC authority expired or revoked

**Owner:** _TBD_ · **Last tested:** _

## Symptoms

- 401/403 from HMRC  
- User reports reconnect needed  
- `hmrc_connections.expires_at` past / `revoked_at` set  

## Steps

1. Mark connection unusable in DB  
2. Surface clear UI: “Reconnect to HMRC”  
3. Do not retry submit in a tight loop  
4. Guide individual vs agent re-auth journey  
5. After reconnect, verify scopes  
6. Resume only drafts still valid for period  
7. Audit event: authority_reconnected  

## Prevent

Proactive expiry warnings; refresh token handling per HMRC rules.
