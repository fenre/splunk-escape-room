# Nakatomi Plaza: Vault Heist — Story & Mysteries

Part 1 is the narrative (introduction, phase text, endings). Part 2 is the mystery/task catalogue (to be expanded).

---

## Part 1 — Story

### Introduction (read before play)

*Christmas Eve. Nakatomi Plaza, Los Angeles. A tower of glass and steel, and tonight there’s a party on the thirtieth floor. You’re not here for the party.*

*You’re part of the team that just took the building. While the rest of the crew secures the lobby and the floors above, your job is different: get into Nakatomi’s systems. Their access logs, their building controls, their vault protocols. Everything they thought was locked down. We need it.*

*There’s a vault in this building. Seven locks. Bearer bonds inside — a fortune. The man who knew the codes isn’t giving them up. So we crack it ourselves. You’ll use the data — in Splunk — to find the codes. You’ll enter them on the vault model in front of you. Open all seven seals before the police breach, before the loose cop in the building gets lucky, or before our own explosives change the plan. Move fast. One wrong move can end the night.*

*When we say go, get into the building’s data. Start with the lobby. Find your way in. Good luck.*

---

### Easter eggs

Easter eggs from the film (quotes, names, moments) are woven into narrative, Splunk log flavor, UI, and facilitator script. Use the table below to place them without overdoing it.

#### Quotes and spoken lines

| Quote / line | Source | Suggested placement |
|--------------|--------|----------------------|
| “Yippee-ki-yay” | McClane | Success ending (e.g. “We have the bonds. Yippee-ki-yay.”). |
| “Now I have a SPL. Ho-ho-ho.” | Variant of Hans | DESIGN.md tagline; optional in UI or success. |
| “Welcome to the party, pal.” | McClane | Phase transition when players hit party-floor / recon data. |
| “Come out to the coast, we’ll get together, have a few laughs.” | McClane | Intro or facilitator (twisted invite). |
| “We’re not terrorists — we’re something else.” | Hans | Intro or briefing. |
| “Now I have a machine gun.” | McClane | Phase transition when players get vault access. |
| “Hans, bubby, I’m your white knight.” | Ellis | Splunk log: `user=Ellis` or memo. |
| “I can get you in with Takagi.” | Ellis | Splunk log message or memo text. |
| “When they touch the vault, we’re rich.” | Hans | Facilitator script or phase transition. |
| “Just another American who saw too many movies.” | Hans (re: McClane) | Splunk log: e.g. `event=roof_access note="Just another American who saw too many movies"`. |
| “Shoot the glass.” / “That’s a great idea.” | Ellis / henchman | Log flavor or UI tooltip. |
| “Nine million terrorists in the world and I gotta kill one with feet smaller than my sister.” | McClane | Log or narrative (McClane activity). |
| “Ho-ho-ho.” | Hans | Log field: e.g. `badge_id=HO-HO-HO` or memo. |
| “I was in the neighborhood.” | McClane | Splunk log: McClane activity / incident. |

#### Characters and names

Use in log fields (`user`, `badge_id`, `contact`, `author`), UI labels, or narrative:

- **Hans**, **Takagi**, **Ellis**, **Holly**, **McClane**, **Argyle**, **Powell**, **Thornburg**, **Harry Ellis**, **Dwayne T. Robinson**.

#### Places and things

Use in `floor`, `location`, `asset`, or narrative:

- **30th floor**, **Nakatomi Plaza**, **roof**, **vault**, **bearer bonds**, **limo in the garage**, **“the coast”**, **“the party.”**

#### Moments (hinted)

Encode as short log messages or one-off narrative lines:

| Moment | Suggested use |
|--------|----------------|
| Cigarette on the roof | Log: `event=roof note="cigarette"` or similar. |
| “Shoot the glass” | Log flavor or facilitator. |
| Feet smaller than my sister | Log: McClane-related incident. |
| “No shoes” (McClane) | Log: e.g. `event=incident note="Subject reportedly barefoot"`. |
| FBI helicopters | Log: `event=response unit=FBI` or phase threat. |
| “Asian Dawn” (fake group) | Log or memo reference. |
| Vault’s seven locks | Narrative and UI (vault protocol). |
| Takagi’s refusal | Phase 3 narrative beat. |
| Hans falling | Game-over ending (“The plaza floor. Hans sends his regards.”). |

---

## Part 2 — Mysteries (task catalogue)

*To be expanded: one row per mystery (ID, phase/seal, story hook, objective, data source, SPL concept, solution, deliverable).*
