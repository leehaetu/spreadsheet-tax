# MTD ITSA vendor API roadmap — notes for Spreadsheet Tax

Source: https://developer.service.hmrc.gov.uk/roadmaps/mtd-itsa-vendors-roadmap/documentation/apis.html  
Changelog: https://github.com/hmrc/income-tax-mtd-changelog  

## Relevance filter

We are **in-year bridging** first (quarterly SE + property). EOY/CGT/losses are later unless we expand build type.

## Already released (include in planning)

### March 2026 (deployed)

| Item | Impact on us |
|------|----------------|
| Obligations: quarterly due dates → 7th of month (26-27+) | Obligation UI / reminders |
| Foreign property multi-property same country (Property 6 / related) | Foreign property mapping |
| Digitally Exempt rename (Individual Details / Calculations) | Status wording if we call those APIs |
| Transition profit fields (Calculations) | Only if we show calcs in-app |

### April–June 2026 (deployed samples)

| Item | Impact |
|------|--------|
| Individual Details extra enums | Mandation/status if we integrate |
| Business Details: update accounting type in-year | Optional later |
| SE Class 4 NICs adjustment data item (usable in year, not quarterly body) | Annual / calc path later |
| Accounts: penalties retrieve | Optional display later |
| Partner income / student loan plan 5 in Calculations | Out of SE+property bridging core |

## Upcoming (watch)

- **Sep 2026:** more calcs/accounts/allowances — mostly not quarterly-submit core  
- **Dec 2026 / Apr 2027:** whitespace, attachments, provisional figures — EOY-heavy  

## Planning rule

Ship **stable in-year quarterly** path first. Track roadmap for payload field changes on SE/Property 26-27; don’t expand to full EOY until in-year Production path is real.
