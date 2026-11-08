/*
 * Illustrator AI MCP - ExtendScript bootstrap (ES3).
 *
 * The Node bridge concatenates this file with the operation modules and appends a call to
 * MCP.main(command, resultPath). Only operations registered in MCP.ops can run; there is no
 * code path that evaluates client-provided source.
 *
 * Coordinate convention received from Node: points, origin at the target artboard's top-left,
 * y grows DOWN. Illustrator's artboard coordinate system has y growing UP, so y is negated here.
 */
var MCP = MCP || {};
MCP.ops = {};
MCP.warnings = [];

/* ---------------- JSON (ExtendScript has no native JSON) ---------------- */
MCP.quote = function (s) {
  var out = '"';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i), code = s.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (code < 32 || code > 126) {
      var h = code.toString(16);
      while (h.length < 4) h = "0" + h;
      out += "\\u" + h;
    } else out += c;
  }
  return out + '"';
};

MCP.stringify = function (v) {
  if (v === null || v === undefined) return "null";
  var t = typeof v;
  if (t === "number") return isFinite(v) ? String(Math.round(v * 10000) / 10000) : "null";
  if (t === "boolean") return v ? "true" : "false";
  if (t === "string") return MCP.quote(v);
  if (v instanceof Array) {
    var parts = [];
    for (var i = 0; i < v.length; i++) parts.push(MCP.stringify(v[i]));
    return "[" + parts.join(",") + "]";
  }
  if (t === "object") {
    var props = [];
    for (var k in v) {
      if (v.hasOwnProperty(k) && typeof v[k] !== "function" && v[k] !== undefined) {
        props.push(MCP.quote(k) + ":" + MCP.stringify(v[k]));
      }
    }
    return "{" + props.join(",") + "}";
  }
  return MCP.quote(String(v));
};

/* ---------------- errors ---------------- */
MCP.fail = function (code, message, details) {
  var e = new Error(message);
  e.mcpCode = code;
  e.mcpDetails = details;
  throw e;
};

MCP.warn = function (msg) {
  MCP.warnings.push(msg);
};

MCP.doc = function () {
  if (app.documents.length === 0) MCP.fail("NO_ACTIVE_DOCUMENT", "No document is open in Illustrator.");
  return app.activeDocument;
};

/* Activate the artboard used as coordinate origin. */
MCP.useArtboard = function (doc, index) {
  app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
  var i = index === undefined || index === null ? doc.artboards.getActiveArtboardIndex() : index;
  if (i < 0 || i >= doc.artboards.length) MCP.fail("VALIDATION_ERROR", "Artboard index " + i + " does not exist.");
  doc.artboards.setActiveArtboardIndex(i);
  return i;
};

/* ---------------- colors ---------------- */
MCP.hexToRgb = function (hex) {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) };
};

MCP.toHex = function (r, g, b) {
  function c(v) {
    var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? "0" + s : s;
  }
  return ("#" + c(r) + c(g) + c(b)).toUpperCase();
};

/* spec: null | "none" | { hex, cmyk?: {c,m,y,k} } */
MCP.color = function (spec) {
  if (!spec || spec === "none") return new NoColor();
  var doc = app.documents.length ? app.activeDocument : null;
  var isCmyk = doc && doc.documentColorSpace === DocumentColorSpace.CMYK;
  if (isCmyk) {
    var k = new CMYKColor();
    var cm = spec.cmyk;
    if (!cm) {
      var rgb0 = MCP.hexToRgb(spec.hex);
      var rr = rgb0.r / 255, gg = rgb0.g / 255, bb = rgb0.b / 255;
      var kk = 1 - Math.max(rr, gg, bb);
      cm = kk >= 1 ? { c: 0, m: 0, y: 0, k: 100 } : {
        c: ((1 - rr - kk) / (1 - kk)) * 100, m: ((1 - gg - kk) / (1 - kk)) * 100,
        y: ((1 - bb - kk) / (1 - kk)) * 100, k: kk * 100 };
    }
    k.cyan = cm.c; k.magenta = cm.m; k.yellow = cm.y; k.black = cm.k;
    return k;
  }
  var rgb = MCP.hexToRgb(spec.hex);
  var c = new RGBColor();
  c.red = rgb.r; c.green = rgb.g; c.blue = rgb.b;
  return c;
};

