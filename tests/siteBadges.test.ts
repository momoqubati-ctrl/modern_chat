import test from "node:test";
import assert from "node:assert/strict";
import { canManageSiteBadges, normalizePowerShape } from "../packages/shared/dist/index.js";

test("site badge management follows the member's assigned role permissions", () => {
  const powers = [
    normalizePowerShape({ name: "member" }),
    normalizePowerShape({ name: "moderator", edituser: 1 }),
    normalizePowerShape({ name: "appearance-manager", setpower: 1 }),
    normalizePowerShape({ name: "owner", owner: 1 }),
    normalizePowerShape({ name: "control-panel-only", cp: 1 }),
  ];

  assert.equal(canManageSiteBadges(powers[0]), false);
  assert.equal(canManageSiteBadges(powers[1]), true);
  assert.equal(canManageSiteBadges(powers[2]), true);
  assert.equal(canManageSiteBadges(powers[3]), true);
  assert.equal(canManageSiteBadges(powers[4]), false);
});
