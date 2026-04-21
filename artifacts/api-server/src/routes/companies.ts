import { Router, type IRouter } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateCompanyBody, DeleteCompanyParams, UpdateCompanyBody, UpdateCompanyParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/clerkAuth";

const router: IRouter = Router();

router.get("/companies", requireAuth, async (req, res) => {
  try {
    const companies = await db.select().from(companiesTable).orderBy(asc(companiesTable.name));
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

router.post("/companies", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = CreateCompanyBody.parse(req.body);
    const [company] = await db
      .insert(companiesTable)
      .values({ name: body.name, careersUrl: body.careersUrl ?? null })
      .returning();
    res.status(201).json(company);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/companies/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = UpdateCompanyParams.parse({ id: Number(req.params.id) });
    const body = UpdateCompanyBody.parse(req.body);
    const [company] = await db
      .update(companiesTable)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.careersUrl !== undefined && { careersUrl: body.careersUrl ?? null }),
      })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/companies/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = DeleteCompanyParams.parse({ id: Number(req.params.id) });
    await db.delete(companiesTable).where(eq(companiesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
