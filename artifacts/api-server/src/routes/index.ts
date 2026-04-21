import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import companiesRouter from "./companies";
import searchesRouter from "./searches";
import keywordsRouter from "./keywords";
import resumesRouter from "./resumes";
import settingsRouter from "./settings";
import opsRouter from "./ops";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(companiesRouter);
router.use(searchesRouter);
router.use(keywordsRouter);
router.use(resumesRouter);
router.use(settingsRouter);
router.use(opsRouter);

export default router;
