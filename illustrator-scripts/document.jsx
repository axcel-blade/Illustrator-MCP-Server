/* Document, artboard and asset operations. Requires bootstrap.jsx. */

MCP.ops.status = function () {
  var docs = [];
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    docs.push({ name: d.name, saved: d.saved, path: d.fullName ? String(d.fullName.fsName) : null });
  }
  return {
    application: app.name, version: app.version, buildNumber: app.buildNumber,
    locale: app.locale, documentCount: app.documents.length,
    activeDocument: app.documents.length ? app.activeDocument.name : null, documents: docs
  };
};

MCP.docInfo = function (doc) {
  var abs = [];
  for (var i = 0; i < doc.artboards.length; i++) {
    var r = doc.artboards[i].artboardRect; /* document coordinates, y up */
    abs.push({ index: i, name: doc.artboards[i].name, width: r[2] - r[0], height: r[1] - r[3],
      left: r[0], top: r[1], active: i === doc.artboards.getActiveArtboardIndex() });
  }
  var path = null;
  try { if (doc.saved || doc.path.fsName) path = doc.fullName.fsName; } catch (e) { path = null; }
  return {
    name: doc.name, path: path, saved: doc.saved,
    colorMode: doc.documentColorSpace === DocumentColorSpace.CMYK ? "CMYK" : "RGB",
    rulerUnits: String(doc.rulerUnits), artboards: abs,
    layerCount: doc.layers.length, pageItemCount: doc.pageItems.length,
    swatchCount: doc.swatches.length, symbolCount: doc.symbols.length,
    placedItemCount: doc.placedItems.length, rasterItemCount: doc.rasterItems.length,
    textFrameCount: doc.textFrames.length
  };
};

MCP.ops.create_document = function (a) {
  var preset = new DocumentPreset();
  preset.width = a.width;
  preset.height = a.height;
  preset.colorMode = a.colorMode === "CMYK" ? DocumentColorSpace.CMYK : DocumentColorSpace.RGB;
  preset.title = a.name || "Untitled";
  preset.numArtboards = a.artboards || 1;
  if (a.units) {
    var u = { pt: RulerUnits.Points, px: RulerUnits.Pixels, mm: RulerUnits.Millimeters, cm: RulerUnits.Centimeters,
      "in": RulerUnits.Inches, pc: RulerUnits.Picas }[a.units];
    if (u) preset.units = u;
  }
  var doc = app.documents.addDocument(a.colorMode === "CMYK" ? "Print" : "Web", preset);
  return MCP.docInfo(doc);
};

MCP.ops.open_document = function (a) {
  var f = new File(a.path);
  if (!f.exists) MCP.fail("FILE_NOT_FOUND", "File not found: " + a.path);
  return MCP.docInfo(app.open(f));
};

MCP.findDoc = function (name) {
  if (!name) return MCP.doc();
  for (var i = 0; i < app.documents.length; i++) if (app.documents[i].name === name) return app.documents[i];
  MCP.fail("OBJECT_NOT_FOUND", "Document not open: " + name);
};

MCP.ops.close_document = function (a) {
  var doc = MCP.findDoc(a.name);
  var name = doc.name;
  if (!doc.saved && a.save === undefined) {
    MCP.fail("CONFIRMATION_REQUIRED", "Document has unsaved changes. Pass save: true to save or save: false to discard.");
  }
  doc.close(a.save ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
  return { closed: name };
};

MCP.ops.save_document = function () {
  var doc = MCP.doc();
  var hasPath = false;
  try { hasPath = doc.fullName && doc.fullName.exists; } catch (e) { hasPath = false; }
  if (!hasPath) MCP.fail("VALIDATION_ERROR", "Document has never been saved; use save_document_as.");
  doc.save();
  return MCP.docInfo(doc);
};

MCP.ops.save_document_as = function (a) {
  var doc = MCP.doc();
  var opts = new IllustratorSaveOptions();
  opts.pdfCompatible = a.pdfCompatible !== false;
  opts.embedICCProfile = !!a.embedICCProfile;
  opts.embedLinkedFiles = !!a.embedLinkedFiles;
  opts.fontSubsetThreshold = 100;
  doc.saveAs(new File(a.path), opts);
  var f = new File(a.path);
  if (!f.exists) MCP.fail("ILLUSTRATOR_SCRIPT_ERROR", "Illustrator reported no error but the file was not written: " + a.path);
  return MCP.docInfo(doc);
};

MCP.ops.inspect_document = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var info = MCP.docInfo(doc);
  var items = [];
  var limit = a.limit || 500;
  for (var l = 0; l < doc.layers.length; l++) {
    var layer = doc.layers[l];
    for (var i = 0; i < layer.pageItems.length && items.length < limit; i++) {
      items.push(MCP.info(layer.pageItems[i], a.deep));
    }
  }
  info.items = items;
  info.truncated = doc.pageItems.length > items.length && !a.deep;
  info.layers = MCP.ops.inspect_layers({}).layers;
  info.coordinateSpace = "points, origin at artboard " + doc.artboards.getActiveArtboardIndex() + " top-left, y down";
  return info;
};

