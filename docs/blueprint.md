# RealEstateLeadBot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that collects name, phone, and email from real-estate prospects and notifies an admin chat in real time. Users can submit multiple leads, view instructions, and access a privacy policy. Admins receive formatted lead notifications with user deep-links.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- prospective property buyers/renters
- real-estate business admins

## Success criteria

- Admin receives real-time notification for every submitted lead
- User can complete lead submission in 3-4 steps
- Bot validates phone/email formats before submission

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and welcome message
- **/new** (command, actor: user, command: /new) — Begin a new lead submission flow
- **/help** (command, actor: user, command: /help) — Show usage instructions
- **/privacy** (command, actor: user, command: /privacy) — Display privacy policy

## Flows

### Lead submission
_Trigger:_ /start or /new

1. Show welcome and purpose
2. Request name
3. Request phone
4. Request email
5. Show summary with confirmation options
6. Handle confirmation/edit/cancel

_Data touched:_ Lead

### Admin notification
_Trigger:_ Lead confirmation

1. Format lead details
2. Send to admin chat with user deep-link

_Data touched:_ Lead

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`env.<KEY>` on Workers). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID where new leads are notified
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` — never ask a user, never treat whoever writes first as the admin.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Lead** _(retention: persistent)_ — A prospect submission with contact details
  - fields: name, phone, email, timestamp, message, confirmed

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure admin chat ID for notifications
- View/export stored leads
- Edit privacy policy text

## Notifications

- Admin receives new lead notification with user deep-link
- User receives confirmation and summary after submission

## Permissions & privacy

- Only collect name, phone, and email as required fields
- Store leads with timestamps and confirmation status
- Provide /privacy command to view data-use policy

## Edge cases

- User cancels submission mid-flow
- Invalid phone/email format entered
- Admin chat ID is invalid or unreachable

## Required tests

- End-to-end submission flow from /start to admin notification
- Validation of phone/email formats rejects invalid entries
- Admin receives notification with correct deep-link to user

## Assumptions

- Owner will handle storage/export of leads separately
- Owner has already selected a single admin chat for notifications
- International phone formats will be accepted without country code validation
