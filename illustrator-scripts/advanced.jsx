/*
 * Advanced operations: Pathfinder, anchor-point editing, path utilities, image trace/relink,
 * artboard management, open-document management, undo/redo and typography roles.
 * Requires bootstrap.jsx, objects.jsx (MCP.targets) and typography.jsx (MCP.findFont).
 *
 * Verified against Illustrator 2026 (30.8): the Pathfinder ops only take effect when the
 * operands are grouped first, then "Live Pathfinder ..." + "expandStyle" is run on the group.
 */

/* ---------------- Pathfinder ---------------- */
MCP.PATHFINDER = {
  unite: "Live Pathfinder Add", minusFront: "Live Pathfinder Subtract", intersect: "Live Pathfinder Intersect",
  exclude: "Live Pathfinder Exclude", divide: "Live Pathfinder Divide", minusBack: "Live Pathfinder Minus Back"
};

MCP.ops.pathfinder = function (a) {
  var cmd = MCP.PATHFINDER[a.operation];
  if (!cmd) MCP.fail("VALIDATION_ERROR", "Unknown pathfinder operation " + a.operation);
  var doc = MCP.doc();
  var items = MCP.targets(a);
  if (items.length < 2) MCP.fail("VALIDATION_ERROR", "Pathfinder needs at least 2 objects.");
  for (var i = 0; i < items.length; i++) {
    if (items[i].locked || items[i].hidden) MCP.fail("VALIDATION_ERROR", "Object is locked or hidden: " + (items[i].name || items[i].typename));
  }
  var layer = MCP.layerOf(items[0]);
  /* Grouping keeps the stacking order the user sees (topmost first in the group). */
  var g = layer.groupItems.add();
  g.move(items[0], ElementPlacement.PLACEBEFORE);
  for (var j = items.length - 1; j >= 0; j--) items[j].move(g, ElementPlacement.PLACEATBEGINNING);
  doc.selection = null;
  g.selected = true;
  app.executeMenuCommand(cmd);
  app.redraw();
  app.executeMenuCommand("expandStyle");
  var sel = doc.selection;
  if (!sel || sel.length !== 1) MCP.fail("ILLUSTRATOR_SCRIPT_ERROR", "Pathfinder produced no result (selection length " + (sel ? sel.length : 0) + ").");
  var result = sel[0];
  /* Unwrap single-child groups so a unite/intersect yields a plain path. */
  if (result.typename === "GroupItem" && result.pageItems.length === 1) {
    var child = result.pageItems[0];
    child.move(result, ElementPlacement.PLACEBEFORE);
    result.remove();
    result = child;
  }
  if (a.name) result.name = a.name;
  doc.selection = null;
  return MCP.info(result, true);
};

/* ---------------- flip ---------------- */
MCP.ops.flip_objects = function (a) {
  var items = MCP.targets(a);
  var sx = a.axis === "horizontal" ? -100 : 100, sy = a.axis === "vertical" ? -100 : 100;
  for (var i = 0; i < items.length; i++) items[i].resize(sx, sy, true, true, true, true, 100, Transformation.CENTER);
  return MCP.infos(items);
};

/* ---------------- anchor points ---------------- */
MCP.pathTarget = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var item = MCP.findOne(doc, a.target);
  if (item.typename !== "PathItem") MCP.fail("VALIDATION_ERROR", "Target is not a path: " + (item.name || item.typename));
  if (item.locked) MCP.fail("VALIDATION_ERROR", "Path is locked: " + item.name);
  return item;
};

MCP.pt = function (p) { return [p[0], -p[1]]; };

MCP.describePoints = function (path) {
  var out = [];
  for (var i = 0; i < path.pathPoints.length; i++) {
    var p = path.pathPoints[i];
    out.push({ index: i, x: p.anchor[0], y: -p.anchor[1], "in": [p.leftDirection[0], -p.leftDirection[1]],
      out: [p.rightDirection[0], -p.rightDirection[1]], type: p.pointType === PointType.SMOOTH ? "smooth" : "corner" });
  }
  return out;
};

MCP.pathResult = function (path) {
  var o = MCP.info(path);
  o.points = MCP.describePoints(path);
  return o;
};

