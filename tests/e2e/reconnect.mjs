/**
 * Phase 6 lifecycle checks. Run ONLY with Illustrator closed:
 *  1. auto-launch disabled -> meaningful ILLUSTRATOR_NOT_RUNNING error, server stays up
 *  2. auto-launch enabled  -> the same server process relaunches Illustrator and works again
 */
import { connect } from "./lib.mjs";

const res = [];
const rec = (name, status, detail) => { res.push({ name, status, detail }); console.log(status.padEnd(5), name, status !== "PASS" ? JSON.stringify(detail).slice(0, 400) : ""); };

{
  const { client, call } = await connect({ ILLUSTRATOR_AUTO_LAUNCH: "false" });
  const st = (await call("illustrator_status", { probe: true })).body;
  rec("status reports not running (no fake success)", st.data?.detection?.running === false && !st.data?.application ? "PASS" : "FAIL", st.data ?? st);
  const r = await call("create_document", { width: 100, height: 100 });
  rec("tool call while not running -> ILLUSTRATOR_NOT_RUNNING", r.isError && /NOT_RUNNING|not running/i.test(JSON.stringify(r.body)) ? "PASS" : "FAIL", r.body);
  const alive = await call("list_templates", {});
  rec("server still serves requests", alive.body.ok ? "PASS" : "FAIL", alive.body);
  await client.close();
}
{
  const { client, call } = await connect({ ILLUSTRATOR_AUTO_LAUNCH: "true", ILLUSTRATOR_TIMEOUT_MS: "240000" });
  const t = Date.now();
  const st = (await call("illustrator_status", { probe: true })).body;
  rec(`auto-launch + reconnect (${Math.round((Date.now() - t) / 1000)} s)`, st.data?.application?.version ? "PASS" : "FAIL", st.data ?? st);
  const r = await call("create_document", { name: "Reconnect", width: 100, height: 100 });
  rec("real operation after relaunch", r.body.ok && r.body.source === "illustrator" ? "PASS" : "FAIL", r.body);
  await call("close_document", { save: false, confirm: true });
  await client.close();
}
console.log(JSON.stringify(res));
