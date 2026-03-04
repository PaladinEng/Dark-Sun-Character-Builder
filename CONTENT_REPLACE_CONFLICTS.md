# Content Replace Conflicts

Pack: darksun
Entity Type: species
Target: srd52:species:human
Files:
  - species/mul.json
  - species/wasteland-human.json
Resolution: kept first file as replacement; removed `replaces` from remaining files.

Pack: darksun
Entity Type: backgrounds
Target: srd52:background:acolyte
Files:
  - backgrounds/templar-initiate.json
  - backgrounds/wasteland-hermit.json
Resolution: kept first file as replacement; removed `replaces` from remaining files.

Post-repair scan:
- No remaining duplicate replacement conflicts.
