# Local interactive preview

This isolated browser prototype is an interim preview, not a replacement for the proposed Next.js/API architecture. The host has no Node/npm on PATH; the preview therefore uses plain HTML/CSS/JavaScript served by Python. No infrastructure or production deployment has been created.

It provides a searchable 44-tool directory and local merge, extraction and rotation using vendored pdf-lib 1.17.1 (MIT; licence included). Other tools explain their unavailable state. Files are processed in browser memory and not uploaded. No accounts or payment integration exists. This prototype does not preserve every advanced PDF construct; digitally signed, encrypted and complex form documents require additional support/testing. Input limits: 20 MB total and 200 pages total. Not a hardened processing sandbox.

Run from the repository root: `python3 -m http.server 8765 --bind 127.0.0.1` then open http://127.0.0.1:8765. No installation required. Browser PDF rendering uses the browser's built-in viewer in this prototype; PDF.js remains planned for the production frontend.

The newer brief adds Drive/Dropbox integrations, a truthful desktop page, richer merge/editor settings and text-based renaming. These remain planned alongside all prior scope. Paperly remains the configurable current brand; the newer brief allows changing it. Backend, billing, OCR/conversion engines and broad production acceptance remain outstanding.
