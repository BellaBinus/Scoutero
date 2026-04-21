import { Router, type IRouter } from "express";
import { createClerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/clerkAuth";

const router: IRouter = Router();

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [existing] = await db
      .select({ isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId));

    if (existing) {
      res.json({ isAdmin: existing.isAdmin ?? false });
      return;
    }

    // User not in DB yet — look up their Clerk email and check if it
    // matches any existing admin so we can carry over admin status.
    let isAdmin = false;
    let email: string | undefined;
    try {
      const clerkUser = await clerkClient.users.getUser(req.userId);
      email = clerkUser.emailAddresses?.[0]?.emailAddress;
      if (email) {
        const [adminMatch] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, email));
        if (adminMatch) {
          isAdmin = true;
          console.log(`[me] Migrated admin status for ${email} → Clerk ID ${req.userId}`);
        }
      }
    } catch (err) {
      console.warn("[me] Could not resolve Clerk email for user migration:", err);
    }

    // Upsert this user into the DB so future requests are fast.
    // If the email already exists in the DB (old Replit Auth record), don't
    // store the email on the new row to avoid a unique constraint conflict.
    await db
      .insert(usersTable)
      .values({ id: req.userId, email: isAdmin ? undefined : email, isAdmin, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing();

    res.json({ isAdmin });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
