import { Router, type IRouter } from "express";
import { db, settingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/clerkAuth";

function parseFrequency(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

const router: IRouter = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (rows.length > 0) return rows[0];
  const [created] = await db
    .insert(settingsTable)
    .values({ id: 1, defaultMinKeywordFrequency: 2 })
    .onConflictDoNothing()
    .returning();
  return created ?? { id: 1, defaultMinKeywordFrequency: 2 };
}

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ defaultMinKeywordFrequency: settings.defaultMinKeywordFrequency });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", requireAuth, requireAdmin, async (req, res) => {
  const freq = parseFrequency(req.body?.defaultMinKeywordFrequency);
  if (freq === null) {
    res.status(400).json({ error: "Invalid value (must be 1–10)" });
    return;
  }
  try {
    await db
      .insert(settingsTable)
      .values({ id: 1, defaultMinKeywordFrequency: freq })
      .onConflictDoUpdate({
        target: settingsTable.id,
        set: { defaultMinKeywordFrequency: freq },
      });
    res.json({ defaultMinKeywordFrequency: freq });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.patch("/user/settings", requireAuth, async (req, res) => {
  const rawVal = req.body?.minKeywordFrequency;
  let userFreq: number | null;
  if (rawVal === null || rawVal === undefined) {
    userFreq = null;
  } else {
    userFreq = parseFrequency(rawVal);
    if (userFreq === null) {
      res.status(400).json({ error: "Invalid value (must be 1–10 or null to reset)" });
      return;
    }
  }
  try {
    await db
      .update(usersTable)
      .set({ minKeywordFrequency: userFreq, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId));
    res.json({ minKeywordFrequency: userFreq });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

router.get("/user/settings", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({ minKeywordFrequency: usersTable.minKeywordFrequency })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId));
    res.json({ minKeywordFrequency: user?.minKeywordFrequency ?? null });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

export default router;
