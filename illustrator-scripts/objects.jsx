/* Object management, appearance and layout operations. Requires bootstrap.jsx. */

MCP.targets = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  return a.targets ? MCP.findAll(doc, a.targets) : MCP.find(doc, a.target || "selection");
};

MCP.infos = function (items) {
  var out = [];
  for (var i = 0; i < items.length; i++) out.push(MCP.info(items[i]));
  return { items: out, count: out.length };
};

/* ---------------- selection ---------------- */
MCP.ops.select_objects = function (a) {
  var doc = MCP.doc();
  var pick = [];
  if (a.targets) pick = MCP.findAll(doc, a.targets);
  else {
    var pool = a.layer ? MCP.findLayer(doc, a.layer, false).pageItems : doc.pageItems;
    for (var i = 0; i < pool.length; i++) {
      var it = pool[i];
      if (a.type && it.typename !== a.type) continue;
      if (a.nameContains && (it.name || "").indexOf(a.nameContains) < 0) continue;
      if (it.locked || it.hidden) continue;
      pick.push(it);
    }
  }
  doc.selection = null;
  doc.selection = pick;
  return MCP.infos(pick);
};

MCP.ops.inspect_selection = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  if (!doc.selection || doc.selection.length === 0) return { items: [], count: 0 };
  var items = [];
  for (var i = 0; i < doc.selection.length; i++) items.push(MCP.info(doc.selection[i], a.deep));
  return { items: items, count: items.length };
};

/* ---------------- transforms ---------------- */
MCP.ANCHOR = {
  topLeft: "TOPLEFT", top: "TOP", topRight: "TOPRIGHT", left: "LEFT", center: "CENTER", right: "RIGHT",
  bottomLeft: "BOTTOMLEFT", bottom: "BOTTOM", bottomRight: "BOTTOMRIGHT"
};

MCP.transformOne = function (it, a) {
  var about = Transformation[MCP.ANCHOR[a.anchor || "center"]];
  if (a.width !== undefined || a.height !== undefined) {
    var b = MCP.box(it.geometricBounds);
    var w = a.width, h = a.height;
    if (a.keepProportions !== false) {
      if (w !== undefined && h === undefined) h = b.height * (w / b.width);
      if (h !== undefined && w === undefined) w = b.width * (h / b.height);
    }
    MCP.resizeTo(it, w, h, about);
  }
  if (a.scale !== undefined || a.scaleX !== undefined || a.scaleY !== undefined) {
    var sx = a.scaleX !== undefined ? a.scaleX : a.scale !== undefined ? a.scale : 100;
    var sy = a.scaleY !== undefined ? a.scaleY : a.scale !== undefined ? a.scale : 100;
    it.resize(sx, sy, true, true, true, true, a.scaleStrokes === false ? 100 : Math.sqrt(sx * sy), about);
  }
  if (a.rotation) it.rotate(a.rotation, true, true, true, true, about);
  if (a.x !== undefined || a.y !== undefined) {
    var bb = MCP.box(it.geometricBounds);
    MCP.moveTo(it, a.x !== undefined ? a.x : bb.x, a.y !== undefined ? a.y : bb.y);
  }
  if (a.dx || a.dy) it.translate(a.dx || 0, -(a.dy || 0));
  if (a.reflect === "horizontal") it.resize(-100, 100);
  if (a.reflect === "vertical") it.resize(100, -100);
};

MCP.ops.transform_objects = function (a) {
  var items = MCP.targets(a);
  for (var i = 0; i < items.length; i++) {
    if (items[i].locked) MCP.fail("VALIDATION_ERROR", "Object is locked: " + items[i].name);
    MCP.transformOne(items[i], a);
  }
  return MCP.infos(items);
};