MCP.describeColor = function (col) {
  if (!col) return null;
  switch (col.typename) {
    case "RGBColor": return { type: "rgb", hex: MCP.toHex(col.red, col.green, col.blue) };
    case "CMYKColor": {
      var k = col.black / 100;
      return { type: "cmyk", c: col.cyan, m: col.magenta, y: col.yellow, k: col.black,
        hex: MCP.toHex(255 * (1 - col.cyan / 100) * (1 - k), 255 * (1 - col.magenta / 100) * (1 - k), 255 * (1 - col.yellow / 100) * (1 - k)) };
    }
    case "GrayColor": { var v = 255 * (1 - col.gray / 100); return { type: "gray", hex: MCP.toHex(v, v, v) }; }
    case "SpotColor": { var d = MCP.describeColor(col.spot.color); if (d) d.spot = col.spot.name; return d; }
    case "GradientColor": return { type: "gradient", name: col.gradient.name };
    case "PatternColor": return { type: "pattern", name: col.pattern.name };
    case "NoColor": return null;
  }
  return { type: col.typename };
};

/* gradient spec: { type: "linear"|"radial", angle, stops: [{ color: {hex}, position: 0..100, opacity? }] } */
MCP.gradientColor = function (spec) {
  var doc = MCP.doc();
  var g = doc.gradients.add();
  g.name = spec.name || ("MCP Gradient " + doc.gradients.length);
  g.type = spec.type === "radial" ? GradientType.RADIAL : GradientType.LINEAR;
  var stops = spec.stops;
  while (g.gradientStops.length < stops.length) g.gradientStops.add();
  for (var i = 0; i < stops.length; i++) {
    var st = g.gradientStops[i];
    st.color = MCP.color(stops[i].color);
    st.rampPoint = stops[i].position;
    if (stops[i].opacity !== undefined) {
      try { st.opacity = stops[i].opacity; } catch (e) { MCP.warn("Gradient stop opacity not supported by this Illustrator version."); }
    }
  }
  var gc = new GradientColor();
  gc.gradient = g;
  return gc;
};

MCP.applyFill = function (item, spec) {
  if (spec === undefined) return;
  if (item.typename === "TextFrame") {
    item.textRange.characterAttributes.fillColor = MCP.color(spec);
    return;
  }
  if (item.typename === "GroupItem" || item.typename === "CompoundPathItem") {
    var paths = item.typename === "GroupItem" ? item.pageItems : item.pathItems;
    for (var i = 0; i < paths.length; i++) MCP.applyFill(paths[i], spec);
    return;
  }
  if (item.typename !== "PathItem") MCP.fail("UNSUPPORTED_OPERATION", "Item " + item.typename + " has no fill.");
  if (spec && spec.stops) {
    item.filled = true;
    item.fillColor = MCP.gradientColor(spec);
    if (spec.angle && spec.type !== "radial") item.rotate(spec.angle, false, false, true, false, Transformation.CENTER);
  } else if (!spec || spec === "none") {
    item.filled = false;
  } else {
    item.filled = true;
    item.fillColor = MCP.color(spec);
  }
};

/* stroke spec: { color, width, dashes?, cap?, join? } | "none" */
MCP.applyStroke = function (item, spec) {
  if (spec === undefined) return;
  if (item.typename === "TextFrame") {
    var ca = item.textRange.characterAttributes;
    if (!spec || spec === "none") { ca.strokeColor = new NoColor(); return; }
    ca.strokeColor = MCP.color(spec.color);
    if (spec.width !== undefined) ca.strokeWeight = spec.width;
    return;
  }
  if (item.typename === "GroupItem" || item.typename === "CompoundPathItem") {
    var paths = item.typename === "GroupItem" ? item.pageItems : item.pathItems;
    for (var i = 0; i < paths.length; i++) MCP.applyStroke(paths[i], spec);
    return;
  }
  if (item.typename !== "PathItem") MCP.fail("UNSUPPORTED_OPERATION", "Item " + item.typename + " has no stroke.");
  if (!spec || spec === "none") { item.stroked = false; return; }
  item.stroked = true;
  if (spec.color) item.strokeColor = MCP.color(spec.color);
  if (spec.width !== undefined) item.strokeWidth = spec.width;
  if (spec.dashes) item.strokeDashes = spec.dashes;
  if (spec.cap) item.strokeCap = { butt: StrokeCap.BUTTENDCAP, round: StrokeCap.ROUNDENDCAP, square: StrokeCap.PROJECTINGENDCAP }[spec.cap];
  if (spec.join) item.strokeJoin = { miter: StrokeJoin.MITERENDJOIN, round: StrokeJoin.ROUNDENDJOIN, bevel: StrokeJoin.BEVELENDJOIN }[spec.join];
};

