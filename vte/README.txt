INSPECTION TOOLBOX – v1.8 (trial)
IMSn't · Isometricks · Gasket Case · Face Off
=========================================

Two parts:
  1. The app (this folder) – contains NO company data, safe to host on a web link.
  2. The data pack (e.g. LemanAlpha_DataPack_v1.0.json) – piping classes, plot plans,
     FM areas and reference charts. Keep it private; it is imported onto the phone only.

Install on Android
------------------
1. Host this folder on an HTTPS link (e.g. GitHub Pages) – only needs doing once.
2. On the phone, open the link in Chrome, then menu (⋮) -> "Install app" / "Add to Home screen".
3. Open the app from the home screen once while online – after that it works fully offline.
4. Copy the data pack file onto the phone (email to self, OneDrive, USB -> Downloads).
5. In the app: Settings -> Data pack -> Import data pack -> pick the file.

Your data
---------
Reports, photos and signatures are stored only on the phone. Use "Backup everything"
regularly – clearing Chrome's site data or uninstalling the app deletes them.

Updating
--------
App: replace the hosted files and bump VERSION in sw.js; the phone updates next time it is
opened with signal. Data pack: import the new pack file (Settings -> Replace data pack).

New in v1.5
-----------
- Revision clouds (box and freehand), double arrow and callout in every drawing tool; the isometric
  sketch tool now has the full markup set (arrows, lines, boxes, circles, clouds, highlighter, text) with colours.
- Home button on every screen, plus a yellow "Back to report" bar to jump back to the line you were working on.
- Save as PDF (Export step) – same layout as the Word report, uses the phone's "Save as PDF" print option, works offline.

New in v1.6
-----------
- Renamed IMSn't, with an atomic-age launch screen and new icons; version and "Check for updates" on the home screen.
- EP report number entered at Line prep; shown top right of every page in a header matching the EPE examination report form
  (logos and form reference come from the data pack – needs data pack v1.1).
- Service / fluid drop-down; "What to look for" page with likely damage mechanisms (API 571) and inspection tips (API 574).
- Flange sheets show the gasket specified by the piping class and its colour code.
- Photo observations: "+ Add photo observation" under each stage heading, each with its own photos; general photos at the bottom.
- Findings renamed CAIR items with a suggested action for the Area Inspector; "Not required" option.
- Report text in bullet points; permit to work removed.

New in v1.7
-----------
- Landing screen is now the Inspection Toolbox with three apps:
  IMSn't (pipework visual inspection reports), Isometricks (stand-alone iso sketches) and Gasket Case (flange sheets).
- Gasket Case: line no., flange no., pipe class and size -> nominal flange/bolting/gasket data, numbered bolt circle,
  stud-by-stud table with front and base A/F for each nut (sides A and B), PS 1.8 checks, photos, Word / PDF sheet.
- "Backup everything" now includes sketches and flange sheets.

New in v1.8
-----------
- Face Off: flange face inspection. ASME B16.5 face geometry, gasket seating band shaded, drag = scratch / tap = pit,
  each defect assessed by radial projection across the seating band (PCC-1 App. D method; limits editable and must be
  confirmed against the governing procedure), side A / B with aligned-defect warning, photos, Word / PDF.
- Iso tool: elbows / pulled bends / sharp corners, 45° offsets with hatched plane triangle, line-number tool,
  valve tags, labels sit beside the pipe and read along it; drag to move (leader arrow appears), rotate button.