MCP.checkIndex = function (path, i) {
  if (i === undefined || i === null || i < 0 || i >= path.pathPoints.length) {
    MCP.fail("VALIDATION_ERROR", "Point index " + i + " is out of range (0.." + (path.pathPoints.length - 1) + ").");
  }
};

/* Rebuild a path from point specs [{anchor:[x,y], left:[x,y], right:[x,y], type}] in Illustrator coords. */
MCP.setPoints = function (path, specs) {
  while (path.pathPoints.length > specs.length) path.pathPoints[path.pathPoints.length - 1].remove();
  while (path.pathPoints.length < specs.length) path.pathPoints.add();
  for (var i = 0; i < specs.length; i++) {
    var p = path.pathPoints[i], s = specs[i];
    p.anchor = s.anchor; p.leftDirection = s.left; p.rightDirection = s.right; p.pointType = s.type;
  }
};

MCP.readPoints = function (path) {
  var out = [];
  for (var i = 0; i < path.pathPoints.length; i++) {
    var p = path.pathPoints[i];
    out.push({ anchor: p.anchor, left: p.leftDirection, right: p.rightDirection, type: p.pointType });
  }
  return out;
};

MCP.ops.edit_path_points = function (a) {
  var path = MCP.pathTarget(a);
  var p, dx, dy;
  switch (a.action) {
    case "list":
      return MCP.pathResult(path);
    case "move":
      MCP.checkIndex(path, a.index);
      p = path.pathPoints[a.index];
      dx = a.x - p.anchor[0]; dy = -a.y - p.anchor[1];
      p.anchor = [a.x, -a.y];
      /* Handles travel with the anchor unless new ones are given. */
      p.leftDirection = a["in"] ? MCP.pt(a["in"]) : [p.leftDirection[0] + dx, p.leftDirection[1] + dy];
      p.rightDirection = a.out ? MCP.pt(a.out) : [p.rightDirection[0] + dx, p.rightDirection[1] + dy];
      break;
    case "set_handles":
      MCP.checkIndex(path, a.index);
      p = path.pathPoints[a.index];
      if (a["in"]) p.leftDirection = MCP.pt(a["in"]);
      if (a.out) p.rightDirection = MCP.pt(a.out);
      if (a.pointType) p.pointType = a.pointType === "smooth" ? PointType.SMOOTH : PointType.CORNER;
      break;
    case "convert":
      MCP.checkIndex(path, a.index);
      p = path.pathPoints[a.index];
      if (a.pointType === "corner") { p.leftDirection = p.anchor; p.rightDirection = p.anchor; p.pointType = PointType.CORNER; }
      else MCP.fail("VALIDATION_ERROR", "convert supports pointType 'corner'; use set_handles to make a smooth point.");
      break;
    case "add": {
      var specs = MCP.readPoints(path);
      var n = specs.length;
      var at = a.index === undefined ? n : a.index + 1;
      if (at < 0 || at > n) MCP.fail("VALIDATION_ERROR", "Insert position out of range.");
      var anchor;
      if (a.x !== undefined && a.y !== undefined) anchor = [a.x, -a.y];
      else {
        /* Midpoint of the segment after index (straight-line midpoint between anchors). */
        if (a.index === undefined) MCP.fail("VALIDATION_ERROR", "Provide x/y, or index to insert at a segment midpoint.");
        var p0 = specs[a.index].anchor, p1 = specs[(a.index + 1) % n].anchor;
        anchor = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      }
      var ns = { anchor: anchor, left: a["in"] ? MCP.pt(a["in"]) : anchor, right: a.out ? MCP.pt(a.out) : anchor,
        type: a.pointType === "smooth" ? PointType.SMOOTH : PointType.CORNER };
      specs.splice(at, 0, ns);
      MCP.setPoints(path, specs);
      break;
    }
    case "remove":
      MCP.checkIndex(path, a.index);
      if (path.pathPoints.length <= 2) MCP.fail("VALIDATION_ERROR", "A path must keep at least 2 points.");
      path.pathPoints[a.index].remove();
      break;
    default:
      MCP.fail("VALIDATION_ERROR", "Unknown action " + a.action);
  }
  return MCP.pathResult(path);
};

