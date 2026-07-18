from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
# Prefer in-repo durable captures; fall back to Codex session path if present.
_REPO_SHOTS = ROOT / 'docs/audits/2026-07-18-all-screens/screenshots'
_CODEX_SHOTS = Path(
    '/Users/leehine/.codex/visualizations/2026/07/18/019f74af-b227-7fe3-bdd0-de75fc6b7d2a/all-screens-audit'
)
SHOT_DIR = _REPO_SHOTS if _REPO_SHOTS.is_dir() else _CODEX_SHOTS
OUTPUT = ROOT / 'output/pdf/spreadsheet-tax-all-screens-audit-2026-07-18.pdf'
# Also write a durable copy under docs/audits
OUTPUT_DOCS = ROOT / 'docs/audits/2026-07-18-all-screens/spreadsheet-tax-all-screens-audit-2026-07-18.pdf'


SCREENS = [
    ('01-sales-home-signed-out.png', '/', 'Sales homepage', 'P0', [
        'The page is far too long and repeats the same proposition several times.',
        'Replace repeated sections with one audience decision, one proof section, and one primary CTA.',
        'Use a real product review screenshot above the fold and make the four audience routes unmistakable.',
    ]),
    ('02-self-employed-signed-out.png', '/self-employed', 'Self-employed landing', 'P1', [
        'The hero is competent but generic and visually disconnected from the dark commercial pages.',
        'Show an actual spreadsheet-to-review example, specific supported records, and one clear conversion path.',
        'Add credible proof and remove unsupported reassurance until customer evidence exists.',
    ]),
    ('03-landlords-signed-out.png', '/landlords', 'Landlord landing', 'P1', [
        'The structure is clean but too sparse to answer real landlord objections.',
        'Explain UK, foreign, joint-property, and mixed-income boundaries precisely.',
        'Use a real mapped-property example and make template versus app CTAs visually distinct.',
    ]),
    ('04-professionals-signed-out.png', '/professionals', 'Professional landing', 'P0', [
        'Dense dark panels make the page feel like an internal dashboard rather than a trusted sales journey.',
        'Lead with the client-book problem, the controlled workflow, and an honest demo CTA.',
        'Add role, approval, authority, and audit evidence instead of broad scale language.',
    ]),
    ('05-firms-signed-out.png', '/firms', 'Firm landing', 'P0', [
        'The page promises firm control before the product has proven firm-scale operation.',
        'Reduce claims, label the workspace as a demonstration, and show the precise supported workflow.',
        'Add procurement information: security posture, tenancy, implementation, support, and licensing.',
    ]),
    ('06-license-signed-out.png', '/license', 'Licensing page', 'P1', [
        'The page looks like a legal/internal specification rather than a commercial licensing offer.',
        'Convert it into packages, eligibility, included support, implementation steps, and a contact CTA.',
        'Move intellectual-property detail to legal pages and keep recognition caveats prominent.',
    ]),
    ('07-pricing-signed-out.png', '/pricing', 'Pricing', 'P0', [
        'Experimental packages look purchasable even though there is no payment system.',
        'Hide or clearly disable purchase intent until checkout and entitlements exist.',
        'Explain billing period, limits, VAT, cancellation, support, and what each audience actually receives.',
    ]),
    ('08-how-it-works-signed-out.png', '/how-it-works', 'How it works', 'P1', [
        'The three-step explanation is too abstract and visually empty.',
        'Replace generic cards with real screenshots of upload, mapping, review, approval, and receipt.',
        'Explain what happens on errors, what is stored, and what preview versus HMRC submission means.',
    ]),
    ('09-security-signed-out.png', '/security', 'Security and HMRC', 'P0', [
        'The page is a wall of technical text with weak hierarchy and limited customer reassurance.',
        'Separate data handling, authentication, HMRC status, hosting, retention, and known limitations.',
        'Add evidence dates and remove any impression that partial controls equal an assured security posture.',
    ]),
    ('10-integrity-signed-out.png', '/integrity', 'Integrity statement', 'P1', [
        'This is useful reviewer material but is too technical and code-heavy for ordinary customers.',
        'Create separate customer and HMRC-review views, with human-readable evidence chains.',
        'Visually distinguish implemented, tested, sandbox-proven, and still-open controls.',
    ]),
    ('11-privacy-signed-out.png', '/privacy', 'Privacy policy', 'P0', [
        'The narrow column and oversized text create excessive scrolling and poor scanning.',
        'Add a contents list, clear controller/contact details, retention periods, rights, subprocessors, and deletion process.',
        'Have the final wording reviewed professionally before taking customer data.',
    ]),
    ('12-terms-signed-out.png', '/terms', 'Terms', 'P0', [
        'The page reads like a short placeholder rather than sale-ready software terms.',
        'Cover subscription, acceptable use, service levels, data, liability, cancellation, tax responsibility, and jurisdiction.',
        'Present a readable summary while retaining a complete legal document.',
    ]),
    ('13-help-signed-out.png', '/help', 'Help centre', 'P1', [
        'The accordion is visually monotonous and organised around implementation questions rather than user tasks.',
        'Group help by getting started, spreadsheets, HMRC, submissions, practices, billing, and account recovery.',
        'Add search results, contact/escalation routes, status information, and illustrated answers.',
    ]),
    ('14-templates-signed-out.png', '/templates', 'Templates', 'P1', [
        'The page is too thin for a key acquisition and onboarding surface.',
        'Offer separate self-employed, UK-property, foreign-property, and combined templates with previews.',
        'Explain required fields, examples, validation, versioning, and the next action after download.',
    ]),
    ('15-signin-signed-out.png', '/signin', 'Sign in', 'P0', [
        'Publishing demo credentials on the sign-in screen makes the product look unfinished and unsafe.',
        'Move demo access to a deliberately labelled demo route and keep production sign-in customer-focused.',
        'Add password visibility, clear validation, MFA flow, rate-limit messaging, and trust/support cues.',
    ]),
    ('16-register-signed-out.png', '/register', 'Registration', 'P0', [
        'The form is bare and provides no plan, consent, verification, or account-type context.',
        'Add individual versus practice selection, terms/privacy consent, password guidance, verification, and progress.',
        'Explain what happens next and avoid creating an account before the user understands the product state.',
    ]),
    ('17-app-signed-out.png', '/app', 'Quarterly app - signed out', 'P0', [
        'The app appears interactive while the user is signed out, creating confusing mixed states.',
        'Choose one explicit mode: public free check or authenticated product, and label it consistently.',
        'Reduce header links, simplify the upload card, and remove developer/preview terminology from the main journey.',
    ]),
    ('18-home-signed-out.png', '/home', 'Tax home - signed out', 'P0', [
        'A signed-out user sees a populated product dashboard plus a warning banner.',
        'Use a dedicated sign-in gate or a clearly labelled product preview, not a half-active dashboard.',
        'Remove controls that cannot work and replace the tiny banner with a decisive next step.',
    ]),
    ('19-onboarding-signed-out.png', '/onboarding', 'Onboarding - signed out', 'P0', [
        'A long setup form is exposed before authentication, despite requiring saved account data.',
        'Gate the page before rendering editable controls or provide a clearly non-persistent preview.',
        'Break setup into shorter steps with explanations, validation, and completion status.',
    ]),
    ('20-records-signed-out.png', '/records', 'Records - signed out', 'P1', [
        'The page shows empty product containers behind a sign-in warning.',
        'Replace with a focused authentication gate describing what records will be available after sign-in.',
        'Do not imply stored files or receipts exist when the viewer has no authenticated context.',
    ]),
    ('21-year-end-signed-out.png', '/year-end', 'Year end - signed out', 'P0', [
        'An unauthenticated visitor can see apparently actionable year-end controls and example figures.',
        'Gate the workflow, label demonstrations explicitly, and only expose workflows proven against HMRC sandbox.',
        'Clarify the distinction between quarterly updates, annual summaries, calculation, and final declaration.',
    ]),
    ('22-accountant-signed-out.png', '/accountant', 'Accountant workspace demo', 'P0', [
        'The dense table and many actions resemble a live client workspace despite being a demo.',
        'Make the demo state visually dominant and reduce the screen to the core client workflow.',
        'Improve hierarchy, table readability, action grouping, empty states, and responsive behaviour.',
    ]),
    ('23-practice-signed-out.png', '/practice', 'Practice dashboard demo', 'P0', [
        'The screen is extremely dense, small, and difficult to scan even at desktop size.',
        'Remove nonessential panels, enlarge core metrics, and separate portfolio, people, workflow, and reporting.',
        'Do not expose scale-oriented demo claims until capacity and tenancy evidence exists.',
    ]),
    ('24-portal-signed-out.png', '/portal', 'Client portal', 'P1', [
        'The token field dominates an otherwise empty page and offers little reassurance.',
        'Explain why the client received the link, which firm invited them, expiry, privacy, and support.',
        'Prefer secure magic-link resolution over requiring users to paste opaque tokens manually.',
    ]),
    ('25-workspace-signed-out.png', '/workspace', 'Practice workspace - signed out', 'P0', [
        'The full application shell renders behind an authentication error.',
        'Redirect to sign-in with a preserved destination or show a purpose-built access gate.',
        'Remove contradictory controls such as Not signed in alongside Sign out.',
    ]),
    ('26-connect-hmrc-signed-out.png', '/connect-hmrc', 'Connect HMRC - signed out', 'P0', [
        'The route silently becomes the generic sign-in screen, losing the HMRC-specific purpose.',
        'Explain that authentication is required, preserve the return path, and state what HMRC connection involves.',
        'Separate individual and agent journeys before the user begins.',
    ]),
    ('27-mtd-signed-out.png', '/mtd', 'MTD internal workspace', 'P0', [
        'This is an internal operator console exposed as a normal web screen.',
        'Remove it from customer navigation and restrict it to authorised operational roles.',
        'Replace raw API controls and responses with task-focused diagnostics and audit logging.',
    ]),
    ('28-billing-signed-out.png', '/billing', 'Billing - signed out', 'P0', [
        'The page presents selectable plans despite explicitly having no card charges.',
        'Do not show a purchase-like interface until real checkout exists.',
        'Use a waitlist/contact state or a transparent pricing explanation instead.',
    ]),
    ('29-account-signed-out.png', '/account', 'Account - signed out', 'P1', [
        'The complete account shell renders with meaningless dashes and a sign-in warning.',
        'Use a clean authentication gate; never render private-account structure before authentication.',
        'Remove internal navigation such as Admin from ordinary customer headers.',
    ]),
    ('30-history-signed-out.png', '/history', 'History - signed out', 'P1', [
        'Empty drafts and submissions tables appear behind a sign-in error.',
        'Replace them with a focused gate explaining receipts, history, and account requirements.',
        'Avoid exposing export actions when there is no authenticated record scope.',
    ]),
    ('31-forgot-password-signed-out.png', '/forgot-password', 'Forgot password', 'P0', [
        'The copy admits reset links are written to server logs, which is unacceptable for a sold product.',
        'Connect transactional email, add neutral success messaging, expiry, throttling, and support guidance.',
        'Align this light/dark choice with the final account design system.',
    ]),
    ('32-reset-password-signed-out.png', '/reset-password', 'Reset password', 'P0', [
        'The screen allows a new-password action without clearly showing token validity or identity context.',
        'Add expired/invalid-token states, confirmation, strength guidance, and session revocation.',
        'Do not render an actionable form without a valid reset token.',
    ]),
    ('33-accept-invite-signed-out.png', '/accept-invite', 'Accept practice invite', 'P0', [
        'The page shows an enabled-looking accept action despite a missing token.',
        'Disable actions until a valid invite is loaded and show firm, inviter, role, expiry, and email match.',
        'Give clear recovery paths for expired, wrong-account, and already-used invitations.',
    ]),
    ('34-admin-signed-out.png', '/admin', 'Admin - signed out', 'P0', [
        'An operations screen is publicly routable and reveals internal metric categories.',
        'Restrict the route before rendering, remove it from ordinary navigation, and enforce admin authorisation.',
        'Add audit, security-event, and monitoring context only for legitimate operators.',
    ]),
    ('35-legal-signed-out.png', '/legal', 'Legal notice', 'P1', [
        'The content is useful but visually resembles another internal dark panel page.',
        'Consolidate legal notice, licensing, privacy, and terms navigation with clear document ownership and dates.',
        'Use readable measure, table of contents, and professional legal review.',
    ]),
    ('36-home-signed-in.png', '/home', 'Tax home - signed in', 'P0', [
        'The primary dashboard is clean but lacks a strong status model and deadline context.',
        'Show next obligation, source readiness, blocking issues, HMRC connection, and recent receipt in one hierarchy.',
        'Replace repeated yellow labels with actionable state explanations.',
    ]),
    ('37-onboarding-signed-in.png', '/onboarding', 'Onboarding - signed in', 'P0', [
        'The setup experience is one long form with weak progress and dense choices.',
        'Turn it into a guided sequence: account type, HMRC, sources, periods, spreadsheet, confirmation.',
        'Prepopulate from HMRC where possible and explain every identifier and consequence.',
    ]),
    ('38-records-signed-in.png', '/records', 'Records - signed in', 'P1', [
        'The page combines sources, workbooks, drafts, and receipts without strong prioritisation.',
        'Add filters, period grouping, meaningful states, dates, receipt access, and clear primary actions.',
        'Distinguish uploaded originals, mapped drafts, submitted updates, and immutable evidence.',
    ]),
    ('39-year-end-signed-in.png', '/year-end', 'Year end - signed in', 'P0', [
        'The workflow is information-dense, uses small controls, and does not clearly communicate HMRC consequences.',
        'Use a stepper with locked completion rules, figures-under-review, approval, calculation, and receipt.',
        'Hide advanced/API-driven actions unless the workflow is genuinely supported and sandbox-proven.',
    ]),
    ('40-app-signed-in.png', '/app', 'Quarterly app - empty', 'P0', [
        'The main revenue journey begins with too much navigation, instructional copy, and competing sample choices.',
        'Focus the page on one upload action, one template fallback, and audience context already chosen upstream.',
        'Use a persistent progress header and reserve technical mode information for a secondary status panel.',
    ]),
    ('41-accountant-signed-in.png', '/accountant', 'Accountant workspace - signed in', 'P0', [
        'The page remains labelled demo even after sign-in, creating uncertainty about which data is real.',
        'Separate demonstration routes from authenticated customer workspaces completely.',
        'Redesign the client table around exceptions, deadlines, authority, assignee, and next action.',
    ]),
    ('42-practice-signed-in.png', '/practice', 'Practice dashboard - signed in', 'P0', [
        'The dashboard still compresses too many tiny panels and tables into one screen.',
        'Establish portfolio overview, workflow queue, team, reporting, and settings as separate views.',
        'Make demo versus real tenant state explicit and remove unsupported scale cues.',
    ]),
    ('43-portal-signed-in.png', '/portal', 'Client portal - signed in', 'P1', [
        'The portal does not recognise the signed-in user and still asks for a token.',
        'Resolve invitations/account membership automatically and show the relevant firm and requested task.',
        'Use a dedicated client journey for review, questions, approval, submission status, and receipt.',
    ]),
    ('44-workspace-signed-in.png', '/workspace', 'Practice workspace - signed in', 'P0', [
        'This is the strongest practice foundation but still resembles an admin CRUD screen.',
        'Prioritise needs-action clients, deadlines, authority, assignee, and approval rather than raw controls.',
        'Move destructive actions and firm administration out of every client row.',
    ]),
    ('45-connect-hmrc-signed-in.png', '/connect-hmrc', 'Connect HMRC - signed in', 'P0', [
        'Raw status JSON, sandbox utilities, identifiers, and submit controls are exposed together.',
        'Create a customer connection flow and move test utilities into a restricted operator console.',
        'Separate individual and agent OAuth, explain scopes, and show expiry/revocation recovery.',
    ]),
    ('46-mtd-signed-in.png', '/mtd', 'MTD internal workspace - signed in', 'P0', [
        'The screen is an API test harness, not a customer product surface.',
        'Restrict it by operational role and remove it from standard navigation.',
        'If retained, redesign around audited test runs, expected outcomes, and safe redacted diagnostics.',
    ]),
    ('47-billing-signed-in.png', '/billing', 'Billing - signed in', 'P0', [
        'The viewport is horizontally clipped and the plan cards overflow, exposing a basic responsive failure.',
        'Implement responsive card layout before anything else, then add real checkout and subscription state.',
        'Do not let Select imply a charge or entitlement until the backend performs both.',
    ]),
    ('48-account-signed-in.png', '/account', 'Account - signed in', 'P0', [
        'The page mixes profile, preferences, activity, password, billing, and technical counts into one dense screen.',
        'Split profile/security, notifications, billing, team, data/privacy, and activity into clear settings sections.',
        'Add MFA, session management, deletion/export, and verified contact state.',
    ]),
    ('49-history-signed-in.png', '/history', 'History - signed in', 'P1', [
        'Drafts and submissions use basic tables with weak period, source, and status context.',
        'Group by tax year and obligation; show HMRC state, receipt, correlation, correction links, and next action.',
        'Make destructive draft actions secondary and confirmation-protected.',
    ]),
    ('50-admin-signed-in.png', '/admin', 'Admin metrics - signed in', 'P0', [
        'Any signed-in demo user appears able to view operational metrics and invite controls.',
        'Enforce a real admin role and isolate operational tooling from customer accounts.',
        'Add security events, queue/worker health, HMRC errors, alerts, and audit rather than aggregate vanity counts.',
    ]),
    ('51-app-review-sample-signed-in.png', '/app after sample', 'Quarterly review - populated', 'P0', [
        'The core workflow works but the page becomes extremely long and visually fragmented.',
        'Use distinct Check, Review, Approve, Send, and Receipt steps instead of stacking the entire product vertically.',
        'Keep source-cell evidence available on demand while making totals, exceptions, approval, and HMRC payload primary.',
    ]),
]