MCP.ops.duplicate_object = function (a) {
  var items = MCP.targets(a);
  var out = [];
  var copies = a.copies || 1;
  for (var c = 1; c <= copies; c++) {
    for (var i = 0; i < items.length; i++) {
      var d = items[i].duplicate();
      d.translate((a.dx || 0) * c, -(a.dy || 0) * c);
      d.name = (a.name || items[i].name || "Copy") + (copies > 1 || !a.name ? " " + c : "");
      out.push(d);
    }
  }
  return MCP.infos(out);
};

MCP.ops.delete_object = function (a) {
  var items = MCP.targets(a);
  var names = [];
  for (var i = items.length - 1; i >= 0; i--) { names.push(items[i].name || items[i].typename); items[i].remove(); }
  return { deleted: names, count: names.length };
};

MCP.ops.group_objects = function (a) {
  var items = MCP.targets(a);
  var layer = MCP.layerOf(items[0]);
  var g = layer.groupItems.add();
  for (var i = items.length - 1; i >= 0; i--) items[i].move(g, ElementPlacement.PLACEATBEGINNING);
  if (a.name) g.name = a.name;
  return MCP.info(g, true);
};

MCP.ops.ungroup_objects = function (a) {
  var items = MCP.targets(a);
  var released = [];
  for (var i = 0; i < items.length; i++) {
    var g = items[i];
    if (g.typename !== "GroupItem") MCP.fail("VALIDATION_ERROR", "Not a group: " + g.name);
    if (g.clipped && !a.releaseClipping) MCP.fail("CONFIRMATION_REQUIRED", "Group " + g.name + " is a clipping group; pass releaseClipping: true.");
    while (g.pageItems.length > 0) {
      var child = g.pageItems[0];
      child.move(g, ElementPlacement.PLACEBEFORE);
      released.push(MCP.info(child));
    }
    g.remove();
  }
  return { items: released, count: released.length };
};

MCP.ops.set_properties = function (a) {
  var items = MCP.targets(a);
  for (var i = 0; i < items.length; i++) {
    if (a.locked !== undefined) items[i].locked = a.locked;
    if (a.hidden !== undefined) items[i].hidden = a.hidden;
    if (a.rename !== undefined) items[i].name = items.length > 1 ? a.rename + " " + (i + 1) : a.rename;
  }
  return MCP.infos(items);
};

MCP.ops.set_z_order = function (a) {
  var items = MCP.targets(a);
  var m = { front: "BRINGTOFRONT", back: "SENDTOBACK", forward: "BRINGFORWARD", backward: "SENDBACKWARD" }[a.order];
  for (var i = 0; i < items.length; i++) items[i].zOrder(ZOrderMethod[m]);
  return MCP.infos(items);
};

/* ---------------- appearance ---------------- */
MCP.ops.set_appearance = function (a) {
  var items = MCP.targets(a);
  for (var i = 0; i < items.length; i++) MCP.style(items[i], a);
  return MCP.infos(items);
};

/* Live effects via applyEffect (Illustrator CC 2018+). XML formats follow Illustrator's
   LiveEffect dictionary syntax; verify against your version with the integration test. */
MCP.applyEffectSpec = function (item, e) {
  if (typeof item.applyEffect !== "function") {
    MCP.fail("UNSUPPORTED_OPERATION", "This Illustrator version does not expose PageItem.applyEffect.");
  }
  var xml;
  if (e.type === "shadow") {
    xml = '<LiveEffect name="Adobe Drop Shadow"><Dict data="R horz ' + (e.offsetX || 4) + " R vert " + (e.offsetY || 4) +
      " R blur " + (e.blur || 5) + " R opac " + (e.opacity === undefined ? 0.5 : e.opacity) +
      ' I blnd 1 B usePSLBlur 1 I csrc 0 R dark 100 "/></LiveEffect>';
  } else if (e.type === "blur") {
    xml = '<LiveEffect name="Adobe PSL Gaussian Blur"><Dict data="R blur ' + (e.radius || 5) + ' "/></LiveEffect>';
  } else if (e.type === "innerGlow" || e.type === "outerGlow") {
    xml = '<LiveEffect name="Adobe ' + (e.type === "innerGlow" ? "Inner" : "Outer") + ' Glow"><Dict data="R blur ' +
      (e.radius || 8) + " R opac " + (e.opacity === undefined ? 0.75 : e.opacity) + ' I mode 2 "/></LiveEffect>';
  } else MCP.fail("VALIDATION_ERROR", "Unknown effect " + e.type);
  item.applyEffect(xml);
};

