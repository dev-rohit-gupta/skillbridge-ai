import {and, asc, desc, eq} from "drizzle-orm";
import {Router} from "express";
import {
  jobDescriptionRequirements,
  jobDescriptions,
  skillAliases,
  skills,
} from "@skillbridge/database";
import {
  addJobRequirementInputSchema,
  createJobDescriptionInputSchema,
  updateJobRequirementInputSchema,
} from "@skillbridge/shared";
import {db} from "../config/database.js";
import {AppError} from "../lib/errors.js";
import {authenticate} from "../middleware/auth.js";
import {validateBody} from "../middleware/validate.js";
import {DeterministicAiProvider} from "./ai/provider.js";

const provider = new DeterministicAiProvider();
export const jobDescriptionRouter = Router();
jobDescriptionRouter.use(authenticate);

async function ownedJob(userId: string, jobDescriptionId: string) {
  const [job] = await db.select().from(jobDescriptions).where(and(
    eq(jobDescriptions.id, jobDescriptionId),
    eq(jobDescriptions.userId, userId),
  )).limit(1);
  if (!job) throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description not found.");
  return job;
}

jobDescriptionRouter.post("/", validateBody(createJobDescriptionInputSchema), async (req, res, next) => {
  try {
    const input = createJobDescriptionInputSchema.parse(req.body);
    const canonical = await db.select({id: skills.id, name: skills.name, slug: skills.slug})
      .from(skills).where(eq(skills.isActive, true));
    const aliases = await db.select({skillId: skillAliases.skillId, alias: skillAliases.alias}).from(skillAliases);
    const extracted = await provider.extractJobRequirements({
      title: input.title,
      description: input.description,
      skills: canonical.map((skill) => ({
        ...skill,
        aliases: aliases.filter((alias) => alias.skillId === skill.id).map((alias) => alias.alias),
      })),
    });

    const job = await db.transaction(async (tx) => {
      const [created] = await tx.insert(jobDescriptions).values({
        userId: req.auth!.userId,
        title: input.title,
        companyName: input.companyName ?? null,
        sourceUrl: input.sourceUrl ?? null,
        rawDescription: input.description,
        status: "READY",
        contentRevision: 1,
        confirmedRevision: 0,
      }).returning();
      if (!created) throw new Error("Job description creation failed");
      if (extracted.length) {
        await tx.insert(jobDescriptionRequirements).values(extracted.map((requirement, index) => ({
          jobDescriptionId: created.id,
          ...requirement,
          sortOrder: index,
        })));
      }
      return created;
    });
    res.status(201).json({success: true, data: {...job, detectedRequirementCount: extracted.length}});
  } catch (error) { next(error); }
});

jobDescriptionRouter.get("/", async (req, res, next) => {
  try {
    const data = await db.select().from(jobDescriptions)
      .where(eq(jobDescriptions.userId, req.auth!.userId))
      .orderBy(desc(jobDescriptions.createdAt));
    res.json({success: true, data});
  } catch (error) { next(error); }
});

jobDescriptionRouter.get("/:jobDescriptionId", async (req, res, next) => {
  try {
    const job = await ownedJob(req.auth!.userId, req.params.jobDescriptionId as string);
    const requirements = await db.select({
      id: jobDescriptionRequirements.id,
      skillId: jobDescriptionRequirements.skillId,
      skillName: skills.name,
      category: skills.category,
      originalText: jobDescriptionRequirements.originalText,
      importance: jobDescriptionRequirements.importance,
      weight: jobDescriptionRequirements.weight,
      confidenceBp: jobDescriptionRequirements.confidenceBp,
      sortOrder: jobDescriptionRequirements.sortOrder,
    }).from(jobDescriptionRequirements)
      .innerJoin(skills, eq(skills.id, jobDescriptionRequirements.skillId))
      .where(eq(jobDescriptionRequirements.jobDescriptionId, job.id))
      .orderBy(asc(jobDescriptionRequirements.sortOrder));
    res.json({success: true, data: {...job, requirements, provider: provider.name}});
  } catch (error) { next(error); }
});