def wrap(text, font, size, max_width):
    words = text.split()
    lines, current = [], ''
    for word in words:
        candidate = word if not current else current + ' ' + word
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, width, font='Helvetica', size=15, leading=21, color=HexColor('#293241')):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = landscape(A3)
    c = canvas.Canvas(str(OUTPUT), pagesize=(width, height))
    c.setTitle('Spreadsheet Tax - all screens audit - 18 July 2026')

    c.setFillColor(HexColor('#0b132b'))
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff'))
    c.setFont('Helvetica-Bold', 38)
    c.drawString(58, height - 92, 'Spreadsheet Tax - all screens audit')
    c.setFont('Helvetica', 19)
    c.drawString(58, height - 132, '51 captured states from the running application - 18 July 2026')
    y = height - 210
    for line in [
        'Verdict: the application has a working core, but the interface is not commercially coherent.',
        'Systemic problems: competing visual systems, exposed demo/internal controls, weak authentication gates,',
        'dense operational screens, poor responsive behaviour, inconsistent navigation, and unfinished states.',
        'Priority: simplify and finish the quarterly customer journey before expanding product breadth.',
    ]:
        c.setFont('Helvetica', 18)
        c.drawString(58, y, line)
        y -= 34
    c.setFillColor(HexColor('#ef476f'))
    c.roundRect(58, 110, width - 116, 105, 14, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff'))
    c.setFont('Helvetica-Bold', 20)
    c.drawString(82, 173, 'Truth status: Stage 2 of 5 - sandbox engineering')
    c.setFont('Helvetica', 16)
    c.drawString(82, 140, 'Not production-ready. Production API credentials are not the only missing component.')
    c.showPage()

    for index, (filename, route, title, priority, findings) in enumerate(SCREENS, start=1):
        image_path = SHOT_DIR / filename
        if not image_path.exists():
            raise FileNotFoundError(image_path)

        c.setFillColor(HexColor('#f4f7fb'))
        c.rect(0, 0, width, height, fill=1, stroke=0)
        c.setFillColor(HexColor('#111827'))
        c.setFont('Helvetica-Bold', 25)
        c.drawString(42, height - 48, f'{index:02d}. {title}')
        c.setFont('Helvetica', 13)
        c.setFillColor(HexColor('#52606d'))
        c.drawString(42, height - 72, f'Route/state: {route}  |  Source: {filename}')
        c.setFillColor(HexColor('#d90429') if priority == 'P0' else HexColor('#b26a00'))
        c.roundRect(width - 100, height - 67, 58, 27, 8, fill=1, stroke=0)
        c.setFillColor(HexColor('#ffffff'))
        c.setFont('Helvetica-Bold', 14)
        c.drawCentredString(width - 71, height - 58, priority)

        with Image.open(image_path) as im:
            iw, ih = im.size
        image_x, image_y = 42, 42
        image_w_max, image_h_max = 790, height - 138
        scale = min(image_w_max / iw, image_h_max / ih)
        draw_w, draw_h = iw * scale, ih * scale
        c.setFillColor(HexColor('#ffffff'))
        c.roundRect(image_x - 8, image_y - 8, image_w_max + 16, image_h_max + 16, 10, fill=1, stroke=0)
        c.drawImage(str(image_path), image_x + (image_w_max - draw_w) / 2, image_y + (image_h_max - draw_h) / 2,
                    width=draw_w, height=draw_h, preserveAspectRatio=True, mask='auto')

        panel_x = 875
        panel_w = width - panel_x - 42
        c.setFillColor(HexColor('#ffffff'))
        c.roundRect(panel_x, 42, panel_w, height - 138, 12, fill=1, stroke=0)
        c.setFillColor(HexColor('#111827'))
        c.setFont('Helvetica-Bold', 21)
        c.drawString(panel_x + 24, height - 128, 'Improvements needed')
        y = height - 168
        for finding in findings:
            c.setFillColor(HexColor('#2563eb'))
            c.circle(panel_x + 31, y + 4, 4, fill=1, stroke=0)
            y = draw_wrapped(c, finding, panel_x + 47, y, panel_w - 70, size=15, leading=21)
            y -= 22

        c.setStrokeColor(HexColor('#d5dce5'))
        c.line(panel_x + 24, y, panel_x + panel_w - 24, y)
        y -= 32
        c.setFillColor(HexColor('#111827'))
        c.setFont('Helvetica-Bold', 18)
        c.drawString(panel_x + 24, y, 'Acceptance check')
        y -= 28
        acceptance = 'Re-capture this state after the listed changes and verify desktop, mobile, keyboard, error, empty, loading, and authenticated/unauthenticated behaviour as applicable.'
        draw_wrapped(c, acceptance, panel_x + 24, y, panel_w - 48, size=14, leading=20, color=HexColor('#52606d'))

        c.setFillColor(HexColor('#667085'))
        c.setFont('Helvetica', 10)
        c.drawRightString(width - 42, 20, f'Page {index + 1} of {len(SCREENS) + 1}')
        c.showPage()

    c.save()
    try:
        import shutil

        OUTPUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(OUTPUT, OUTPUT_DOCS)
        print(OUTPUT_DOCS)
    except Exception as e:
        print(f'Could not copy to docs audit path: {e}')
    print(OUTPUT)


if __name__ == '__main__':
    main()
