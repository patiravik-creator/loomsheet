"use strict";
/* Per-tool page content: a short intro, how-to steps, common questions, and tools people use next.
   Used in two places: app.js renders it under the tool, and scripts/build-pages.js writes the same HTML
   into each generated page so search engines see real text, not just a title. Edit here, then re-run
   `node scripts/build-pages.js` so the static pages match. */

window.TOOL_CONTENT = {
  compress: {
    intro: "Shrink a PDF so it's easier to email, upload, or store. Light compression rebuilds the file and keeps text selectable and searchable; strong compression redraws every page as an image for the biggest savings, which suits scans and photo-heavy files.",
    steps: ["Drop your PDF in the box or click to choose it.", "Pick Light to keep text selectable, or Strong for the smallest file, and adjust image quality if you like.", "Press Compress and download the smaller file."],
    faq: [
      ["How much smaller will my PDF get?", "It depends on what's inside. Files full of large photos or scans shrink the most; text-only files are already small and may barely change. Strong compression usually saves the most."],
      ["Will the text still be selectable?", "With Light, yes — the text is kept as text. Strong turns each page into an image, so text is no longer selectable; run PDF OCR afterwards if you need it back."],
      ["Is there a file size limit?", "There's no fixed limit, but everything runs in your browser's memory, so very large files depend on your device. Batch Compress handles many files at once."]
    ],
    related: ["batch-compress", "merge", "resize-pages", "split"]
  },
  "batch-compress": {
    intro: "Compress a whole folder of PDFs in one go and download them together as a zip. It uses the same Light and Strong modes as the single-file tool, applied to every file you add.",
    steps: ["Add as many PDFs as you like — drop them all at once.", "Choose Light (text stays selectable) or Strong (pages become images).", "Press Compress; you'll get one zip with every file inside."],
    faq: [
      ["Do the files keep their names?", "Yes. Each compressed file keeps its original name inside the zip."],
      ["Can I mix light and strong?", "Not in one batch — the level applies to every file. Run the batch twice with different files if you need both."],
      ["What if one file fails?", "The others still finish. A file that can't be read (damaged or password-protected) is reported and skipped."]
    ],
    related: ["compress", "merge", "zip-to-pdf", "repair"]
  },
  merge: {
    intro: "Combine several PDFs into a single file, in exactly the order you choose. Handy for joining a cover letter to a CV, stitching scanned chapters together, or bundling receipts.",
    steps: ["Add two or more PDFs — drop them together or one at a time.", "Use the arrows to put them in the right order, or remove one you don't need.", "Press Merge and download the combined PDF."],
    faq: [
      ["Is there a limit on how many files I can merge?", "No fixed limit. Very large combined files depend on your device's memory, since it all happens in your browser."],
      ["Will bookmarks and form fields survive?", "Page content, text and images carry over exactly. Bookmarks and interactive form fields from the separate files aren't rebuilt in the merged document."],
      ["Can I merge images or Word files too?", "Convert them to PDF first with Convert to PDF, then merge. Or drop a mix straight into Convert to PDF and choose “Combine everything into one PDF”."]
    ],
    related: ["split", "organize", "any-to-pdf", "compress"]
  },
  split: {
    intro: "Break one PDF into several files: one file per page, fixed-size chunks, or the exact page ranges you type in. You get a zip with every part.",
    steps: ["Drop in the PDF you want to divide.", "Choose how: every page separately, a fixed number of pages per file, or custom ranges like 1-3, 4-9.", "Press Split and download the zip."],
    faq: [
      ["How do I write page ranges?", "Comma-separated, with dashes for spans: 1-3, 5, 8-10 makes three files. Pages you don't mention are left out."],
      ["Are the parts named?", "Yes — each part is named after the original file with its page range added, so they sort correctly."],
      ["I only want a few pages, not many files.", "Use Extract PDF Pages instead: pick the pages and you get a single new PDF."]
    ],
    related: ["extract-pages", "delete-pages", "merge", "organize"]
  },
  organize: {
    intro: "See every page as a thumbnail and rearrange the document visually: move pages, rotate them, delete the ones you don't need, then save. It's the all-in-one page editor.",
    steps: ["Drop in your PDF; every page appears as a thumbnail.", "Use the arrows to reorder, ↺ ↻ to rotate, and ✕ to remove pages (↩ brings one back).", "Save all pages in the new order, or only the pages you've selected."],
    faq: [
      ["Can I move a page to the very end quickly?", "Use the arrows to step it along. For big documents, Extract PDF Pages and Merge can be faster for large rearrangements."],
      ["Does rotating here rotate it for real?", "Yes — the saved file has the rotation baked in, so it opens the right way up everywhere."],
      ["Will the file get bigger?", "No. Pages are moved, not re-rendered, so quality and size stay the same."]
    ],
    related: ["rotate", "delete-pages", "extract-pages", "merge"]
  },
  rotate: {
    intro: "Fix pages that came out sideways or upside down, one at a time or the whole document at once. The rotation is saved into the file so it opens correctly in any reader.",
    steps: ["Drop in the PDF.", "Rotate a single page with ↺ ↻ under its thumbnail, or press Rotate all for every page.", "Save the corrected file."],
    faq: [
      ["Does this change the page content?", "No. It only changes the page's rotation setting, so text stays selectable and the file size is unchanged."],
      ["Can I rotate by 180°?", "Yes — press the same arrow twice."],
      ["Some scanned pages are slightly tilted, not rotated.", "That's skew rather than rotation; this tool turns pages in 90° steps. Crop PDF can trim uneven edges."]
    ],
    related: ["organize", "delete-pages", "crop", "resize-pages"]
  },
  "delete-pages": {
    intro: "Remove blank, duplicate, or unwanted pages from a PDF. Click the pages to remove, undo if you change your mind, and save a clean copy.",
    steps: ["Drop in the PDF; the pages appear as thumbnails.", "Click ✕ on any page you want gone (↩ restores it).", "Save the new file."],
    faq: [
      ["Is the original file changed?", "Never. You download a new copy; the original on your device is untouched."],
      ["Can I delete many pages at once?", "Click ✕ on each. To keep just a few pages out of many, Extract PDF Pages is quicker."],
      ["Will page numbers printed on the pages update?", "No — printed numbers are part of the page content. Use Number Pages afterwards to add fresh numbering."]
    ],
    related: ["extract-pages", "organize", "number-pages", "split"]
  },
  "extract-pages": {
    intro: "Pull the pages you need out of a longer PDF into a new file — a single chapter, one invoice from a batch, or the two pages someone asked for.",
    steps: ["Drop in the PDF.", "Click the pages you want to keep; they highlight as you select them.", "Save the selection as a new PDF."],
    faq: [
      ["Can I select a range faster than clicking each page?", "Use Split PDF with a custom range such as 4-9 to get a whole span in one step."],
      ["Do the pages keep their quality?", "Yes. Pages are copied as they are, not re-rendered."],
      ["Can I extract pages from several PDFs into one file?", "Extract from each, then join the results with Merge PDF."]
    ],
    related: ["split", "delete-pages", "merge", "organize"]
  },
  "pdf-converter": {
    intro: "One tool for turning a PDF into whatever you need next: page images, plain text, Word, Excel, PowerPoint, or a web page. Choose the format and it does the rest.",
    steps: ["Drop in the PDF.", "Pick the output format and, for images, the resolution.", "Press Convert and download the result (a zip when there are several files)."],
    faq: [
      ["Which format keeps the layout?", "Images (PNG or JPG) are exact pictures of each page. Text, Word and HTML keep the words but not the layout; Excel does its best to detect rows and columns; PowerPoint puts one page image on each slide."],
      ["What resolution should I choose for images?", "144 dpi is right for screens, 300 dpi for printing, 72 dpi for the smallest files."],
      ["My PDF is a scan and the text comes out empty.", "Scans contain pictures, not text. Run PDF OCR first, then convert."]
    ],
    related: ["pdf-to-word", "pdf-to-jpg", "ocr", "pdf-to-excel"]
  },
  "pdf-to-jpg": {
    intro: "Turn every page of a PDF into a JPG picture — for sharing on social media, dropping into a slide, or previewing a document anywhere a PDF won't open.",
    steps: ["Drop in the PDF.", "Choose a resolution: 144 dpi for screens, 300 dpi for print.", "Press Convert and download the images as a zip."],
    faq: [
      ["Do I get one image per page?", "Yes, named in page order."],
      ["JPG or PNG?", "JPG gives smaller files and suits photos and scans. PNG is sharper for text and diagrams and keeps transparency."],
      ["Can I convert only some pages?", "Use Extract PDF Pages first, then convert the result."]
    ],
    related: ["pdf-to-png", "jpg-to-pdf", "extract-images", "compress"]
  },
  "pdf-to-png": {
    intro: "Export each page of a PDF as a crisp PNG image. PNG keeps sharp edges on text and diagrams, which makes it the better choice for screenshots and documentation.",
    steps: ["Drop in the PDF.", "Pick the resolution you need.", "Press Convert and download the zip of PNGs."],
    faq: [
      ["Why PNG instead of JPG?", "PNG is lossless, so text and lines stay sharp. JPG is smaller and better for photos."],
      ["How big will the images be?", "Page size × resolution. An A4 page at 144 dpi is about 1190 × 1684 pixels."],
      ["I only want the pictures inside the PDF, not whole pages.", "That's Extract Images."]
    ],
    related: ["pdf-to-jpg", "extract-images", "jpg-to-pdf", "pdf-converter"]
  },
  "pdf-to-word": {
    intro: "Get the text of a PDF into an editable Word document (.docx) so you can rewrite, reuse or reformat it. The words come across; the page layout doesn't.",
    steps: ["Drop in the PDF.", "Press Convert.", "Download the .docx and open it in Word, Google Docs or LibreOffice."],
    faq: [
      ["Will it look like the original?", "No — this keeps the text in reading order, not columns, boxes or exact positions. It's meant for editing the content, not recreating the design."],
      ["Nothing comes out — the document is empty.", "The PDF is probably a scan (pictures of pages). Run PDF OCR first to recognise the text, then convert."],
      ["Are pictures included?", "No, only text. Use Extract Images to pull the pictures out separately."]
    ],
    related: ["ocr", "word-to-pdf", "pdf-to-excel", "pdf-converter"]
  },
  "pdf-to-excel": {
    intro: "Pull tables and figures out of a PDF into a spreadsheet you can sort and calculate with. It detects rows and columns from the text positions on each page.",
    steps: ["Drop in the PDF.", "Press Convert.", "Open the .xlsx and tidy any columns that ran together."],
    faq: [
      ["How well does it detect columns?", "Well on clean, regular tables; less well on merged cells, wrapped text or tables spanning pages. Expect to do a little tidying."],
      ["Each page is a separate sheet?", "Yes — one sheet per page, so nothing gets lost."],
      ["The PDF is a scanned statement.", "Run PDF OCR first so there is text to detect, then convert."]
    ],
    related: ["pdf-to-word", "excel-to-pdf", "ocr", "csv-to-pdf"]
  },
  "pdf-to-ppt": {
    intro: "Turn a PDF into a PowerPoint deck with one slide per page — useful for presenting a report, brochure or set of drawings without converting anything by hand.",
    steps: ["Drop in the PDF.", "Press Convert.", "Open the .pptx and add your own slides around the pages."],
    faq: [
      ["Can I edit the text on the slides?", "Each slide holds a picture of the page, so it looks exactly right but the text isn't editable. Use PDF to Word if you need editable text."],
      ["What slide size do I get?", "Slides match the page's proportions, so portrait pages give portrait slides."],
      ["Can I include only some pages?", "Extract PDF Pages first, then convert."]
    ],
    related: ["ppt-to-pdf", "pdf-to-jpg", "extract-pages", "pdf-converter"]
  },
  ocr: {
    intro: "Make a scanned PDF searchable. OCR reads the text in the page images and gives you a text file plus, optionally, a copy of the PDF with an invisible text layer so you can search and select it.",
    steps: ["Drop in the scanned PDF and choose the language.", "Pick the pages (or leave blank for all) and whether you want the searchable PDF too.", "Press Run; the first use downloads the language pack, then recognition runs on your device."],
    faq: [
      ["Is the scan uploaded for recognition?", "No. The OCR engine runs inside your browser; only the language data is downloaded, once, and cached."],
      ["How accurate is it?", "Very good on clean, straight scans at 200–300 dpi; worse on faint, skewed or handwritten pages. Clean up the scan first with PDF Scanner if you can."],
      ["Does it change how the PDF looks?", "No. The searchable PDF adds hidden text over the original images, so the pages look identical."]
    ],
    related: ["scanner", "pdf-to-word", "compress", "pdf-converter"]
  },
  "any-to-pdf": {
    intro: "Drop in almost anything and get a PDF: images, Word, Excel, PowerPoint, OpenDocument, text, RTF, HTML, EPUB, CSV — even a zip full of them. Combine them into one PDF or get one PDF per file.",
    steps: ["Add any mix of supported files.", "Choose one combined PDF or a zip with a PDF per file.", "Press Convert and download."],
    faq: [
      ["Will my Word document look identical?", "Images convert exactly. Documents are converted through their text: words are kept, but complex layouts, tables and pictures are not. Full-fidelity Office conversion needs a desktop app."],
      ["In what order are files combined?", "The order shown in the list — use the arrows to change it."],
      ["What image formats work?", "JPG, PNG, WebP, GIF and BMP. Each becomes a page sized to the picture."]
    ],
    related: ["jpg-to-pdf", "word-to-pdf", "merge", "zip-to-pdf"]
  },
  "jpg-to-pdf": {
    intro: "Turn photos and images into a PDF — a receipt you photographed, a set of scans, or a gallery you want to send as one file. Each image becomes its own page.",
    steps: ["Add your images (JPG, PNG, WebP, GIF or BMP).", "Put them in order and choose one combined PDF or one per image.", "Press Convert and download."],
    faq: [
      ["Are the images compressed?", "They're placed as-is, so quality is kept. Run Compress PDF afterwards if the file is too big."],
      ["What page size do I get?", "Each page is sized to its image. Use Resize Pages afterwards for uniform A4 or Letter pages."],
      ["Can I take the photos here?", "Yes — PDF Scanner uses your camera and cleans up the result like a photocopy."]
    ],
    related: ["scanner", "resize-pages", "compress", "any-to-pdf"]
  },
  "word-to-pdf": {
    intro: "Convert a .docx into a clean, shareable PDF without opening Word. The document's text is laid out on pages; it's ideal for plain documents, letters and notes.",
    steps: ["Add one or more .docx files.", "Choose combined or separate output.", "Press Convert and download."],
    faq: [
      ["Will the formatting match Word exactly?", "Text and paragraphs are kept; complex layouts, tables, images and fonts are not. For a pixel-perfect PDF, use Word's own Save as PDF."],
      ["Does it handle .doc (the old format)?", "Only .docx. Save the file as .docx first."],
      ["Can I combine several documents into one PDF?", "Yes — add them all and choose “Combine everything into one PDF”."]
    ],
    related: ["pdf-to-word", "any-to-pdf", "merge", "txt-to-pdf"]
  },
  "excel-to-pdf": {
    intro: "Print a spreadsheet to PDF straight from the browser. Each sheet is written out as neatly aligned rows in a monospaced font, so the data reads clearly.",
    steps: ["Add the .xlsx or .xls file.", "Press Convert.", "Download the PDF — one section per sheet."],
    faq: [
      ["Does it keep colours, charts and cell formatting?", "No. This is a text rendering of the cell values, useful for sharing data. For formatted output use Excel's own Save as PDF."],
      ["Are formulas calculated?", "The saved values are used, so what you last saw in Excel is what you get."],
      ["Wide sheets get cut off.", "Very wide rows wrap. Split the sheet or reduce columns before converting if it matters."]
    ],
    related: ["pdf-to-excel", "csv-to-pdf", "any-to-pdf", "ods-to-pdf"]
  },
  "ppt-to-pdf": {
    intro: "Get the text of a PowerPoint deck into a PDF: one heading and its text per slide. Good for sharing speaker notes and content when the design doesn't matter.",
    steps: ["Add the .pptx file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Will slides look like they do in PowerPoint?", "No — this keeps the words, not the design, images or animations. Use PowerPoint's Save as PDF for the visual version."],
      ["What about .ppt files?", "Only .pptx. Save as .pptx first."],
      ["I want each slide as an image.", "Export the deck to PDF from PowerPoint, then use PDF to JPG here."]
    ],
    related: ["pdf-to-ppt", "any-to-pdf", "odp-to-pdf", "merge"]
  },
  "odt-to-pdf": {
    intro: "Convert an OpenDocument text file (.odt, from LibreOffice or OpenOffice) into a PDF using its text content.",
    steps: ["Add the .odt file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Is layout preserved?", "Text is kept; complex layouts, tables and pictures are not. LibreOffice's own Export as PDF keeps everything if you need that."],
      ["Can I convert several at once?", "Yes — add them all and choose combined or separate output."],
      ["Does it work with .docx too?", "Use Word to PDF, or drop any mix into Convert to PDF."]
    ],
    related: ["word-to-pdf", "ods-to-pdf", "odp-to-pdf", "any-to-pdf"]
  },
  "ods-to-pdf": {
    intro: "Turn an OpenDocument spreadsheet (.ods) into a PDF of its cell values, laid out row by row so the data stays readable.",
    steps: ["Add the .ods file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Are charts and formatting included?", "No — values only. Export from LibreOffice Calc for a formatted PDF."],
      ["What about several sheets?", "Each sheet becomes its own section in the PDF."],
      ["Excel files?", "Use Excel to PDF; it works the same way."]
    ],
    related: ["excel-to-pdf", "csv-to-pdf", "odt-to-pdf", "any-to-pdf"]
  },
  "odp-to-pdf": {
    intro: "Convert an OpenDocument presentation (.odp) into a PDF containing each slide's text.",
    steps: ["Add the .odp file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Will the slide design carry over?", "No — text only. Use Impress's Export as PDF for the visual deck."],
      ["PowerPoint files?", "Use PPT to PDF."],
      ["Can I combine a deck with other documents?", "Yes: drop everything into Convert to PDF and choose “Combine”."]
    ],
    related: ["ppt-to-pdf", "odt-to-pdf", "any-to-pdf", "merge"]
  },
  "txt-to-pdf": {
    intro: "Turn plain text or Markdown into a tidy PDF with proper pages and word wrapping — notes, logs, README files, or a draft you want to print.",
    steps: ["Add the .txt or .md file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Is Markdown formatted?", "Headings and paragraphs are kept readable; it's rendered as clean text rather than styled HTML."],
      ["What page size?", "A4, with comfortable margins."],
      ["Can I add page numbers?", "Yes — run Number Pages on the result."]
    ],
    related: ["number-pages", "rtf-to-pdf", "html-to-pdf", "any-to-pdf"]
  },
  "rtf-to-pdf": {
    intro: "Convert Rich Text Format files into a PDF using their text. Handy for old documents and exports from email or note apps.",
    steps: ["Add the .rtf file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Is bold, italic and colour kept?", "No — formatting is stripped and the text is laid out plainly."],
      ["Images inside the RTF?", "Not included."],
      ["Several files?", "Add them all; choose combined or separate output."]
    ],
    related: ["txt-to-pdf", "word-to-pdf", "any-to-pdf", "merge"]
  },
  "html-to-pdf": {
    intro: "Save a web page you've downloaded as a PDF of its readable text — articles, documentation, or a receipt page you saved with your browser.",
    steps: ["Add the saved .html file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Will it look like the web page?", "No — styling, images and layout aren't kept; you get the readable text on pages. For a visual copy, use your browser's Print → Save as PDF."],
      ["Can I paste a URL?", "Not here — nothing is fetched from the internet. Save the page first (usually Ctrl/Cmd+S), then add the file."],
      ["Scripts and ads?", "Ignored. Only the page's text content is used."]
    ],
    related: ["txt-to-pdf", "epub-to-pdf", "any-to-pdf", "number-pages"]
  },
  "epub-to-pdf": {
    intro: "Convert an e-book to a PDF you can read anywhere, chapter by chapter in reading order.",
    steps: ["Add the .epub file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["Are the cover and pictures included?", "No — this is a text conversion. Chapters come across in order as plain, readable pages."],
      ["DRM-protected books?", "They can't be read and won't convert."],
      ["Can I make the text bigger?", "Not yet; the PDF uses a standard readable size. PDF Reader lets you zoom while reading."]
    ],
    related: ["reader", "txt-to-pdf", "html-to-pdf", "any-to-pdf"]
  },
  "csv-to-pdf": {
    intro: "Turn a CSV export into a PDF with columns lined up, so a data extract can be printed or attached without opening a spreadsheet app.",
    steps: ["Add the .csv file.", "Press Convert.", "Download the PDF."],
    faq: [
      ["How are columns aligned?", "Rows are printed in a monospaced font so each column stays in place."],
      ["Very wide files?", "Long rows wrap onto the next line. Trim columns first if that matters."],
      ["I'd rather have a real table.", "Open the CSV in a spreadsheet, save as .xlsx, and use Excel to PDF — or keep the CSV and use this for a quick printout."]
    ],
    related: ["excel-to-pdf", "txt-to-pdf", "any-to-pdf", "pdf-to-excel"]
  },
  "zip-to-pdf": {
    intro: "Give it a zip and it converts every supported file inside — images, documents, text — and returns PDFs, without you unpacking anything.",
    steps: ["Add the .zip file.", "Choose one combined PDF or a PDF per file.", "Press Convert and download."],
    faq: [
      ["What order are files converted in?", "Alphabetical by file name inside the zip."],
      ["What if the zip contains unsupported files?", "They're skipped; everything supported is converted."],
      ["Nested folders inside the zip?", "Files in subfolders are included too."]
    ],
    related: ["any-to-pdf", "batch-compress", "merge", "jpg-to-pdf"]
  },
  scanner: {
    intro: "Use your phone or laptop camera to scan paper straight into a PDF: line up the page, snap, repeat for each page, and save. “Clean up” makes scans look like a photocopy — black text on white.",
    steps: ["Allow camera access, then line the page up inside the dashed guide.", "Press the shutter once per page; you can also add photos you've already taken.", "Choose the look and page size, then save the PDF."],
    faq: [
      ["Are my photos uploaded?", "No. The camera image goes straight from your device into the PDF; nothing leaves the browser."],
      ["Which “Look” should I pick?", "Clean up for documents and receipts, Grayscale for mixed pages, Keep original colors for photos or coloured forms."],
      ["Can I make the scan searchable?", "Yes — run PDF OCR on the saved PDF."]
    ],
    related: ["ocr", "jpg-to-pdf", "compress", "crop"]
  },
  edit: {
    intro: "Add what's missing to a PDF: type text, drop in today's date, place a picture or logo, or cover something with a white box. Changes are flattened into the file when you save.",
    steps: ["Choose the PDF and go to the page you want.", "Add text, a date, an image or a white box, then drag and resize it into place.", "Save to download the edited copy."],
    faq: [
      ["Can I edit the existing text?", "Not directly — PDFs don't store text in an editable way. Cover it with a white box and type over it, or convert to Word to rewrite it."],
      ["Can I add my signature?", "Yes, but Sign PDF is built for that and can remember your signature for next time."],
      ["Is the white box secure for hiding information?", "No — it only covers it. Use Redact PDF to remove content permanently."]
    ],
    related: ["sign", "annotate", "redact", "form-filler"]
  },
  annotate: {
    intro: "Mark up a PDF the way you would on paper: highlight passages, draw freehand, and leave sticky notes for yourself or someone else.",
    steps: ["Choose the PDF.", "Highlight text, toggle Draw to sketch directly on the page, or add a note; toggle Draw off to move things around.", "Save to download the annotated copy."],
    faq: [
      ["Can the other person remove my annotations?", "They're drawn into the pages when you save, so they're part of the document rather than removable comments."],
      ["Can I change the highlight colour?", "Yes, before you highlight; pick the colour in the toolbar."],
      ["Will this work on a scanned PDF?", "Yes — drawing and notes work on any page. Text highlighting needs real text, so run PDF OCR on scans first."]
    ],
    related: ["edit", "sign", "reader", "redact"]
  },
  redact: {
    intro: "Permanently black out names, numbers or whole paragraphs. On save, redacted pages are converted to images so the hidden text can't be recovered — unlike a black box drawn on top.",
    steps: ["Choose the PDF and find the sensitive content.", "Draw black boxes over everything that must go.", "Save; the redacted pages are burned in and downloaded."],
    faq: [
      ["Is the hidden text really gone?", "Yes. Redacted pages are re-rendered as images, so nothing underneath survives — which is why text on those pages stops being selectable."],
      ["Can I search for a word and redact it everywhere?", "Not yet; place the boxes by hand. Zoom in to be precise."],
      ["What about metadata like author or title?", "Use Edit Metadata to clear those separately."]
    ],
    related: ["edit", "metadata", "flatten", "annotate"]
  },
  sign: {
    intro: "Sign a PDF without printing it. Draw your signature, or type it in a handwriting style, place it where it belongs, add a date if you need one, and save. Your signature can be kept on this device for next time.",
    steps: ["Choose the PDF that needs signing.", "Draw or type your signature and drop it onto the page; resize and add a date if required.", "Save to download the signed copy."],
    faq: [
      ["Is this legally valid?", "In many places a drawn or typed signature on a document is accepted for everyday agreements, but requirements vary by country and document type. It is not a cryptographic digital signature."],
      ["Where is my saved signature stored?", "Only in this browser on this device, if you've enabled it under Personalize. It's never sent anywhere; Reset removes it."],
      ["Can I ask someone else to sign?", "Not from here — that needs a server. Sign your part and send them the file to sign in the same way."]
    ],
    related: ["form-filler", "flatten", "edit", "compress"]
  },
  reader: {
    intro: "Open a PDF and read it comfortably in the browser with smooth zoom — no download, no viewer app, and the file stays on your device.",
    steps: ["Choose the PDF.", "Scroll through the pages and use the slider to zoom.", "Close the tab when you're done; nothing is kept."],
    faq: [
      ["Can I search inside the document?", "Use your browser's find (Ctrl/Cmd+F) once the pages have rendered; for scans, run PDF OCR first."],
      ["Does it remember where I was?", "No — it's a simple reader. Each visit starts at page one."],
      ["Can I print from here?", "Use your browser's print, or download the file and print it from your usual viewer."]
    ],
    related: ["annotate", "ocr", "edit", "compress"]
  },
  "number-pages": {
    intro: "Stamp page numbers onto every page in the position and format you choose — for a report, a merged bundle, or a scan that arrived without any.",
    steps: ["Drop in the PDF.", "Pick the position, format (for example “Page 1 of 12”), starting number and size.", "Press Run and download."],
    faq: [
      ["Can numbering start at a different page?", "Set the starting number, and use the Pages box to limit which pages get a number."],
      ["Will numbers overlap existing content?", "They sit in the margin. Choose a different position if a page already has something there."],
      ["Can I add a title as well?", "Yes — Header & Footer adds text top or bottom and supports {page} and {pages} too."]
    ],
    related: ["header-footer", "merge", "watermark", "organize"]
  },
  watermark: {
    intro: "Stamp DRAFT, CONFIDENTIAL, SAMPLE or any text across every page. Set the colour, opacity, size and angle so it's visible without hiding the content.",
    steps: ["Drop in the PDF.", "Type the watermark text and adjust colour, opacity, size and angle.", "Press Run and download."],
    faq: [
      ["Can the watermark be removed later?", "It's drawn into the pages, so it can't be switched off; keep an unmarked original."],
      ["Can I use a logo instead of text?", "Not here — Edit PDF lets you place an image on pages by hand."],
      ["Does it affect text selection?", "No. The watermark is added on top; the document's own text stays selectable."]
    ],
    related: ["header-footer", "number-pages", "edit", "flatten"]
  },
  crop: {
    intro: "Trim unwanted margins, cut a page down to one figure or table, or tidy uneven scan edges. Drag the area to keep and apply it to one page or all of them.",
    steps: ["Drop in the PDF and pick a page.", "Drag a rectangle over the area you want to keep.", "Apply to this page or every page, then save."],
    faq: [
      ["Is the cropped-off part deleted?", "The page is trimmed to the box you drew; the saved file shows only that area."],
      ["Can I crop different areas on different pages?", "Yes — set the box on each page before saving, or apply one box to all."],
      ["Pages come out different sizes afterwards.", "Run Resize Pages to make them uniform."]
    ],
    related: ["resize-pages", "rotate", "organize", "scanner"]
  },
  "form-filler": {
    intro: "Fill in a fillable PDF form — text fields, tick boxes, drop-downs — and save it, either still editable or flattened so the answers can't be changed.",
    steps: ["Drop in the form; its fields appear below.", "Fill them in.", "Choose Keep editable or Flatten, then save."],
    faq: [
      ["My PDF shows no fields.", "It isn't a fillable form — probably a scan or a plain document. Use Edit PDF to type over it instead."],
      ["What does Flatten do?", "It turns your answers into fixed page content so they display the same everywhere and can't be edited."],
      ["Can I sign the form here too?", "Fill and save it, then use Sign PDF on the result."]
    ],
    related: ["sign", "flatten", "edit", "compress"]
  },
  flatten: {
    intro: "Lock a PDF so form fields and annotations become fixed content. Full flatten goes further and turns every page into an image, so nothing can be edited or extracted.",
    steps: ["Drop in the PDF.", "Choose Flatten forms (text stays selectable) or Full flatten (pages become images).", "Press Run and download."],
    faq: [
      ["When do I want Full flatten?", "When the document must not be altered or copied from at all — for example a final signed contract. Text stops being selectable."],
      ["Does flattening reduce file size?", "Not usually; Full flatten can make it larger. Run Compress PDF afterwards."],
      ["Is it reversible?", "No. Keep the original if you might need the editable version."]
    ],
    related: ["form-filler", "sign", "redact", "compress"]
  },
  unlock: {
    intro: "Remove a password you know from a PDF so it opens freely — for a bank statement or payslip you keep having to unlock.",
    steps: ["Drop in the protected PDF.", "Enter the password you were given.", "Press Unlock and download the open copy."],
    faq: [
      ["Can it crack a password I don't know?", "No. You need the password; this removes the protection, it doesn't bypass it."],
      ["Why isn't the text selectable afterwards?", "Browsers can't rewrite encrypted files directly, so the unlocked copy is rebuilt from page images. Run PDF OCR on it if you need selectable text."],
      ["Is my password sent anywhere?", "No. It's used in your browser to open the file and is never stored or transmitted."]
    ],
    related: ["ocr", "compress", "repair", "flatten"]
  },
  repair: {
    intro: "Fix a PDF that won't open or shows a “file is damaged” error. It rewrites the file's internal structure; if that isn't enough, it rebuilds the document from page images.",
    steps: ["Drop in the broken PDF.", "Press Repair.", "Download the repaired copy."],
    faq: [
      ["What kinds of damage can it fix?", "Broken cross-reference tables, truncated trailers and similar structural faults — the usual causes of “damaged” errors after a bad download or transfer."],
      ["The result isn't selectable text any more.", "That means the fallback ran and pages were rebuilt from images. Run PDF OCR to get text back."],
      ["It says the structure is invalid and stops.", "The file is too far gone for a rebuild — typically most of it is missing. Try re-downloading the original."]
    ],
    related: ["unlock", "ocr", "compress", "reader"]
  },
  "extract-images": {
    intro: "Pull every embedded picture out of a PDF as separate image files — logos, photos, figures — without screenshotting pages.",
    steps: ["Drop in the PDF and optionally limit the pages.", "Choose whether to skip tiny images like icons and bullets.", "Press Extract and download the zip."],
    faq: [
      ["Why are some pictures missing?", "Only embedded raster images are extracted. Vector drawings, charts drawn with lines, and text aren't images."],
      ["What format do I get?", "PNG, at the image's original resolution."],
      ["I want whole pages as images.", "Use PDF to JPG or PDF to PNG."]
    ],
    related: ["pdf-to-png", "pdf-to-jpg", "jpg-to-pdf", "compress"]
  },
  "resize-pages": {
    intro: "Make every page the same size — A4, US Letter, Legal, A5 or A3 — with content scaled to fit and centred. Useful before printing and for merged files whose pages don't match.",
    steps: ["Drop in the PDF.", "Choose the page size and orientation.", "Press Run and download."],
    faq: [
      ["Does content get stretched?", "No — it's scaled proportionally to fit and centred, so nothing is distorted."],
      ["Mixed portrait and landscape pages?", "Choose “Match each page” to keep each page's orientation, or force one."],
      ["Can I trim instead of scale?", "That's Crop PDF."]
    ],
    related: ["crop", "merge", "rotate", "organize"]
  },
  "header-footer": {
    intro: "Add a title, date, reference or note to the top or bottom of every page. Use {page} and {pages} for numbering and {date} for today's date.",
    steps: ["Drop in the PDF.", "Type text into any of the header and footer slots (left or right) and set the size.", "Press Run and download."],
    faq: [
      ["How do I get “Page 3 of 10”?", "Type Page {page} of {pages} into a slot."],
      ["Can I use a different date format?", "{date} uses your device's local date format. Type the date yourself for a specific style."],
      ["Just page numbers, centred?", "Number Pages is simpler for that."]
    ],
    related: ["number-pages", "watermark", "edit", "merge"]
  },
  metadata: {
    intro: "Change the title, author, subject and keywords stored inside a PDF — what readers show in the title bar and what search tools index. Clear fields you'd rather not share.",
    steps: ["Drop in the PDF; its current details appear.", "Edit the title, author, subject or keywords, or empty a field to clear it.", "Press Save and download."],
    faq: [
      ["Why does my PDF show someone else's name as author?", "The name was stored by the app that created it. Change or clear it here."],
      ["Does this change what's printed on the pages?", "No — only the hidden document properties."],
      ["Are there other hidden details?", "Creation and modification dates and the creating application may also be stored; those are kept as they are."]
    ],
    related: ["redact", "flatten", "compress", "edit"]
  }
};