MCP.ops.reverse_path = function (a) {
  var path = MCP.pathTarget(a);
  var specs = MCP.readPoints(path), rev = [];
  for (var i = specs.length - 1; i >= 0; i--) rev.push({ anchor: specs[i].anchor, left: specs[i].right, right: specs[i].left, type: specs[i].type });
  MCP.setPoints(path, rev);
  return MCP.pathResult(path);
};

MCP.ops.set_path_closed = function (a) {
  var path = MCP.pathTarget(a);
  path.closed = !!a.closed;
  return MCP.info(path);
};

/* Split an open path at an anchor into two paths, or a closed path into one open path starting there. */
MCP.ops.split_path = function (a) {
  var path = MCP.pathTarget(a);
  MCP.checkIndex(path, a.index);
  var specs = MCP.readPoints(path), n = specs.length, i;
  if (path.closed) {
    var rot = [];
    for (i = 0; i <= n; i++) rot.push(specs[(a.index + i) % n]);
    path.closed = false;
    MCP.setPoints(path, rot);
    return { paths: [MCP.info(path)] };
  }
  if (a.index === 0 || a.index === n - 1) MCP.fail("VALIDATION_ERROR", "Cannot split an open path at its end point.");
  var second = path.duplicate();
  second.name = (path.name || "Path") + " 2";
  MCP.setPoints(path, specs.slice(0, a.index + 1));
  MCP.setPoints(second, specs.slice(a.index));
  return { paths: [MCP.info(path), MCP.info(second)] };
};

MCP.ops.join_paths = function (a) {
  var doc = MCP.doc();
  var items = MCP.targets(a);
  if (items.length < 2) MCP.fail("VALIDATION_ERROR", "Join needs at least 2 open paths.");
  doc.selection = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].typename !== "PathItem") MCP.fail("VALIDATION_ERROR", "Join only works on paths: " + (items[i].name || items[i].typename));
    items[i].selected = true;
  }
  app.executeMenuCommand("join");
  var sel = doc.selection;
  if (!sel || sel.length === 0) MCP.fail("ILLUSTRATOR_SCRIPT_ERROR", "Join produced no result.");
  if (sel.length > 1) MCP.warn("Illustrator left " + sel.length + " paths; endpoints that do not meet are joined with straight segments only when exactly two paths are selected.");
  if (a.name) sel[0].name = a.name;
  var out = MCP.infos(sel);
  doc.selection = null;
  return out;
};

/*
 * Simplify: Illustrator's Simplify command opens a dialog that scripting cannot drive, so this
 * removes anchors whose removal moves the outline by less than "tolerance" points
 * (Ramer-Douglas-Peucker over anchors). Handles of removed anchors are dropped; kept anchors keep theirs.
 */
