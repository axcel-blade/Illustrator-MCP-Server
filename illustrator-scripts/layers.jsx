/* Layer operations. Requires bootstrap.jsx. */

MCP.layerInfo = function (l, i) {
  return { index: i, name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity,
    itemCount: l.pageItems.length, sublayerCount: l.layers.length, active: app.activeDocument.activeLayer === l };
};

MCP.ops.inspect_layers = function () {
  var doc = MCP.doc();
  var out = [];
  for (var i = 0; i < doc.layers.length; i++) out.push(MCP.layerInfo(doc.layers[i], i));
  return { layers: out };
};

MCP.ops.create_layer = function (a) {
  var doc = MCP.doc();
  for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name === a.name) MCP.fail("VALIDATION_ERROR", "Layer already exists: " + a.name);
  }
  var l = doc.layers.add();
  l.name = a.name;
  if (a.position === "bottom") l.zOrder(ZOrderMethod.SENDTOBACK);
  if (a.color) { var c = MCP.hexToRgb(a.color.hex); var rc = new RGBColor(); rc.red = c.r; rc.green = c.g; rc.blue = c.b; l.color = rc; }
  return MCP.ops.inspect_layers();
};

MCP.ops.delete_layer = function (a) {
  var doc = MCP.doc();
  if (doc.layers.length === 1) MCP.fail("VALIDATION_ERROR", "Cannot delete the only layer.");
  var l = MCP.findLayer(doc, a.name, false);
  var n = l.pageItems.length;
  l.locked = false;
  l.remove();
  return { deleted: a.name, itemsRemoved: n, layers: MCP.ops.inspect_layers().layers };
};

MCP.ops.update_layer = function (a) {
  var doc = MCP.doc();
  var l = MCP.findLayer(doc, a.name, false);
  if (a.rename) l.name = a.rename;
  if (a.locked !== undefined) l.locked = a.locked;
  if (a.visible !== undefined) l.visible = a.visible;
  if (a.opacity !== undefined) l.opacity = a.opacity;
  if (a.activate) doc.activeLayer = l;
  return MCP.ops.inspect_layers();
};

MCP.ops.move_object_to_layer = function (a) {
  var doc = MCP.doc();
  var items = MCP.find(doc, a.target);
  var l = MCP.findLayer(doc, a.layer, !!a.create);
  if (l.locked) MCP.fail("VALIDATION_ERROR", "Destination layer is locked: " + a.layer);
  for (var i = 0; i < items.length; i++) items[i].move(l, ElementPlacement.PLACEATBEGINNING);
  var out = [];
  for (var j = 0; j < items.length; j++) out.push(MCP.info(items[j]));
  return { items: out };
};

/* order: layer names top-to-bottom. Layers not listed keep their relative order below. */
MCP.ops.reorder_layers = function (a) {
  var doc = MCP.doc();
  for (var i = a.order.length - 1; i >= 0; i--) MCP.findLayer(doc, a.order[i], false).zOrder(ZOrderMethod.BRINGTOFRONT);
  return MCP.ops.inspect_layers();
};