MCP.ops.apply_effect = function (a) {
  var items = MCP.targets(a);
  for (var i = 0; i < items.length; i++) MCP.applyEffectSpec(items[i], a.effect);
  return MCP.infos(items);
};

MCP.ops.create_swatches = function (a) {
  var doc = MCP.doc();
  var group = null;
  if (a.group) { group = doc.swatchGroups.add(); group.name = a.group; }
  var out = [];
  for (var i = 0; i < a.colors.length; i++) {
    var s = doc.swatches.add();
    s.name = a.colors[i].name;
    s.color = MCP.color(a.colors[i].color);
    if (group) group.addSwatch(s);
    out.push(s.name);
  }
  return { swatches: out, group: a.group || null };
};

/* ---------------- layout ---------------- */
MCP.abBox = function (doc) {
  var r = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  return { x: 0, y: 0, width: r[2] - r[0], height: r[1] - r[3] };
};

MCP.unionBox = function (items) {
  var l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for (var i = 0; i < items.length; i++) {
    var bx = MCP.box(items[i].geometricBounds);
    l = Math.min(l, bx.x); t = Math.min(t, bx.y); r = Math.max(r, bx.x + bx.width); b = Math.max(b, bx.y + bx.height);
  }
  return { x: l, y: t, width: r - l, height: b - t };
};

MCP.ops.align_objects = function (a) {
  var doc = MCP.doc();
  var items = MCP.targets(a);
  /* if/else instead of a multi-line nested ternary: ExtendScript evaluated the "key" branch
     for relativeTo "artboard" and crashed on the undefined key. */
  var ref;
  if (a.relativeTo === "artboard") ref = MCP.abBox(doc);
  else if (a.relativeTo === "key") {
    if (!a.key) MCP.fail("VALIDATION_ERROR", "relativeTo \"key\" requires a key object reference.");
    ref = MCP.box(MCP.findOne(doc, a.key).geometricBounds);
  } else ref = MCP.unionBox(items);
  for (var i = 0; i < items.length; i++) {
    var b = MCP.box(items[i].geometricBounds);
    var x = b.x, y = b.y;
    switch (a.alignment) {
      case "left": x = ref.x; break;
      case "center": x = ref.x + (ref.width - b.width) / 2; break;
      case "right": x = ref.x + ref.width - b.width; break;
      case "top": y = ref.y; break;
      case "middle": y = ref.y + (ref.height - b.height) / 2; break;
      case "bottom": y = ref.y + ref.height - b.height; break;
    }
    MCP.moveTo(items[i], x, y);
  }
  return MCP.infos(items);
};

MCP.ops.distribute_objects = function (a) {
  var items = MCP.targets(a);
  if (items.length < 3 && a.spacing === undefined) MCP.fail("VALIDATION_ERROR", "Distribute needs 3+ objects, or an explicit spacing.");
  var horiz = a.axis !== "vertical";
  var arr = [];
  for (var i = 0; i < items.length; i++) arr.push({ it: items[i], b: MCP.box(items[i].geometricBounds) });
  arr.sort(function (p, q) { return horiz ? p.b.x - q.b.x : p.b.y - q.b.y; });
  var total = 0;
  for (var j = 0; j < arr.length; j++) total += horiz ? arr[j].b.width : arr[j].b.height;
  var first = arr[0].b, last = arr[arr.length - 1].b;
  var span = horiz ? last.x + last.width - first.x : last.y + last.height - first.y;
  var gap = a.spacing !== undefined ? a.spacing : (span - total) / (arr.length - 1);
  var cur = horiz ? first.x : first.y;
  for (var k = 0; k < arr.length; k++) {
    if (horiz) MCP.moveTo(arr[k].it, cur, arr[k].b.y); else MCP.moveTo(arr[k].it, arr[k].b.x, cur);
    cur += (horiz ? arr[k].b.width : arr[k].b.height) + gap;
  }
  return { gap: gap, items: MCP.infos(items).items };
};