MCP.rdp = function (pts, first, last, tol, keep) {
  var maxD = 0, idx = -1;
  var ax = pts[first][0], ay = pts[first][1], bx = pts[last][0], by = pts[last][1];
  var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  for (var i = first + 1; i < last; i++) {
    var d = len === 0 ? Math.sqrt((pts[i][0] - ax) * (pts[i][0] - ax) + (pts[i][1] - ay) * (pts[i][1] - ay))
      : Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (idx >= 0 && maxD > tol) {
    keep[idx] = true;
    MCP.rdp(pts, first, idx, tol, keep);
    MCP.rdp(pts, idx, last, tol, keep);
  }
};

MCP.ops.simplify_path = function (a) {
  var path = MCP.pathTarget(a);
  var specs = MCP.readPoints(path), n = specs.length;
  var minPts = path.closed ? 3 : 2;
  if (n <= minPts) return { before: n, after: n, path: MCP.info(path) };
  var pts = [], i;
  for (i = 0; i < n; i++) pts.push(specs[i].anchor);
  if (path.closed) pts.push(specs[0].anchor);
  var keep = {};
  keep[0] = true; keep[pts.length - 1] = true;
  MCP.rdp(pts, 0, pts.length - 1, a.tolerance, keep);
  var out = [];
  for (i = 0; i < n; i++) if (keep[i]) out.push(specs[i]);
  if (out.length < minPts) { MCP.warn("Tolerance too large; kept the minimum shape."); out = specs.slice(0, minPts); }
  MCP.setPoints(path, out);
  return { before: n, after: out.length, path: MCP.info(path) };
};

/* ---------------- images ---------------- */
MCP.imageInfo = function (it) {
  var o = MCP.info(it);
  if (it.typename === "PlacedItem") {
    o.kind = "linked";
    try { o.file = it.file.fsName; o.linkExists = it.file.exists; } catch (e) { o.file = null; o.linkExists = false; }
  } else {
    o.kind = it.embedded ? "embedded" : "raster";
    try { o.pixelWidth = it.boundingBox[2] - it.boundingBox[0]; o.pixelHeight = it.boundingBox[1] - it.boundingBox[3]; } catch (e2) { /* n/a */ }
    try { o.channels = it.channels; o.bitsPerChannel = it.bitsPerChannel; o.colorants = it.colorants; } catch (e3) { /* n/a */ }
  }
  /* Effective resolution: native pixels (72 ppi base) over placed size. */
  try {
    var bb = it.boundingBox, gb = it.geometricBounds;
    var nativeW = bb[2] - bb[0], placedW = gb[2] - gb[0];
    if (placedW > 0 && nativeW > 0) o.effectivePpi = Math.round((nativeW / placedW) * 72);
  } catch (e4) { /* n/a */ }
  o.isVector = false;
  return o;
};

MCP.ops.get_image_info = function (a) {
  var doc = MCP.doc();
  var list = [];
  var items = a.target ? MCP.find(doc, a.target) : null, i;
  if (items) {
    for (i = 0; i < items.length; i++) {
      if (items[i].typename !== "PlacedItem" && items[i].typename !== "RasterItem") MCP.fail("VALIDATION_ERROR", "Not an image: " + (items[i].name || items[i].typename));
      list.push(MCP.imageInfo(items[i]));
    }
  } else {
    for (i = 0; i < doc.placedItems.length; i++) list.push(MCP.imageInfo(doc.placedItems[i]));
    for (i = 0; i < doc.rasterItems.length; i++) list.push(MCP.imageInfo(doc.rasterItems[i]));
  }
  var missing = 0;
  for (i = 0; i < list.length; i++) if (list[i].kind === "linked" && !list[i].linkExists) missing++;
  return { images: list, count: list.length, missingLinks: missing };
};

MCP.ops.replace_image = function (a) {
  var doc = MCP.doc();
  var it = MCP.findOne(doc, a.target);
  if (it.typename !== "PlacedItem") MCP.fail("UNSUPPORTED_OPERATION", "Only linked images (PlacedItem) can be relinked; embedded images cannot. Place a new image instead.");
  var f = new File(a.path);
  if (!f.exists) MCP.fail("FILE_NOT_FOUND", "Image not found: " + a.path);
  var b = MCP.box(it.geometricBounds);
  it.file = f;
  if (a.keepBounds !== false) { MCP.resizeTo(it, b.width, b.height); MCP.moveTo(it, b.x, b.y); }
  return MCP.imageInfo(it);
};

MCP.ops.trace_image = function (a) {
  var doc = MCP.doc();
  var it = MCP.findOne(doc, a.target);
  if (it.typename !== "PlacedItem" && it.typename !== "RasterItem") MCP.fail("VALIDATION_ERROR", "Image Trace needs a placed or raster image; got " + it.typename);
  var name = it.name;
  var traced = it.trace();
  var tracing = traced.tracing;
  if (a.preset) {
    var ok = false;
    for (var i = 0; i < app.tracingPresetsList.length; i++) if (app.tracingPresetsList[i] === a.preset) ok = true;
    if (!ok) MCP.fail("VALIDATION_ERROR", "Unknown tracing preset '" + a.preset + "'. Available: " + app.tracingPresetsList.join(", "));
    tracing.tracingOptions.loadFromPreset(a.preset);
  }
  app.redraw();
  var result = { preset: a.preset || "(Illustrator default)", pathCount: tracing.pathCount, anchorCount: tracing.anchorCount, colorCount: tracing.usedColorCount };
  if (a.expand !== false) {
    var g = tracing.expandTracing();
    g.name = a.name || ((name || "Image") + " (traced)");
    result.item = MCP.info(g);
    result.isVector = true;
  } else {
    traced.name = a.name || ((name || "Image") + " (live trace)");
    result.item = MCP.info(traced);
    result.isVector = false;
    MCP.warn("Left as a live Image Trace object; pass expand: true to get editable vector paths.");
  }
  return result;
};

/* ---------------- artboards ---------------- */
MCP.artboardIndex = function (doc, i) {
  if (i === undefined || i === null || i < 0 || i >= doc.artboards.length) MCP.fail("VALIDATION_ERROR", "Artboard index " + i + " does not exist.");
  return i;
};

MCP.ops.rename_artboard = function (a) {
  var doc = MCP.doc();
  doc.artboards[MCP.artboardIndex(doc, a.index)].name = a.name;
  return { artboards: MCP.docInfo(doc).artboards };
};

MCP.ops.delete_artboard = function (a) {
  var doc = MCP.doc();
  var i = MCP.artboardIndex(doc, a.index);
  if (doc.artboards.length === 1) MCP.fail("VALIDATION_ERROR", "A document must keep at least one artboard.");
  var removedName = doc.artboards[i].name;
  doc.artboards.remove(i);
  return { removed: removedName, artboards: MCP.docInfo(doc).artboards, note: "Artwork on the artboard was not deleted." };
};

/* Duplicate an artboard to the right (or at dx/dy) together with the artwork that lies fully inside it. */
MCP.ops.duplicate_artboard = function (a) {
  var doc = MCP.doc();
  var i = MCP.artboardIndex(doc, a.index);
  var r = doc.artboards[i].artboardRect;
  var w = r[2] - r[0], h = r[1] - r[3];
  var dx = a.dx !== undefined ? a.dx : w + (a.gap !== undefined ? a.gap : 40);
  var dy = a.dy !== undefined ? -a.dy : 0;
  var ab = doc.artboards.add([r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]);
  ab.name = a.name || (doc.artboards[i].name + " copy");
  var copied = 0;
  if (a.withArtwork !== false) {
    var items = [];
    for (var k = 0; k < doc.pageItems.length; k++) {
      var it = doc.pageItems[k];
      if (it.parent.typename !== "Layer") continue;
      var b = it.geometricBounds;
      if (b[0] >= r[0] - 0.5 && b[2] <= r[2] + 0.5 && b[1] <= r[1] + 0.5 && b[3] >= r[3] - 0.5) items.push(it);
    }
    for (var m = 0; m < items.length; m++) {
      var lay = MCP.layerOf(items[m]);
      if (lay.locked || items[m].locked) continue;
      var d = items[m].duplicate();
      d.translate(dx, dy);
      copied++;
    }
  }
  return { artboard: ab.name, index: doc.artboards.length - 1, copiedObjects: copied, artboards: MCP.docInfo(doc).artboards };
};

/* ---------------- documents ---------------- */
MCP.ops.list_documents = function () {
  var out = [];
  var active = app.documents.length ? app.activeDocument : null;
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    var path = null;
    try { if (d.fullName && d.fullName.exists) path = d.fullName.fsName; } catch (e) { /* unsaved */ }
    out.push({ index: i, name: d.name, path: path, saved: !!path && d.saved, active: d === active,
      colorMode: d.documentColorSpace === DocumentColorSpace.CMYK ? "CMYK" : "RGB", artboards: d.artboards.length, layers: d.layers.length });
  }
  return { documents: out, count: out.length };
};

