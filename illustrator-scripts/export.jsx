/* Export operations. Requires bootstrap.jsx. Paths are validated by the Node server before arriving here. */

MCP.verifyWritten = function (path) {
  var f = new File(path);
  if (!f.exists) MCP.fail("ILLUSTRATOR_SCRIPT_ERROR", "Export reported no error but no file exists at " + path);
  return { path: f.fsName, bytes: f.length };
};

/* Exports one file per artboard index; Illustrator may append artboard suffixes, so the result is verified. */
MCP.rasterExport = function (a, kind) {
  var doc = MCP.doc();
  var indexes = a.artboards && a.artboards.length ? a.artboards : [doc.artboards.getActiveArtboardIndex()];
  var files = [];
  for (var i = 0; i < indexes.length; i++) {
    doc.artboards.setActiveArtboardIndex(indexes[i]);
    var path = indexes.length > 1 ? a.path.replace(/(\.\w+)$/, "-" + (indexes[i] + 1) + "$1") : a.path;
    var opts, type;
    var r = doc.artboards[indexes[i]].artboardRect;
    var scale = a.width ? (a.width / (r[2] - r[0])) * 100 : ((a.ppi || 72) / 72) * 100;
    if (kind === "png") {
      opts = new ExportOptionsPNG24();
      opts.transparency = a.transparent !== false;
      type = ExportType.PNG24;
    } else {
      opts = new ExportOptionsJPEG();
      opts.qualitySetting = a.quality || 85;
      type = ExportType.JPEG;
    }
    opts.antiAliasing = a.antiAliasing !== false;
    opts.artBoardClipping = true;
    opts.horizontalScale = scale;
    opts.verticalScale = scale;
    if (scale > 776) MCP.fail("VALIDATION_ERROR", "Scale " + Math.round(scale) + "% exceeds Illustrator's 776% export limit.");
    doc.exportFile(new File(path), type, opts);
    files.push(MCP.verifyWritten(path));
  }
  return { files: files, scalePercent: scale };
};

MCP.ops.export_png = function (a) { return MCP.rasterExport(a, "png"); };
MCP.ops.export_jpg = function (a) { return MCP.rasterExport(a, "jpg"); };

MCP.ops.export_svg = function (a) {
  var doc = MCP.doc();
  var opts = new ExportOptionsSVG();
  opts.coordinatePrecision = a.precision || 3;
  opts.embedRasterImages = a.embedImages !== false;
  opts.fontType = a.outlineText ? SVGFontType.OUTLINEFONT : SVGFontType.SVGFONT;
  opts.cssProperties = SVGCSSPropertyLocation.STYLEATTRIBUTES;
  opts.documentEncoding = SVGDocumentEncoding.UTF8;
  if (a.artboard !== undefined) { opts.saveMultipleArtboards = true; opts.artboardRange = String(a.artboard + 1); }
  doc.exportFile(new File(a.path), ExportType.SVG, opts);
  var f = new File(a.path);
  if (!f.exists && a.artboard !== undefined) {
    /* Illustrator appends "_Artboard N" style suffixes for ranged SVG exports. */
    var folder = f.parent, base = f.name.replace(/\.svg$/i, "");
    var found = folder.getFiles(base + "*.svg");
    if (found.length) return { files: [{ path: found[0].fsName, bytes: found[0].length }], note: "Illustrator renamed the output." };
  }
  return { files: [MCP.verifyWritten(a.path)] };
};

/*
 * PDF and EPS are written with saveAs(), which re-targets the open document to the new file.
 * To keep the user's .ai as the working file, a saved .ai is reopened afterwards. An unsaved
 * document must be saved first unless allowRetarget is true.
 */
MCP.saveCopy = function (a, opts) {
  var doc = MCP.doc();
  var original = null;
  try { if (doc.fullName.exists && /\.ai$/i.test(doc.fullName.name)) original = doc.fullName; } catch (e) { original = null; }
  if (!doc.saved && original) MCP.fail("CONFIRMATION_REQUIRED", "Save the document before exporting PDF/EPS so no changes are lost.");
  if (!original && !a.allowRetarget) {
    MCP.fail("CONFIRMATION_REQUIRED", "Document has no .ai file yet. Save it with save_document_as first, or pass allowRetarget: true (the open document will then point at the exported file).");
  }
  doc.saveAs(new File(a.path), opts);
  var res = MCP.verifyWritten(a.path);
  if (original) {
    app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
    app.open(original);
    res.reopened = original.fsName;
  }
  return { files: [res] };
};

MCP.ops.export_pdf = function (a) {
  var opts = new PDFSaveOptions();
  var compat = { "1.3": "Acrobat4", "1.4": "Acrobat5", "1.5": "Acrobat6", "1.6": "Acrobat7", "1.7": "Acrobat8" }[a.compatibility || "1.6"];
  opts.compatibility = PDFCompatibility[compat.toUpperCase()];
  opts.preserveEditability = a.preserveEditability !== false;
  if (a.preset) opts.pDFPreset = a.preset;
  if (a.artboards) opts.artboardRange = a.artboards;
  opts.generateThumbnails = true;
  return MCP.saveCopy(a, opts);
};

MCP.ops.export_eps = function (a) {
  var opts = new EPSSaveOptions();
  opts.embedAllFonts = a.embedFonts !== false;
  opts.cmykPostScript = true;
  opts.embedLinkedFiles = true;
  if (a.artboards) { opts.saveMultipleArtboards = true; opts.artboardRange = a.artboards; }
  return MCP.saveCopy(a, opts);
};
