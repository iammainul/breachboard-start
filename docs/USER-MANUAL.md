# Breachboard user manual

How to run a live tabletop on Breachboard. Screenshots of the desk: [illustrated operator guide](./guide/README.md). For a timed first session, use the [walkthrough](./WALKTHROUGH.md). For journeys and QA checklists, see [USER-JOURNEY.md](./USER-JOURNEY.md).

## What Breachboard is

Breachboard is the live board for a facilitated cyber tabletop. Operators generate a scenario. Facilitators drive injects. Players join with a squad code, answer role questions, and earn points.

You do not need a separate projector app. **Present** is the facilitator controller. **Stage** is the room display.

## Who signs in

| You | Sign in? | You do |
|-----|----------|--------|
| Operator (admin) | Yes | Clients, people, generate, launch runs |
| Facilitator | Yes | Drive injects, Present, Stage, end the run |
| Player | No | Name + join code on `/join` |
| Observer | Seated | Watch only — no answers |

First operator login with `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` creates the admin user.

## The rail

The left rail is 248px on wide screens (1280px and up). Below that — tablets in the room and phones — it collapses behind **Open navigation** so the live console stays usable. Login and join have no rail.

- **Sun / moon** next to the mark — Pitch Obsidian (dark) or Toxic Phosphor Day. Preference is stored as `breachboard-theme`.
- **Workspace** — pick the client. Control, Engagements, Drafts, and Scenarios follow this org.
- **Play** — Control, Engagements, Draft runs, Scenarios (facilitators see only assigned clients).
- **Admin** — Organizations, Operators, Library, Generate, Intel, Settings (admin only).
- **Account** — your name (opens profile, password, 2FA) and **Sign out**. Same row style as Play / Admin — not a separate card.

## Account

Open **Account** in the rail.

- Change the name that appears on the roster and rail.
- Rotate your password.
- Turn on an authenticator (TOTP). After that, login asks for a six-digit code.

Theme is not in Settings. Use the sun/moon control.

## Operator desk

### Control

Home for the working organization: live count, seated people, answers this pulse, Now card, and cyber news. News **Generate** links pre-fill intel on `/generate`.

If no org is selected, pick one in Workspace. The page title stays **Control**.

### Organizations

Create a client (name, sector, notes). Upload org docs if the generate flow should ground in their stack.

### Operators

Invite or import facilitators. Allocate them to clients so they only see those orgs.

### Scenarios and Library

- **Scenarios** — drafts and accepted packs for the workspace.
- **Library** — install a pack, then accept it for the client.
- **Generate** — AI SitMan from sector, APTs, advisories, and stack notes. Accept before you launch a real engagement.

### Intel

Feeds, ATT&CK groups, CVEs, advisories. Use as generate input, not as the live room.

### Settings

- **AI providers** — keys, default model, test, intel onboarding.
- **Email** — SMTP for role invites.
- **Operations** — capacity guidance for large rooms.

`/settings` opens AI providers.

### Engagements vs draft runs

| | Engagement | Draft run |
|---|------------|-----------|
| Purpose | Client facilitation | Rehearsal / QA |
| Role coverage | Required playbook seats before go-live | Bypassed |
| Where | Engagements | Draft runs |

Creating a run seats you as facilitator when your account can facilitate.

## Facilitator — live room

Open the session from Engagements or Drafts.

1. Confirm the **squad code** (mono, with QR). Share it or send role invites.
2. **Start exercise** — phase becomes discuss (~2 minutes). Players see the inject, not the answer box.
3. **Open questions** — answering. Players on the active team submit.
4. **Open projector / Present** — your controller. Stage opens for the room display (drag that window to the projector).
5. **Release next inject** or **Open debrief**, then **End exercise**.

Present fills the screen: inject map, current narrative (and media), completion, presence. Notes on Present are private — they are not synced and do not appear on Stage.

If you see **Seat myself as Facilitator**, click it. Admin without a moderator seat cannot go live.

## Player — join and answer

1. Open `/join` or a `/join/CODE` link.
2. Enter how you appear on the roster and the squad code.
3. Leave Advanced closed unless you have an invite token or role card.
4. During **discuss**, watch the inject and timer.
5. During **answering**, submit your role’s response. Points post after scoring.

Closed or archived codes are rejected. You do not create an account to play.

## Join codes, IDs, and clocks

Squad codes, ATT&CK IDs, and hashes are shown in IBM Plex Mono. The discuss window and inject timer are shared — every seat sees the same remaining seconds.

## Local and Docker URLs

| Mode | URL |
|------|-----|
| Local `./run.sh` | http://localhost:3000 |
| Docker `./run.sh docker` | http://localhost:3080 |

Demo Northline Bank seed: join code **DEMO01** (see [walkthrough](./WALKTHROUGH.md)).
