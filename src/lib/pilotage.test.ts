import { describe, expect, test } from "bun:test";
import { periodBounds, presenceRate } from "./pilotage";

describe("Centre de pilotage: périodes et présence", () => {
  const now = new Date(2026,9,9,12);
  test("périodes inclusives et comparaison sans chevauchement", () => {
    expect(periodBounds("today",now)).toMatchObject({start:"2026-10-09",end:"2026-10-09",previousEnd:"2026-10-08"});
    expect(periodBounds("7d",now)).toMatchObject({start:"2026-10-03",previousStart:"2026-09-26",previousEnd:"2026-10-02"});
    expect(periodBounds("30d",now).start).toBe("2026-09-10");
    expect(periodBounds("3m",now).start).toBe("2026-07-09");
    expect(periodBounds("year",now).start).toBe("2026-01-01");
  });
  test("absence de pointages ≠ taux zéro", () => {
    expect(presenceRate([]).rate).toBeNull();
    expect(presenceRate([{statut:"absent"}]).rate).toBe(0);
    expect(presenceRate([{statut:"present"},{statut:"absent"},{statut:"excuse"}]).rate).toBe(50);
  });
});