MCP.ops.activate_document = function (a) {
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    if ((a.name && d.name === a.name) || (a.index !== undefined && i === a.index)) { d.activate(); MCP.pinned = d; return { active: d.name }; }
  }
  MCP.fail("OBJECT_NOT_FOUND", "No open document matches " + MCP.stringify(a));
};

/* ---------------- undo / redo ---------------- */
/* Illustrator undoes one internal step per call, not one script; callers state how many steps. */
MCP.ops.undo = function (a) {
  MCP.doc();
  var n = a.steps || 1, done = 0;
  for (var i = 0; i < n; i++) { try { app.undo(); done++; } catch (e) { break; } }
  if (done < n) MCP.warn("Only " + done + " of " + n + " steps could be undone.");
  return { undone: done };
};

MCP.ops.redo = function (a) {
  MCP.doc();
  var n = a.steps || 1, done = 0;
  for (var i = 0; i < n; i++) { try { app.redo(); done++; } catch (e) { break; } }
  if (done < n) MCP.warn("Only " + done + " of " + n + " steps could be redone.");
  return { redone: done };
};

/* ---------------- typography ---------------- */
MCP.textEntry = function (tf) {
  var ca = tf.textRange.characterAttributes, font = null, family = null, style = null;
  try { font = ca.textFont.name; family = ca.textFont.family; style = ca.textFont.style; } catch (e) { /* missing font */ }
  return { item: tf, name: tf.name, layer: MCP.layerOf(tf).name, font: font, family: family, style: style, size: ca.size,
    contents: tf.contents.length > 60 ? tf.contents.substr(0, 60) + "..." : tf.contents };
};

