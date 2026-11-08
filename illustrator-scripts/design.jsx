/*
 * Design-plan execution. Receives a compiled plan from the Node design engine (all values in points,
 * colors resolved, fonts as candidate lists) and builds editable artwork in one transaction.
 */

MCP.buildElement = function (doc, el) {
  var a = el;
  a.layer = el.layer;
  var info;
  switch (el.type) {
    case "rect": info = MCP.ops.draw_rectangle(a); break;
    case "ellipse": info = MCP.ops.draw_ellipse(a); break;
    case "polygon": info = MCP.ops.draw_polygon(a); break;
    case "star": info = MCP.ops.draw_star(a); break;
    case "line": info = MCP.ops.draw_line(a); break;
    case "path": info = MCP.ops.draw_pen_path(a); break;
    case "text": info = MCP.ops.add_text(a); break;
    case "image": info = MCP.ops.place_image(a); break;
    default: MCP.fail("UNSUPPORTED_OPERATION", "Unknown element type " + el.type);
  }
  return info;
};

MCP.ops.execute_plan = function (a) {
  var doc;
  if (a.newDocument) doc = app.documents.add(a.colorMode === "CMYK" ? DocumentColorSpace.CMYK : DocumentColorSpace.RGB, a.width, a.height);
  else doc = MCP.doc();
  MCP.useArtboard(doc, 0);
  if (!a.newDocument) {
    var r = doc.artboards[0].artboardRect;
    if (Math.abs((r[2] - r[0]) - a.width) > 0.5 || Math.abs((r[1] - r[3]) - a.height) > 0.5) {
      doc.artboards[0].artboardRect = [r[0], r[1], r[0] + a.width, r[1] - a.height];
    }
  }
  if (a.artboardName) doc.artboards[0].name = a.artboardName;

  /* Layers in plan order are top-to-bottom; the default "Layer 1" is reused for the first. */
  var created = [];
  for (var i = a.layers.length - 1; i >= 0; i--) {
    var existing = null;
    for (var j = 0; j < doc.layers.length; j++) if (doc.layers[j].name === a.layers[i]) existing = doc.layers[j];
    if (!existing) {
      if (a.newDocument && doc.layers.length === 1 && doc.layers[0].pageItems.length === 0 && created.length === 0 && doc.layers[0].name === "Layer 1") {
        existing = doc.layers[0];
        existing.name = a.layers[i];
      } else {
        existing = doc.layers.add();
        existing.name = a.layers[i];
      }
    }
    existing.zOrder(ZOrderMethod.BRINGTOFRONT);
    created.push(existing.name);
  }

  /* Elements are given bottom-to-top (z-order ascending); each new item lands on top of its layer. */
  var built = [], failed = [];
  for (var e = 0; e < a.elements.length; e++) {
    try {
      built.push(MCP.buildElement(doc, a.elements[e]));
    } catch (err) {
      failed.push({ name: a.elements[e].name, code: err.mcpCode || "ILLUSTRATOR_SCRIPT_ERROR", message: String(err.message || err) });
      if (a.stopOnError) break;
    }
  }
  for (var s = 0; s < (a.swatches || []).length; s++) {
    try { var sw = doc.swatches.add(); sw.name = a.swatches[s].name; sw.color = MCP.color(a.swatches[s].color); } catch (e2) { MCP.warn("Swatch failed: " + a.swatches[s].name); }
  }
  for (var l = 0; l < (a.lockLayers || []).length; l++) {
    try { MCP.findLayer(doc, a.lockLayers[l], false).locked = true; } catch (e3) { /* ignore */ }
  }
  return { document: MCP.docInfo(doc), layers: created, built: built, failed: failed };
};

/* Targeted revisions: updates existing named items in place instead of rebuilding. */
MCP.ops.update_elements = function (a) {
  var doc = MCP.doc();
  MCP.useArtboard(doc, a.artboard);
  var results = [], failed = [];
  for (var i = 0; i < a.updates.length; i++) {
    var u = a.updates[i];
    try {
      var items = MCP.find(doc, { name: u.name, layer: u.layer });
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var wasLocked = it.locked;
        var itLayer = MCP.layerOf(it);
        var layerWasLocked = itLayer ? itLayer.locked : false;
        if (itLayer) itLayer.locked = false;
        it.locked = false;
        if (u.layerTo) it.move(MCP.findLayer(doc, u.layerTo, true), ElementPlacement.PLACEATBEGINNING);
        MCP.transformOne(it, { x: u.x, y: u.y, width: u.width, height: u.height, keepProportions: u.keepProportions === true, anchor: "topLeft", rotation: u.rotation });
        if (it.typename === "TextFrame") {
          if (u.content !== undefined) it.contents = u.content;
          MCP.styleText(it.textRange, { font: u.font, fontSize: u.fontSize, weight: u.weight, color: u.fill || u.color, tracking: u.tracking, leading: u.leading, align: u.align });
          MCP.style(it, { opacity: u.opacity, blendMode: u.blendMode, effects: u.effects, hidden: u.hidden });
        } else {
          MCP.style(it, { fill: u.fill, stroke: u.stroke, opacity: u.opacity, blendMode: u.blendMode, effects: u.effects, hidden: u.hidden });
        }
        if (u.rename) it.name = u.rename;
        if (u.zOrder) it.zOrder(ZOrderMethod[{ front: "BRINGTOFRONT", back: "SENDTOBACK", forward: "BRINGFORWARD", backward: "SENDBACKWARD" }[u.zOrder]]);
        if (u.remove) { it.remove(); results.push({ name: u.name, removed: true }); }
        else { it.locked = u.locked !== undefined ? u.locked : wasLocked; results.push(MCP.info(it)); }
        if (itLayer) itLayer.locked = layerWasLocked;
      }
    } catch (err) {
      failed.push({ name: u.name, code: err.mcpCode || "ILLUSTRATOR_SCRIPT_ERROR", message: String(err.message || err) });
    }
  }
  return { updated: results, failed: failed };
};