MCP.ops.get_artboards = function () {
  return { artboards: MCP.docInfo(MCP.doc()).artboards };
};

/* Artboard rects are given relative to artboard 0's top-left, y down. */
MCP.ops.create_artboard = function (a) {
  var doc = MCP.doc();
  var r0 = doc.artboards[0].artboardRect;
  var left = r0[0] + a.x, top = r0[1] - a.y;
  var ab = doc.artboards.add([left, top, left + a.width, top - a.height]);
  if (a.name) ab.name = a.name;
  return { artboards: MCP.docInfo(doc).artboards };
};

MCP.ops.resize_artboard = function (a) {
  var doc = MCP.doc();
  var i = a.index || 0;
  if (i >= doc.artboards.length) MCP.fail("VALIDATION_ERROR", "Artboard index " + i + " does not exist.");
  var r = doc.artboards[i].artboardRect;
  var left = r[0], top = r[1];
  if (a.anchor === "center") {
    left = (r[0] + r[2]) / 2 - a.width / 2;
    top = (r[1] + r[3]) / 2 + a.height / 2;
  }
  doc.artboards[i].artboardRect = [left, top, left + a.width, top - a.height];
  if (a.name) doc.artboards[i].name = a.name;
  return { artboards: MCP.docInfo(doc).artboards };
};

MCP.ops.set_document_color_mode = function (a) {
  var doc = MCP.doc();
  app.executeMenuCommand(a.mode === "CMYK" ? "doc-color-cmyk" : "doc-color-rgb");
  var now = doc.documentColorSpace === DocumentColorSpace.CMYK ? "CMYK" : "RGB";
  if (now !== a.mode) MCP.fail("ILLUSTRATOR_SCRIPT_ERROR", "Color mode change did not take effect (still " + now + ").");
  return { colorMode: now };
};

/* Ruler units are read-only on Document; Illustrator stores them in the "rulerType" preference
   (0=in, 1=mm, 2=pt, 3=pc, 4=cm, 6=px; mapping not documented by Adobe - unverified). Applies to new documents and the UI rulers. */
MCP.ops.set_document_units = function (a) {
  var code = { pt: 2, pc: 3, "in": 0, mm: 1, cm: 4, px: 6 }[a.units];
  app.preferences.setIntegerPreference("rulerType", code);
  return { requested: a.units, rulerUnits: String(MCP.doc().rulerUnits),
    note: "Ruler preference written; Illustrator may require reopening the document for rulers to update." };
};

/* ---------------- assets ---------------- */
MCP.ops.place_image = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var f = new File(a.path);
  if (!f.exists) MCP.fail("FILE_NOT_FOUND", "Image not found: " + a.path);
  var layer = MCP.targetLayer(doc, a.layer);
  var item = layer.placedItems.add();
  item.file = f;
  if (a.width || a.height) {
    var b = MCP.box(item.geometricBounds);
    var w = a.width, h = a.height;
    if (a.fit !== "stretch") {
      var s = Math.min((w || b.width * 1e9) / b.width, (h || b.height * 1e9) / b.height);
      w = b.width * s; h = b.height * s;
    }
    MCP.resizeTo(item, w, h);
  }
  MCP.moveTo(item, a.x || 0, a.y || 0);
  if (a.name) item.name = a.name;
  var result = item;
  if (a.embed) { item.embed(); result = layer.pageItems[0]; if (a.name) result.name = a.name; }
  return MCP.info(result);
};

MCP.ops.inspect_assets = function () {
  var doc = MCP.doc();
  var placed = [], raster = [];
  for (var i = 0; i < doc.placedItems.length; i++) placed.push(MCP.info(doc.placedItems[i]));
  for (var j = 0; j < doc.rasterItems.length; j++) raster.push(MCP.info(doc.rasterItems[j]));
  var missing = [];
  for (var k = 0; k < placed.length; k++) if (!placed[k].linkExists) missing.push(placed[k].name || ("placed #" + k));
  return { linked: placed, embedded: raster, missingLinks: missing };
};

MCP.ops.embed_images = function (a) {
  var doc = MCP.doc();
  var n = 0;
  for (var i = doc.placedItems.length - 1; i >= 0; i--) {
    var p = doc.placedItems[i];
    if (a.name && p.name !== a.name) continue;
    p.embed(); n++;
  }
  return { embedded: n };
};