MCP.BLEND = {
  normal: "NORMAL", multiply: "MULTIPLY", screen: "SCREEN", overlay: "OVERLAY", darken: "DARKEN",
  lighten: "LIGHTEN", colorDodge: "COLORDODGE", colorBurn: "COLORBURN", hardLight: "HARDLIGHT",
  softLight: "SOFTLIGHT", difference: "DIFFERENCE", exclusion: "EXCLUSION", hue: "HUE",
  saturation: "SATURATIONBLEND", color: "COLORBLEND", luminosity: "LUMINOSITY"
};

MCP.applyBlend = function (item, mode) {
  if (!mode) return;
  var key = MCP.BLEND[mode];
  if (!key) MCP.fail("VALIDATION_ERROR", "Unknown blend mode " + mode);
  item.blendingMode = BlendModes[key];
};

/* ---------------- geometry ---------------- */
/* geometricBounds [left, top, right, bottom] (y up) -> {x, y, width, height} (y down) */
MCP.box = function (b) {
  return { x: b[0], y: -b[1], width: b[2] - b[0], height: b[1] - b[3] };
};

MCP.moveTo = function (item, x, y) {
  var gb = item.geometricBounds;
  item.translate(x - gb[0], -y - gb[1]);
};

MCP.resizeTo = function (item, width, height, about) {
  var b = MCP.box(item.geometricBounds);
  var sx = width !== undefined && width !== null && b.width > 0 ? (width / b.width) * 100 : 100;
  var sy = height !== undefined && height !== null && b.height > 0 ? (height / b.height) * 100 : 100;
  item.resize(sx, sy, true, true, true, true, 100 * Math.sqrt((sx / 100) * (sy / 100)), about || Transformation.TOPLEFT);
};

/* ---------------- item lookup ---------------- */
MCP.layerOf = function (item) {
  var p = item.parent;
  while (p && p.typename !== "Layer") p = p.parent;
  return p;
};

MCP.findLayer = function (doc, name, create) {
  for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === name) return doc.layers[i];
  if (create) { var l = doc.layers.add(); l.name = name; return l; }
  MCP.fail("OBJECT_NOT_FOUND", "Layer not found: " + name);
};

/* ref: { name?, uuid?, layer?, index? } or "selection" */
MCP.find = function (doc, ref) {
  if (ref === "selection") {
    if (!doc.selection || doc.selection.length === 0) MCP.fail("OBJECT_NOT_FOUND", "Selection is empty.");
    var sel = [];
    for (var s = 0; s < doc.selection.length; s++) sel.push(doc.selection[s]);
    return sel;
  }
  var items = ref.layer ? MCP.findLayer(doc, ref.layer, false).pageItems : doc.pageItems;
  var found = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (ref.uuid) { try { if (it.uuid === ref.uuid) found.push(it); } catch (e) { /* uuid needs Illustrator 2020+ */ } }
    else if (ref.name !== undefined && it.name === ref.name) found.push(it);
    else if (ref.index !== undefined && i === ref.index && ref.name === undefined) found.push(it);
  }
  if (found.length === 0) MCP.fail("OBJECT_NOT_FOUND", "No object matches " + MCP.stringify(ref));
  return found;
};

MCP.findOne = function (doc, ref) {
  return MCP.find(doc, ref)[0];
};

MCP.findAll = function (doc, refs) {
  var out = [];
  for (var i = 0; i < refs.length; i++) {
    var f = MCP.find(doc, refs[i]);
    for (var j = 0; j < f.length; j++) out.push(f[j]);
  }
  return out;
};

