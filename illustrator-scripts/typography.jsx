/* Typography operations. Requires bootstrap.jsx. */

MCP.WEIGHT_STYLES = {
  thin: ["Thin", "Hairline", "ExtraLight", "UltraLight"], light: ["Light"], regular: ["Regular", "Roman", "Book", "Normal"],
  medium: ["Medium"], semibold: ["SemiBold", "Semibold", "DemiBold", "Demi"], bold: ["Bold"],
  extrabold: ["ExtraBold", "Extra Bold", "Heavy"], black: ["Black", "Heavy", "Ultra"]
};

/* Resolve a font by PostScript name, "Family Style" or family. Returns null when unavailable. */
MCP.findFont = function (name) {
  try { return app.textFonts.getByName(name); } catch (e) { /* fall through */ }
  var familyMatch = null;
  var lower = name.toLowerCase();
  for (var i = 0; i < app.textFonts.length; i++) {
    var f = app.textFonts[i];
    var full = (f.family + " " + f.style).toLowerCase();
    if (full === lower || f.name.toLowerCase() === lower) return f;
    if (!familyMatch && f.family.toLowerCase() === lower) familyMatch = f;
    if (f.family.toLowerCase() === lower && /^(regular|roman|book)$/i.test(f.style)) familyMatch = f;
  }
  return familyMatch;
};

/* Try candidates in order; never silently claim an unavailable font. */
MCP.resolveFont = function (candidates) {
  if (!candidates) return null;
  if (!(candidates instanceof Array)) candidates = [candidates];
  for (var i = 0; i < candidates.length; i++) {
    var f = MCP.findFont(candidates[i]);
    if (f) {
      if (i > 0) MCP.warn("Font '" + candidates[0] + "' unavailable; used fallback '" + f.name + "'.");
      return f;
    }
  }
  MCP.warn("None of the fonts [" + candidates.join(", ") + "] are installed; Illustrator default font kept.");
  return null;
};

MCP.fontForWeight = function (family, weight) {
  var styles = MCP.WEIGHT_STYLES[weight];
  if (!styles) MCP.fail("VALIDATION_ERROR", "Unknown weight " + weight);
  for (var s = 0; s < styles.length; s++) {
    for (var i = 0; i < app.textFonts.length; i++) {
      var f = app.textFonts[i];
      if (f.family === family && f.style.replace(/\s/g, "").toLowerCase() === styles[s].replace(/\s/g, "").toLowerCase()) return f;
    }
  }
  return null;
};

MCP.JUSTIFY = { left: "LEFT", center: "CENTER", right: "RIGHT", justify: "FULLJUSTIFYLASTLINELEFT", justifyAll: "FULLJUSTIFY" };

/* Applies typography props to a text range. */
MCP.styleText = function (range, a) {
  var ca = range.characterAttributes;
  if (a.font) { var f = MCP.resolveFont(a.font); if (f) ca.textFont = f; }
  if (a.fontSize) ca.size = a.fontSize;
  if (a.weight) {
    var fam = ca.textFont.family;
    var wf = MCP.fontForWeight(fam, a.weight);
    if (wf) ca.textFont = wf; else MCP.warn("Family '" + fam + "' has no '" + a.weight + "' style installed.");
  }
  if (a.color) ca.fillColor = MCP.color(a.color);
  if (a.tracking !== undefined) ca.tracking = a.tracking;
  if (a.leading !== undefined) { ca.autoLeading = false; ca.leading = a.leading; }
  if (a.align) range.paragraphAttributes.justification = Justification[MCP.JUSTIFY[a.align]];
  if (a.caps === "all") ca.capitalization = FontCapsOption.ALLCAPS;
};

