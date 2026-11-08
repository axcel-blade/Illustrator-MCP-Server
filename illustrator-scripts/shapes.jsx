/* Vector creation operations. Requires bootstrap.jsx. Coordinates: points, artboard top-left, y down. */

MCP.prep = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  return { doc: doc, layer: MCP.targetLayer(doc, a.layer) };
};

MCP.finish = function (item, a) {
  if (a.fill === undefined && item.typename === "PathItem" && item.closed) a.fill = { hex: "#808080" };
  MCP.style(item, a);
  return MCP.info(item);
};

MCP.ops.draw_rectangle = function (a) {
  var c = MCP.prep(a);
  var item = a.cornerRadius
    ? c.layer.pathItems.roundedRectangle(-a.y, a.x, a.width, a.height, a.cornerRadius, a.cornerRadius)
    : c.layer.pathItems.rectangle(-a.y, a.x, a.width, a.height);
  return MCP.finish(item, a);
};

/* Ellipse by bounding box. */
MCP.ops.draw_ellipse = function (a) {
  var c = MCP.prep(a);
  return MCP.finish(c.layer.pathItems.ellipse(-a.y, a.x, a.width, a.height), a);
};

MCP.ops.draw_polygon = function (a) {
  var c = MCP.prep(a);
  return MCP.finish(c.layer.pathItems.polygon(a.cx, -a.cy, a.radius, a.sides), a);
};

MCP.ops.draw_star = function (a) {
  var c = MCP.prep(a);
  return MCP.finish(c.layer.pathItems.star(a.cx, -a.cy, a.radius, a.innerRadius, a.points), a);
};

MCP.ops.draw_line = function (a) {
  var c = MCP.prep(a);
  var p = c.layer.pathItems.add();
  p.setEntirePath([[a.x1, -a.y1], [a.x2, -a.y2]]);
  p.closed = false;
  p.filled = false;
  if (a.stroke === undefined) a.stroke = { color: { hex: "#000000" }, width: 1 };
  MCP.style(p, a);
  return MCP.info(p);
};

/* points: [{ x, y, in?: [x,y], out?: [x,y], corner?: bool }] */
MCP.buildPath = function (container, points, closed) {
  var p = container.pathItems.add();
  for (var i = 0; i < points.length; i++) {
    var pt = points[i];
    var pp = p.pathPoints.add();
    pp.anchor = [pt.x, -pt.y];
    pp.leftDirection = pt["in"] ? [pt["in"][0], -pt["in"][1]] : [pt.x, -pt.y];
    pp.rightDirection = pt.out ? [pt.out[0], -pt.out[1]] : [pt.x, -pt.y];
    pp.pointType = pt.corner || (!pt["in"] && !pt.out) ? PointType.CORNER : PointType.SMOOTH;
  }
  p.closed = !!closed;
  return p;
};

MCP.ops.draw_pen_path = function (a) {
  var c = MCP.prep(a);
  if (!a.points || a.points.length < 2) MCP.fail("VALIDATION_ERROR", "A path needs at least 2 points.");
  var p = MCP.buildPath(c.layer, a.points, a.closed);
  if (!a.closed && a.fill === undefined) { p.filled = false; if (a.stroke === undefined) a.stroke = { color: { hex: "#000000" }, width: 1 }; }
  return MCP.finish(p, a);
};

MCP.ops.create_compound_path = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var items = MCP.findAll(doc, a.targets);
  var layer = MCP.layerOf(items[0]);
  var cp = layer.compoundPathItems.add();
  for (var i = items.length - 1; i >= 0; i--) {
    if (items[i].typename !== "PathItem") MCP.fail("VALIDATION_ERROR", "Compound paths can only contain paths; got " + items[i].typename);
    items[i].move(cp, ElementPlacement.PLACEATBEGINNING);
  }
  if (a.name) cp.name = a.name;
  if (a.fill !== undefined) MCP.applyFill(cp, a.fill);
  return MCP.info(cp);
};

/* The first target becomes the clipping path; the rest are clipped. */
MCP.ops.create_clipping_mask = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var mask = MCP.findOne(doc, a.mask);
  if (mask.typename !== "PathItem" && mask.typename !== "CompoundPathItem" && mask.typename !== "TextFrame") {
    MCP.fail("VALIDATION_ERROR", "Clipping path must be a path, compound path or text.");
  }
  var content = MCP.findAll(doc, a.targets);
  var layer = MCP.layerOf(mask);
  var g = layer.groupItems.add();
  for (var i = content.length - 1; i >= 0; i--) content[i].move(g, ElementPlacement.PLACEATBEGINNING);
  mask.move(g, ElementPlacement.PLACEATBEGINNING);
  g.clipped = true;
  if (a.name) g.name = a.name;
  return MCP.info(g, true);
};

MCP.ops.create_symbol = function (a) {
  var doc = MCP.doc();
  var item = MCP.findOne(doc, a.target);
  var sym = doc.symbols.add(item);
  if (a.name) sym.name = a.name;
  var result = { symbol: sym.name, symbolCount: doc.symbols.length };
  if (a.replaceWithInstance) {
    var b = MCP.box(item.geometricBounds);
    var layer = MCP.layerOf(item);
    var inst = layer.symbolItems.add(sym);
    MCP.moveTo(inst, b.x, b.y);
    inst.name = item.name || sym.name;
    item.remove();
    result.instance = MCP.info(inst);
  }
  return result;
};

/*
 * Illustrator's scripting DOM cannot define new pattern swatches (Pattern Options is UI-only),
 * so this builds an editable tiled pattern: the tile is repeated across the area inside a
 * clipping group. The result is reported as kind "tiled-group", never as a pattern swatch.
 */
MCP.ops.create_pattern = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var tile = MCP.findOne(doc, a.tile);
  var tb = MCP.box(tile.geometricBounds);
  var stepX = tb.width + (a.gapX || 0), stepY = tb.height + (a.gapY || 0);
  if (stepX <= 0 || stepY <= 0) MCP.fail("VALIDATION_ERROR", "Tile has zero size.");
  var count = Math.ceil(a.width / stepX) * Math.ceil(a.height / stepY);
  if (count > 2500) MCP.fail("VALIDATION_ERROR", "Pattern would create " + count + " tiles (max 2500). Increase tile size or gap.");
  var layer = MCP.targetLayer(doc, a.layer);
  var g = layer.groupItems.add();
  for (var y = 0; y < a.height; y += stepY) {
    var row = Math.round(y / stepY);
    for (var x = 0; x < a.width; x += stepX) {
      var d = tile.duplicate(g, ElementPlacement.PLACEATEND);
      MCP.moveTo(d, a.x + x + (a.offsetRows && row % 2 ? stepX / 2 : 0), a.y + y);
    }
  }
  var clip = g.pathItems.add();
  clip.setEntirePath([[a.x, -a.y], [a.x + a.width, -a.y], [a.x + a.width, -(a.y + a.height)], [a.x, -(a.y + a.height)]]);
  clip.closed = true;
  clip.move(g, ElementPlacement.PLACEATBEGINNING);
  g.clipped = true;
  g.name = a.name || "Pattern";
  if (a.removeTile) tile.remove();
  var info = MCP.info(g);
  info.kind = "tiled-group";
  info.tiles = count;
  return info;
};
