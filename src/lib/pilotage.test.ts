import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { periodBounds, presenceRate } from "./pilotage";

describe("Centre de pilotage: périodes et présence", () => {
  const now = new Date(2026,9,9,12);
  test("périodes inclusives et comparaison sans chevauchement", () => {
    assert.equal(periodBounds("today",now).start,"2026-10-09");
    assert.equal(periodBounds("today",now).previousEnd,"2026-10-08");
    assert.equal(periodBounds("7d",now).start,"2026-10-03");
    assert.equal(periodBounds("7d",now).previousStart,"2026-09-26");
    assert.equal(periodBounds("7d",now).previousEnd,"2026-10-02");
    assert.equal(periodBounds("30d",now).start,"2026-09-10");
    assert.equal(periodBounds("3m",now).start,"2026-07-09");
    assert.equal(periodBounds("year",now).start,"2026-01-01");
  });
  test("absence de pointages ≠ taux zéro", () => {
    assert.equal(presenceRate([]).rate,null);
    assert.equal(presenceRate([{statut:"absent"}]).rate,0);
    assert.equal(presenceRate([{statut:"present"},{statut:"absent"},{statut:"excuse"}]).rate,50);
  });
});