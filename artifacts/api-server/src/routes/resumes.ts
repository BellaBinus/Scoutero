import { Router, type IRouter } from "express";
import { db, resumesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/clerkAuth";

const router: IRouter = Router();

function parseCreateBody(body: unknown): { name: string; content: string } | null {
  if (!body || typeof body !== "object") return null;
  const { name, content } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) return null;
  if (typeof content !== "string" || content.trim().length === 0) return null;
  return { name: name.trim(), content: content.trim() };
}

function parseUpdateBody(body: unknown): { name?: string; content?: string } | null {
  if (!body || typeof body !== "object") return null;
  const { name, content } = body as Record<string, unknown>;
  const result: { name?: string; content?: string } = {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) return null;
    result.name = name.trim();
  }
  if (content !== undefined) {
    if (typeof content !== "string" || content.trim().length === 0) return null;
    result.content = content.trim();
  }
  return result;
}

router.get("/resumes", requireAuth, async (req, res) => {
  try {
    const resumes = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.userId, req.userId))
      .orderBy(resumesTable.createdAt);
    res.json(resumes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

router.post("/resumes", requireAuth, async (req, res) => {
  try {
    const body = parseCreateBody(req.body);
    if (!body) { res.status(400).json({ error: "Invalid request" }); return; }
    const [resume] = await db
      .insert(resumesTable)
      .values({ userId: req.userId, name: body.name, content: body.content })
      .returning();
    res.status(201).json(resume);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/resumes/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = parseUpdateBody(req.body);
    if (!body) { res.status(400).json({ error: "Invalid request" }); return; }
    const [updated] = await db
      .update(resumesTable)
      .set({ ...(body.name !== undefined && { name: body.name }), ...(body.content !== undefined && { content: body.content }) })
      .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/resumes/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(resumesTable)
      .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.userId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete resume" });
  }
});

export default router;
