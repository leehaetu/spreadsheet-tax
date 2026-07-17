# HMRC Production process — truth for Spreadsheet Tax

## Forget other product names

Planning and SDSTeam contact for **this** repo is **Spreadsheet Tax only**.  
Prior apps are process lessons only — not our application identity.

## Sandbox application (real)

```
e6751be5-fd22-4447-9e77-aa51729b1b46
```

Store for operators: Railway env optional `HMRC_SANDBOX_APPLICATION_ID`.

## Production application

**Not applied for.** Correct. Do not create until operational sandbox + checklist ready.

## What HMRC want (official)

From SDSTeam + e2e guide:

1. Software meets minimum functionality for the **build type**  
2. Compliant fraud prevention headers on MTD calls  
3. Testing requirements met **via software**  
4. **Production Approvals Checklist** completed and returned **in the form format shown**  
5. They review testing (including FPH) against that checklist  

They **check sandbox API activity in their logs** for your application ID.  
We **never email log packs**. Internal JSON under `docs/hmrc/` is operator notes only.

**Do not send SDSTeam until** automated journey shows SE period create/retrieve + property periods when businesses exist + EOY probes exercised.  
**Production app:** create only after HMRC path is ready / they grant process.

Official deliverables when ready:

- Their checklist `.docx` filled  
- Email with sandbox application ID  
- Live software that already produced traffic  

## Why double work (online + 12 days + checklist)

| Step | Feels like | Reality |
|------|------------|---------|
| Hub form / message / “interest in MTD” | “I already applied” | Ticket opened; often incomplete for Production |
| Wait under high MTD volume | Ignored | Queue; they said longer delays |
| Checklist issued | “Do it again” | Separate **approvals** artefact they score against |
| Follow-up questions on FPH/API | Silence | High volume; self-serve docs + sandbox testing |

This time we **finish the software** first, **then** one checklist return.

## FPH / API stuck questions

If SDSTeam don’t answer: keep shipping honest FPH (omit public port when unknown), test with Test Fraud Prevention Headers API, document missing-data note for the checklist comments. Do not invent headers.

## Checklist file on disk

`Downloads/Software-Approvals-Production-Checklist-2026-06-15-1.docx`  
(same form as `-2` and unnumbered copy)

Filled working copy for Spreadsheet Tax (sandbox ID filled, Production blank):  
`docs/hmrc/Spreadsheet-Tax-Production-Approvals-Checklist-FILLED.docx`  
and Desktop/Downloads copies (regenerated with sandbox ID).