MCP.ops.add_text = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var layer = MCP.targetLayer(doc, a.layer);
  var tf;
  if (a.width && a.height) {
    var box = layer.pathItems.rectangle(-a.y, a.x, a.width, a.height);
    tf = layer.textFrames.areaText(box);
  } else {
    tf = layer.textFrames.add();
  }
  tf.contents = a.content;
  if (a.color === undefined) a.color = { hex: "#000000" };
  MCP.styleText(tf.textRange, a);
  if (!(a.width && a.height)) {
    /* Point text: align bounds to x/y. For centered/right text x is the anchor line. */
    var b = MCP.box(tf.geometricBounds);
    var anchorX = a.align === "center" ? a.x - b.width / 2 : a.align === "right" ? a.x - b.width : a.x;
    MCP.moveTo(tf, anchorX, a.y);
  }
  if (a.name) tf.name = a.name;
  MCP.style(tf, { opacity: a.opacity, blendMode: a.blendMode, rotation: a.rotation, effects: a.effects });
  return MCP.info(tf);
};

MCP.textTargets = function (a) {
  var items = MCP.find(MCP.doc(), a.target);
  for (var i = 0; i < items.length; i++) {
    if (items[i].typename !== "TextFrame") MCP.fail("VALIDATION_ERROR", "Target is not text: " + (items[i].name || items[i].typename));
  }
  return items;
};

/* Generic text-style op used by set_font, set_font_size, etc. Optional range {start, length}. */
MCP.ops.style_text = function (a) {
  var items = MCP.textTargets(a);
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var range = items[i].textRange;
    if (a.range) {
      var chars = items[i].characters;
      if (a.range.start + a.range.length > chars.length) MCP.fail("VALIDATION_ERROR", "Range exceeds text length " + chars.length);
      for (var c = a.range.start; c < a.range.start + a.range.length; c++) MCP.styleText(chars[c], a);
    } else {
      MCP.styleText(range, a);
    }
    out.push(MCP.info(items[i]));
  }
  return { items: out };
};

MCP.ops.edit_text = function (a) {
  var items = MCP.textTargets(a);
  for (var i = 0; i < items.length; i++) {
    if (a.find !== undefined) {
      var s = items[i].contents;
      if (s.indexOf(a.find) < 0) MCP.fail("OBJECT_NOT_FOUND", "Text '" + a.find + "' not found in " + items[i].name);
      items[i].contents = s.split(a.find).join(a.content);
    } else {
      items[i].contents = a.content;
    }
  }
  return { items: [MCP.info(items[0])], count: items.length };
};

MCP.ops.create_text_on_path = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var path = MCP.findOne(doc, a.path);
  if (path.typename !== "PathItem") MCP.fail("VALIDATION_ERROR", "Text on path requires a PathItem.");
  var layer = MCP.layerOf(path);
  var tf = layer.textFrames.pathText(path);
  tf.contents = a.content;
  MCP.styleText(tf.textRange, a);
  if (a.name) tf.name = a.name;
  return MCP.info(tf);
};

MCP.ops.convert_text_to_outlines = function (a) {
  var items = MCP.textTargets(a);
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var name = items[i].name;
    var g = items[i].createOutline();
    if (name) g.name = name;
    out.push(MCP.info(g));
  }
  return { outlined: out };
};

MCP.ops.inspect_fonts = function (a) {
  var res = [];
  var q = a.query ? a.query.toLowerCase() : null;
  var limit = a.limit || 200;
  for (var i = 0; i < app.textFonts.length && res.length < limit; i++) {
    var f = app.textFonts[i];
    if (q && (f.name + " " + f.family + " " + f.style).toLowerCase().indexOf(q) < 0) continue;
    res.push({ name: f.name, family: f.family, style: f.style });
  }
  var used = [];
  if (a.documentFonts && app.documents.length) {
    var seen = {};
    var tfs = app.activeDocument.textFrames;
    for (var t = 0; t < tfs.length; t++) {
      try { var n = tfs[t].textRange.characterAttributes.textFont.name; if (!seen[n]) { seen[n] = 1; used.push(n); } } catch (e) { /* missing font */ }
    }
  }
  return { installedCount: app.textFonts.length, fonts: res, documentFonts: used };
};

/* Checks availability of a list of fonts without modifying anything. */
MCP.ops.check_fonts = function (a) {
  var out = [];
  for (var i = 0; i < a.fonts.length; i++) {
    var f = MCP.findFont(a.fonts[i]);
    out.push({ requested: a.fonts[i], available: !!f, resolved: f ? f.name : null });
  }
  return { fonts: out };
};