/* Group text by font + size so the client can see the type system and its inconsistencies. */
MCP.ops.analyze_typography = function () {
  var doc = MCP.doc();
  var styles = {}, keys = [], frames = [], i;
  for (i = 0; i < doc.textFrames.length; i++) {
    var e = MCP.textEntry(doc.textFrames[i]);
    frames.push({ name: e.name, layer: e.layer, font: e.font, size: e.size, contents: e.contents });
    var k = (e.font || "(missing)") + "@" + Math.round(e.size * 10) / 10;
    if (!styles[k]) { styles[k] = { font: e.font, family: e.family, style: e.style, size: e.size, count: 0, objects: [] }; keys.push(k); }
    styles[k].count++;
    if (styles[k].objects.length < 20) styles[k].objects.push(e.name || e.contents);
  }
  var list = [], fams = {}, famCount = 0, sizes = {}, sizeCount = 0;
  for (i = 0; i < keys.length; i++) {
    var s = styles[keys[i]];
    list.push(s);
    if (s.family && !fams[s.family]) { fams[s.family] = true; famCount++; }
    var sk = String(Math.round(s.size * 10) / 10);
    if (!sizes[sk]) { sizes[sk] = true; sizeCount++; }
  }
  return { textFrames: frames, styles: list, familyCount: famCount, sizeCount: sizeCount };
};

/*
 * Apply font/size rules by role. A frame matches a rule when all given criteria hold
 * (minSize, maxSize, layer, nameContains); the first matching rule wins.
 */
MCP.ops.apply_typography_roles = function (a) {
  var doc = MCP.doc();
  var resolved = [], i, r;
  for (r = 0; r < a.rules.length; r++) {
    var f = a.rules[r].font ? MCP.findFont(a.rules[r].font) : null;
    if (a.rules[r].font && !f) MCP.fail("FILE_NOT_FOUND", "Font is not installed: " + a.rules[r].font);
    resolved.push(f);
  }
  var changes = [], skipped = 0;
  for (i = 0; i < doc.textFrames.length; i++) {
    var tf = doc.textFrames[i];
    var e = MCP.textEntry(tf);
    if (tf.locked || MCP.layerOf(tf).locked) { skipped++; continue; }
    for (r = 0; r < a.rules.length; r++) {
      var rule = a.rules[r];
      if (rule.minSize !== undefined && e.size < rule.minSize) continue;
      if (rule.maxSize !== undefined && e.size > rule.maxSize) continue;
      if (rule.layer && e.layer !== rule.layer) continue;
      if (rule.nameContains && (e.name || "").toLowerCase().indexOf(rule.nameContains.toLowerCase()) < 0) continue;
      if (!a.dryRun) {
        var ca = tf.textRange.characterAttributes;
        if (resolved[r]) ca.textFont = resolved[r];
        if (rule.size !== undefined) ca.size = rule.size;
        if (rule.tracking !== undefined) ca.tracking = rule.tracking;
        if (rule.leading !== undefined) { ca.autoLeading = false; ca.leading = rule.leading; }
        if (rule.color) ca.fillColor = MCP.color(rule.color);
      }
      changes.push({ name: e.name, contents: e.contents, role: rule.role, from: { font: e.font, size: e.size },
        to: { font: resolved[r] ? resolved[r].name : e.font, size: rule.size !== undefined ? rule.size : e.size } });
      break;
    }
  }
  if (skipped) MCP.warn(skipped + " locked text frame(s) were skipped.");
  return { dryRun: !!a.dryRun, changed: changes.length, changes: changes };
};
