const assert = require("node:assert/strict");
const { initialUpdateState, reduceUpdateState } = require("./update-state.cjs");

let state = initialUpdateState("1.0.0");
state = reduceUpdateState(state, { type: "checking" });
assert.equal(state.state, "checking");
state = reduceUpdateState(state, {
  type: "available",
  version: "1.1.0",
  releaseNotes: "Safer export",
});
assert.equal(state.availableVersion, "1.1.0");
state = reduceUpdateState(state, { type: "download-started" });
state = reduceUpdateState(state, { type: "progress", percent: 42.6 });
assert.deepEqual([state.state, state.percent], ["downloading", 43]);
state = reduceUpdateState(state, { type: "downloaded" });
assert.deepEqual([state.state, state.percent], ["downloaded", 100]);
state = reduceUpdateState(state, { type: "error", message: "network" });
assert.deepEqual([state.state, state.message], ["error", "network"]);
const invalid = reduceUpdateState(initialUpdateState("1.0.0"), {
  type: "progress",
  percent: 50,
});
assert.equal(invalid.state, "idle");
console.log("UPDATE STATE: transitions pass");
