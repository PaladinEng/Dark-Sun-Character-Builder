# Dark Sun Character Builder — Update (May 31, 2026)

Big batch of bug fixes and new features just pushed. Here's what changed:

## Bug Fixes

- **Point Buy scores are now typeable** — the ability score inputs no longer snap to 8 or 15 on every keystroke. Type freely and the value commits when you leave the field or press Enter.
- **Class weapon proficiencies now display correctly** — Fighter shows "Simple Weapons, Martial Weapons", Cleric shows "Simple Weapons", etc. on the sheet and PDF.
- **Languages now show up** — all Dark Sun species grant their appropriate languages (Common + species language). Thri-kreen gets Kreen only.
- **Rogue now gets Thieves' Tools proficiency** — was missing from the class effects.
- **Rogue now gets Thieves' Cant** — the language appears in your languages list automatically.
- **Assassin subclass now grants Disguise Kit and Poisoner's Kit** — was previously just a placeholder label.
- **Nomad background proficiencies (Nature, Survival) were always working** — the bug was actually that skills weren't rendering in the PDF (see below).
- **Skills now appear in the PDF export** — the skills section was being computed but never drawn. Now shows all skills with proficiency markers on page 1.
- **Natural weapons now generate attack rows** — Aarakocra Talons and Thri-kreen Claws/Bite show up in the attack table with proper to-hit and damage.
- **Athasian Elf updated** — Trance replaced with Elf Sleep (4 hours normal sleep). New Elf Run trait added (endurance running for up to 7 days).

## New Features

- **8 new SRD backgrounds** — Artisan, Charlatan, Farmer, Guard, Guide, Merchant, Scribe, and Wayfarer are now available alongside the 13 Dark Sun backgrounds.
- **Background dropdown has group separators** — SRD Backgrounds and Dark Sun Backgrounds are now visually separated in the dropdown.
- **Half-feat ability bonuses** — 17 feats (Athlete, Durable, Sharpshooter, Resilient, War Caster, etc.) now apply their +1 ability score bonus. Feats with a choice show a dropdown to pick which ability gets the bonus. Fixed-bonus feats (like Durable → CON) apply automatically.
- **Language picker** — you can now select your 2 additional languages from the Dark Sun language catalog (City, Standard, and Exotic categories). Automatic languages from species/background show as locked.
- **Literacy checkboxes** — each language has a literacy toggle, defaulting to illiterate per Dark Sun rules. Check the box for any language your character can read and write.
- **Current HP is now editable** — a Current HP input sits next to Temp HP, defaulting to your max.
- **Custom spell entry** — add homebrew or custom spells by name with level, list (cantrip/known/prepared), and ritual/concentration flags. Custom spells appear on the sheet, print, and PDF alongside your regular spells.
- **Character save/load** — the Export section is now "Save / Load" with an Import JSON button. Download your character as JSON, then load it back later to continue building or level up.
- **Wild Talent is now a dedicated character feature** — moved out of the generic feature list into its own field with description display and a card in the Derived State section.

All changes pass the full 13-stage validation harness. Let me know if you hit any issues!
