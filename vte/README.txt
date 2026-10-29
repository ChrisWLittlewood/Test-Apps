VTE PIPING INSPECTION APP – v1.5 (trial)
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
