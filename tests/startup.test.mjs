import test from "node:test";
import assert from "node:assert/strict";
import { hostPort, lanAddresses, existingHost } from "../server/startup.mjs";

test("startup keeps a stable valid port and rejects ambiguous or invalid values", () => {
  assert.equal(hostPort("4173"), 4173);
  assert.equal(hostPort(65535), 65535);
  assert.equal(hostPort("0", true), 0);
  for (const value of ["0", "", " ", "-1", "1.5", "65536", "NaN", "4173 & other command"]) assert.throws(() => hostPort(value), /port/);
});
test("player invite addresses include only deduplicated private IPv4 interfaces", () => {
  const address = (address, internal = false, family = "IPv4") => ({ address, internal, family });
  assert.deepEqual(lanAddresses({ wifi: [address("192.168.1.2"), address("192.168.1.2"), address("127.0.0.1", true)], other: [address("172.20.0.2"), address("10.1.1.2"), address("172.40.0.2"), address("8.8.8.8"), address("::1", false, "IPv6")] }), ["192.168.1.2", "172.20.0.2", "10.1.1.2"]);
});
test("launcher reuses a real existing TaleForge host and does not treat other services as TaleForge", async () => {
  const reply = (data, ok = true) => async () => ({ ok, json: async () => data });
  assert.equal(await existingHost(4173, reply({ ok: true, service: "taleforge-lan" })), true);
  assert.equal(await existingHost(4173, reply({ ok: true, service: "another-app" })), false);
  assert.equal(await existingHost(4173, reply({ ok: true, service: "taleforge-lan" }, false)), false);
  assert.equal(await existingHost(4173, async () => { throw new Error("Connection refused"); }), false);
  assert.equal(await existingHost(0, async () => assert.fail("Do not probe port zero")), false);
});
