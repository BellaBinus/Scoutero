import { Router, type IRouter } from "express";
import { db, keywordsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { CreateKeywordBody, DeleteKeywordParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/clerkAuth";

const router: IRouter = Router();

router.get("/keywords", requireAuth, async (req, res) => {
  try {
    const keywords = await db
      .select()
      .from(keywordsTable)
      .where(eq(keywordsTable.userId, req.userId))
      .orderBy(keywordsTable.createdAt);
    res.json(keywords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch keywords" });
  }
});

router.post("/keywords", requireAuth, async (req, res) => {
  try {
    const body = CreateKeywordBody.parse(req.body);
    const [keyword] = await db
      .insert(keywordsTable)
      .values({ userId: req.userId, term: body.term, type: body.type ?? "include" })
      .returning();
    res.status(201).json(keyword);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/keywords/:id", requireAuth, async (req, res) => {
  try {
    const { id } = DeleteKeywordParams.parse({ id: Number(req.params.id) });
    await db
      .delete(keywordsTable)
      .where(and(eq(keywordsTable.id, id), eq(keywordsTable.userId, req.userId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