/* Renders the section shown under a tool. `opts.link(tool)` returns the URL for a related tool and
   `opts.icon(tool)` (optional) returns its icon markup. Works in the browser and in Node (the page generator). */
window.renderToolInfo = function (t, tools, opts) {
  const c = window.TOOL_CONTENT[t.id];
  if (!c) return "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const related = (c.related || []).map((id) => tools.find((x) => x.id === id)).filter((x) => x && !x.na && !x.hidden);
  const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  return `<section class="tool-info" data-tool-info="${esc(t.id)}">
  <p class="ti-badge">${lock}<b>Runs on your device.</b> Your file is never uploaded — it's processed in this tab and gone when you close it.</p>
  <div class="ti-grid">
    <div class="ti-about"><h3>About ${esc(t.name)}</h3><p>${esc(c.intro)}</p></div>
    <div class="ti-steps"><h3>How it works</h3><ol>${c.steps.map((s, i) => `<li><span>${i + 1}</span>${esc(s)}</li>`).join("")}</ol></div>
  </div>
  <div class="ti-faq"><h3>Common questions</h3>${c.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  ${related.length ? `<div class="ti-related"><h3>Often used next</h3><div class="ti-cards">${related.map((r) => `<a href="${esc(opts.link(r))}">${opts.icon ? opts.icon(r) : ""}<span class="ti-card-text"><b>${esc(r.name)}</b><span>${esc(r.desc)}</span></span></a>`).join("")}</div></div>` : ""}
</section>`;
};
