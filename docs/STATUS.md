# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Version:** 1.5.0

## Volume / scale (this slice)

| Item | Status |
|------|--------|
| Railway volume `spreadsheet-tax-volume` | **Attached** at `/app/data` (5 GB Hobby) |
| `DATA_DIR=/app/data` | Set in production |
| Volume layout `db/ uploads/ exports/ backups/` | App creates on boot |
| SQL indexes for large client books | Shipped |
| Paginated client list API | Shipped (limit 50 default) |
| Dashboard SQL aggregates | Shipped |
| Design target | **600,000** customers |

**Resize above 5 GB:** Railway dashboard → volume → Live Resize (Pro plan).

## Demo

`demo@spreadsheet-tax.example` / `DemoPass123!`

## External remaining

HMRC production credentials, card billing, pen-test, legal pack, interviews, Postgres migration for multi-instance 600k.