jobDescriptionRouter.post("/:jobDescriptionId/requirements", validateBody(addJobRequirementInputSchema), async (req, res, next) => {
  try {
    const job = await ownedJob(req.auth!.userId, req.params.jobDescriptionId as string);
    const input = addJobRequirementInputSchema.parse(req.body);
    const [skill] = await db.select().from(skills).where(and(eq(skills.id, input.skillId), eq(skills.isActive, true))).limit(1);
    if (!skill) throw new AppError(404, "SKILL_NOT_FOUND", "Skill not found.");
    const [requirement] = await db.insert(jobDescriptionRequirements).values({
      jobDescriptionId: job.id,
      skillId: input.skillId,
      originalText: input.originalText ?? `Manually added requirement: ${skill.name}`,
      importance: input.importance,
      weight: input.weight,
      confidenceBp: 10000,
      sortOrder: job.contentRevision + 100,
    }).onConflictDoNothing().returning();
    await db.update(jobDescriptions).set({contentRevision: job.contentRevision + 1, updatedAt: new Date()})
      .where(eq(jobDescriptions.id, job.id));
    res.status(201).json({success: true, data: requirement ?? null});
  } catch (error) { next(error); }
});

jobDescriptionRouter.patch("/:jobDescriptionId/requirements/:requirementId", validateBody(updateJobRequirementInputSchema), async (req, res, next) => {
  try {
    const job = await ownedJob(req.auth!.userId, req.params.jobDescriptionId as string);
    const input = updateJobRequirementInputSchema.parse(req.body);
    const [updated] = await db.update(jobDescriptionRequirements).set({...input, updatedAt: new Date()})
      .where(and(
        eq(jobDescriptionRequirements.id, req.params.requirementId as string),
        eq(jobDescriptionRequirements.jobDescriptionId, job.id),
      )).returning();
    if (!updated) throw new AppError(404, "JOB_REQUIREMENT_NOT_FOUND", "Requirement not found.");
    await db.update(jobDescriptions).set({contentRevision: job.contentRevision + 1, updatedAt: new Date()})
      .where(eq(jobDescriptions.id, job.id));
    res.json({success: true, data: updated});
  } catch (error) { next(error); }
});

jobDescriptionRouter.delete("/:jobDescriptionId/requirements/:requirementId", async (req, res, next) => {
  try {
    const job = await ownedJob(req.auth!.userId, req.params.jobDescriptionId as string);
    const [deleted] = await db.delete(jobDescriptionRequirements).where(and(
      eq(jobDescriptionRequirements.id, req.params.requirementId as string),
      eq(jobDescriptionRequirements.jobDescriptionId, job.id),
    )).returning();
    if (!deleted) throw new AppError(404, "JOB_REQUIREMENT_NOT_FOUND", "Requirement not found.");
    await db.update(jobDescriptions).set({contentRevision: job.contentRevision + 1, updatedAt: new Date()})
      .where(eq(jobDescriptions.id, job.id));
    res.json({success: true, data: {deleted: true}});
  } catch (error) { next(error); }
});

jobDescriptionRouter.post("/:jobDescriptionId/confirm", async (req, res, next) => {
  try {
    const job = await ownedJob(req.auth!.userId, req.params.jobDescriptionId as string);
    const requirements = await db.select().from(jobDescriptionRequirements)
      .where(eq(jobDescriptionRequirements.jobDescriptionId, job.id));
    if (requirements.length < 3 || !requirements.some((requirement) => requirement.importance !== "OPTIONAL")) {
      throw new AppError(409, "JOB_REQUIREMENTS_INCOMPLETE", "Keep at least three requirements, including one required skill.");
    }
    const [updated] = await db.update(jobDescriptions).set({
      confirmedRevision: job.contentRevision,
      updatedAt: new Date(),
    }).where(eq(jobDescriptions.id, job.id)).returning();
    res.json({success: true, data: updated});
  } catch (error) { next(error); }
});