MCP.info = function (item, deep) {
  var o = { name: item.name, type: item.typename };
  try { o.uuid = item.uuid; } catch (e) { /* pre-2020 */ }
  var layer = MCP.layerOf(item);
  if (layer) o.layer = layer.name;
  try {
    o.bounds = MCP.box(item.geometricBounds);
    o.visibleBounds = MCP.box(item.visibleBounds);
  } catch (e2) { /* some items have no bounds */ }
  o.locked = item.locked; o.hidden = item.hidden;
  try { o.opacity = item.opacity; } catch (e3) { /* n/a */ }
  try { o.zOrder = item.absoluteZOrderPosition; } catch (e4) { /* n/a */ }
  if (item.typename === "PathItem") {
    o.fill = item.filled ? MCP.describeColor(item.fillColor) : null;
    o.stroke = item.stroked ? { color: MCP.describeColor(item.strokeColor), width: item.strokeWidth } : null;
    o.closed = item.closed; o.pointCount = item.pathPoints.length; o.clipping = item.clipping;
  } else if (item.typename === "TextFrame") {
    var ca = item.textRange.characterAttributes;
    o.contents = item.contents;
    o.textKind = String(item.kind);
    try { o.font = ca.textFont.name; o.fontFamily = ca.textFont.family; o.fontStyle = ca.textFont.style; } catch (e5) { o.font = null; }
    o.fontSize = ca.size; o.tracking = ca.tracking;
    o.leading = ca.autoLeading ? null : ca.leading;
    o.fill = MCP.describeColor(ca.fillColor);
    try { o.justification = String(item.textRange.paragraphAttributes.justification); } catch (e6) { /* n/a */ }
  } else if (item.typename === "PlacedItem") {
    try { o.file = item.file.fsName; o.linkExists = item.file.exists; } catch (e7) { o.file = null; o.linkExists = false; }
  } else if (item.typename === "RasterItem") {
    o.embedded = item.embedded;
  } else if (item.typename === "GroupItem") {
    o.clipped = item.clipped; o.childCount = item.pageItems.length;
    if (deep) { o.children = []; for (var i = 0; i < item.pageItems.length; i++) o.children.push(MCP.info(item.pageItems[i], deep)); }
  }
  return o;
};

/* Common styling shared by element creation and update ops. */
MCP.style = function (item, a) {
  if (a.name !== undefined) item.name = a.name;
  if (a.fill !== undefined) MCP.applyFill(item, a.fill);
  if (a.stroke !== undefined) MCP.applyStroke(item, a.stroke);
  if (a.opacity !== undefined) item.opacity = a.opacity;
  if (a.blendMode) MCP.applyBlend(item, a.blendMode);
  if (a.rotation) item.rotate(a.rotation);
  if (a.effects) for (var i = 0; i < a.effects.length; i++) MCP.applyEffectSpec(item, a.effects[i]);
  if (a.locked !== undefined) item.locked = a.locked;
  if (a.hidden !== undefined) item.hidden = a.hidden;
};

MCP.targetLayer = function (doc, name) {
  if (!name) return doc.activeLayer;
  var l = MCP.findLayer(doc, name, true);
  if (l.locked) MCP.fail("VALIDATION_ERROR", "Layer is locked: " + name);
  return l;
};

/* ---------------- dispatcher ---------------- */
MCP.writeResult = function (path, text) {
  if (!path) return;
  var f = new File(path);
  f.encoding = "UTF-8";
  f.open("w");
  f.write(text);
  f.close();
};

MCP.main = function (command, resultPath) {
  var out;
  var prevInteraction = app.userInteractionLevel;
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    var fn = MCP.ops[command.op];
    if (!fn) MCP.fail("UNSUPPORTED_OPERATION", "Operation is not allowlisted: " + command.op);
    var data = fn(command.args || {});
    out = { ok: true, data: data === undefined ? null : data, warnings: MCP.warnings };
  } catch (e) {
    out = { ok: false, error: { code: e.mcpCode || "ILLUSTRATOR_SCRIPT_ERROR", message: String(e.message || e),
      line: e.line, details: e.mcpDetails }, warnings: MCP.warnings };
  }
  try { app.userInteractionLevel = prevInteraction; } catch (e2) { /* ignore */ }
  var text = MCP.stringify(out);
  MCP.writeResult(resultPath, text);
  return text;
};