/* Arrange targets in a row, column or grid starting at x/y. */
MCP.ops.arrange_objects = function (a) {
  var items = MCP.targets(a);
  var cols = a.mode === "row" ? items.length : a.mode === "column" ? 1 : (a.columns || Math.ceil(Math.sqrt(items.length)));
  var start = MCP.unionBox(items);
  var x0 = a.x !== undefined ? a.x : start.x, y0 = a.y !== undefined ? a.y : start.y;
  var gap = a.gap || 0, cellW = 0, cellH = 0;
  for (var i = 0; i < items.length; i++) {
    var b = MCP.box(items[i].geometricBounds);
    cellW = Math.max(cellW, b.width); cellH = Math.max(cellH, b.height);
  }
  for (var j = 0; j < items.length; j++) {
    MCP.moveTo(items[j], x0 + (j % cols) * (cellW + gap), y0 + Math.floor(j / cols) * (cellH + gap));
  }
  return MCP.infos(items);
};

MCP.ops.center_on_artboard = function (a) {
  var doc = MCP.doc();
  var items = MCP.targets(a);
  var ab = MCP.abBox(doc);
  var u = MCP.unionBox(items);
  var dx = a.axis === "vertical" ? 0 : ab.width / 2 - (u.x + u.width / 2);
  var dy = a.axis === "horizontal" ? 0 : ab.height / 2 - (u.y + u.height / 2);
  for (var i = 0; i < items.length; i++) items[i].translate(dx, -dy);
  return MCP.infos(items);
};

MCP.ops.calculate_object_bounds = function (a) {
  var items = MCP.targets(a);
  var each = [];
  for (var i = 0; i < items.length; i++) each.push({ name: items[i].name, geometric: MCP.box(items[i].geometricBounds), visible: MCP.box(items[i].visibleBounds) });
  return { union: MCP.unionBox(items), items: each, artboard: MCP.abBox(MCP.doc()) };
};

/* Guides: lines as guide paths on a dedicated layer. lines: [{ orientation, position }] */
MCP.ops.create_guides = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var ab = MCP.abBox(doc);
  var layer = MCP.findLayer(doc, a.layer || "Guides", true);
  var made = 0;
  for (var i = 0; i < a.lines.length; i++) {
    var g = a.lines[i];
    var p = layer.pathItems.add();
    if (g.orientation === "vertical") p.setEntirePath([[g.position, 0], [g.position, -ab.height]]);
    else p.setEntirePath([[0, -g.position], [ab.width, -g.position]]);
    p.guides = true;
    p.name = g.name || (g.orientation + " guide " + g.position);
    made++;
  }
  if (a.lock !== false) layer.locked = true;
  return { layer: layer.name, guides: made };
};

/* Visible grid made of thin stroked paths (not guides), useful as a design element. */
MCP.ops.create_grid = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var layer = MCP.targetLayer(doc, a.layer || "Grid");
  var g = layer.groupItems.add();
  g.name = a.name || "Grid";
  var stroke = { color: a.color || { hex: "#CCCCCC" }, width: a.strokeWidth || 0.5 };
  for (var x = a.x; x <= a.x + a.width + 0.001; x += a.cellWidth) {
    var v = g.pathItems.add(); v.setEntirePath([[x, -a.y], [x, -(a.y + a.height)]]); v.filled = false; MCP.applyStroke(v, stroke);
  }
  for (var y = a.y; y <= a.y + a.height + 0.001; y += a.cellHeight) {
    var h = g.pathItems.add(); h.setEntirePath([[a.x, -y], [a.x + a.width, -y]]); h.filled = false; MCP.applyStroke(h, stroke);
  }
  return MCP.info(g);
};
