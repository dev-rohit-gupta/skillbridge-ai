import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import {
  analyses,
  careerRoles,
  jobDescriptionRequirements,
  jobDescriptions,
  resumeSkills,
  resumes,
  roadmapItems,
  roadmaps,
  roleRequirements,
  roleRequirementSkills,
  skillRelations,
  skills,
  userProfiles,
} from "@skillbridge/database";
import {
  createAnalysisInputSchema,
  updateRoadmapItemStatusInputSchema,
} from "@skillbridge/shared";
import { db } from "../config/database.js";
import { AppError } from "../lib/errors.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { scoreAnalysis, type ScoringRequirement } from "./scoring.js";

async function roleTarget(roleId: string) {
  const [role] = await db
    .select()
    .from(careerRoles)
    .where(and(eq(careerRoles.id, roleId), eq(careerRoles.isActive, true)))
    .limit(1);
  if (!role)
    throw new AppError(404, "CAREER_ROLE_NOT_FOUND", "Career role not found.");

  const rows = await db
    .select({
      id: roleRequirements.id,
      name: roleRequirements.name,
      importance: roleRequirements.importance,
      weight: roleRequirements.weight,
      skillId: roleRequirementSkills.skillId,
    })
    .from(roleRequirements)
    .leftJoin(
      roleRequirementSkills,
      eq(roleRequirementSkills.roleRequirementId, roleRequirements.id),
    )
    .where(
      and(
        eq(roleRequirements.careerRoleId, role.id),
        eq(roleRequirements.isActive, true),
      ),
    )
    .orderBy(asc(roleRequirements.sortOrder));

  const requirements = Object.values(
    rows.reduce<Record<string, ScoringRequirement>>((accumulator, row) => {
      accumulator[row.id] ??= {
        id: row.id,
        name: row.name,
        importance: row.importance,
        weight: row.weight,
        acceptedSkillIds: [],
      };
      if (row.skillId) accumulator[row.id]!.acceptedSkillIds.push(row.skillId);
      return accumulator;
    }, {}),
  );

  return {
    target: {
      type: "PREDEFINED_ROLE" as const,
      id: role.id,
      name: role.name,
      version: role.version,
    },
    requirements,
    careerRoleId: role.id,
    jobDescriptionId: null,
  };
}

async function customJobTarget(userId: string, jobDescriptionId: string) {
  const [job] = await db
    .select()
    .from(jobDescriptions)
    .where(
      and(
        eq(jobDescriptions.id, jobDescriptionId),
        eq(jobDescriptions.userId, userId),
      ),
    )
    .limit(1);
  if (!job)
    throw new AppError(
      404,
      "JOB_DESCRIPTION_NOT_FOUND",
      "Job description not found.",
    );
  if (job.status !== "READY" || job.contentRevision !== job.confirmedRevision) {
    throw new AppError(
      409,
      "JOB_REQUIREMENTS_NOT_CONFIRMED",
      "Review and confirm the job requirements first.",
    );
  }

  const rows = await db
    .select({
      id: jobDescriptionRequirements.id,
      name: skills.name,
      importance: jobDescriptionRequirements.importance,
      weight: jobDescriptionRequirements.weight,
      skillId: jobDescriptionRequirements.skillId,
    })
    .from(jobDescriptionRequirements)
    .innerJoin(skills, eq(skills.id, jobDescriptionRequirements.skillId))
    .where(eq(jobDescriptionRequirements.jobDescriptionId, job.id))
    .orderBy(asc(jobDescriptionRequirements.sortOrder));

  const requirements: ScoringRequirement[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    importance: row.importance,
    weight: row.weight,
    acceptedSkillIds: [row.skillId],
  }));
  if (requirements.length < 3)
    throw new AppError(
      409,
      "ANALYSIS_TARGET_INVALID",
      "The job description needs at least three requirements.",
    );

  return {
    target: {
      type: "CUSTOM_JOB" as const,
      id: job.id,
      name: job.title,
      companyName: job.companyName,
    },
    requirements,
    careerRoleId: null,
    jobDescriptionId: job.id,
  };
}

export const analysisRouter = Router();
analysisRouter.use(authenticate);

analysisRouter.post(
  "/",
  validateBody(createAnalysisInputSchema),
  async (req, res, next) => {
    try {
      const input = createAnalysisInputSchema.parse(req.body);
      const [resume] = await db
        .select()
        .from(resumes)
        .where(
          and(
            eq(resumes.id, input.resumeId),
            eq(resumes.userId, req.auth!.userId),
          ),
        )
        .limit(1);
      if (!resume)
        throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");
      if (
        resume.status !== "PROCESSED" ||
        resume.contentRevision !== resume.confirmedRevision
      ) {
        throw new AppError(
          409,
          "RESUME_NOT_CONFIRMED",
          "Review and confirm the resume before analysis.",
        );
      }

      const selected =
        input.type === "PREDEFINED_ROLE"
          ? await roleTarget(input.careerRoleId)
          : await customJobTarget(req.auth!.userId, input.jobDescriptionId);
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, req.auth!.userId))
        .limit(1);

      const [analysis] = await db
        .insert(analyses)
        .values({
          userId: req.auth!.userId,
          resumeId: resume.id,
          analysisType: input.type,
          careerRoleId: selected.careerRoleId,
          jobDescriptionId: selected.jobDescriptionId,
          status: "PROCESSING",
          startedAt: new Date(),
        })
        .returning();
      if (!analysis) throw new Error("Analysis creation failed");

      try {
        const candidateSkills = await db
          .select({
            skillId: resumeSkills.skillId,
            evidenceFactorBp: resumeSkills.evidenceFactorBp,
            evidenceSource: resumeSkills.evidenceSource,
          })
          .from(resumeSkills)
          .where(
            and(
              eq(resumeSkills.resumeId, resume.id),
              eq(resumeSkills.isRemoved, false),
            ),
          );
        const relations = await db.select().from(skillRelations);
        const scored = scoreAnalysis({
          requirements: selected.requirements,
          candidateSkills,
          relations,
          experienceLevel: profile?.experienceLevel ?? "STUDENT",
        });

        const skillIds = [
          ...new Set(
            scored.requirements.flatMap((item) => [
              ...item.acceptedSkillIds,
              ...(item.matchedSkillId ? [item.matchedSkillId] : []),
            ]),
          ),
        ];
        const skillRows = skillIds.length
          ? await db.select({ id: skills.id, name: skills.name }).from(skills)
          : [];
        const skillMap = new Map(
          skillRows.map((skill) => [skill.id, skill.name]),
        );
        const result = {
          ...scored,
          target: selected.target,
          resume: { id: resume.id, displayName: resume.displayName },
          requirements: scored.requirements.map((item) => ({
            ...item,
            acceptedSkills: item.acceptedSkillIds.map((id) => ({
              id,
              name: skillMap.get(id) ?? "Unknown",
            })),
            matchedSkill: item.matchedSkillId
              ? {
                  id: item.matchedSkillId,
                  name: skillMap.get(item.matchedSkillId) ?? "Unknown",
                }
              : null,
          })),
        };
        await db
          .update(analyses)
          .set({
            status: "COMPLETED",
            overallScoreBp: scored.overallScoreBp,
            matchLevel: scored.matchLevel,
            result,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));
        res
          .status(201)
          .json({ success: true, data: { id: analysis.id, ...result } });
      } catch (processingError) {
        await db
          .update(analyses)
          .set({
            status: "FAILED",
            failureReason:
              processingError instanceof Error
                ? processingError.message
                : "Analysis failed.",
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));
        throw processingError;
      }
    } catch (error) {
      next(error);
    }
  },
);

analysisRouter.get("/", async (req, res, next) => {
  try {
    const targetName =
      sql<string>`coalesce(${careerRoles.name}, ${jobDescriptions.title})`.as(
        "target_name",
      );
    const data = await db
      .select({
        id: analyses.id,
        analysisType: analyses.analysisType,
        status: analyses.status,
        overallScoreBp: analyses.overallScoreBp,
        matchLevel: analyses.matchLevel,
        createdAt: analyses.createdAt,
        targetName,
        resumeName: resumes.displayName,
      })
      .from(analyses)
      .innerJoin(resumes, eq(resumes.id, analyses.resumeId))
      .leftJoin(careerRoles, eq(careerRoles.id, analyses.careerRoleId))
      .leftJoin(
        jobDescriptions,
        eq(jobDescriptions.id, analyses.jobDescriptionId),
      )
      .where(eq(analyses.userId, req.auth!.userId))
      .orderBy(desc(analyses.createdAt));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

analysisRouter.get("/:analysisId", async (req, res, next) => {
  try {
    const [data] = await db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.id, req.params.analysisId as string),
          eq(analyses.userId, req.auth!.userId),
        ),
      )
      .limit(1);
    if (!data)
      throw new AppError(404, "ANALYSIS_NOT_FOUND", "Analysis not found.");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export const roadmapRouter = Router();
roadmapRouter.use(authenticate);

roadmapRouter.post("/analyses/:analysisId/roadmap", async (req, res, next) => {
  try {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.id, req.params.analysisId as string),
          eq(analyses.userId, req.auth!.userId),
        ),
      )
      .limit(1);
    if (!analysis || analysis.status !== "COMPLETED" || !analysis.result) {
      throw new AppError(
        409,
        "ANALYSIS_NOT_READY",
        "Complete the analysis first.",
      );
    }
    const [existing] = await db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.analysisId, analysis.id))
      .limit(1);
    if (existing) return res.json({ success: true, data: existing });

    const result = analysis.result as {
      target?: { name?: string };
      requirements?: Array<{
        name: string;
        importance: string;
        effectiveBp: number;
        acceptedSkills?: Array<{ id: string; name: string }>;
      }>;
    };
    const missing = (result.requirements ?? [])
      .filter((item) => item.effectiveBp < 8000)
      .slice(0, 8);
    const roadmap = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(roadmaps)
        .values({
          userId: req.auth!.userId,
          analysisId: analysis.id,
          title: `${result.target?.name ?? "Career"} Learning Roadmap`,
        })
        .returning();
      if (!created) throw new Error("Roadmap creation failed");
      if (missing.length) {
        await tx.insert(roadmapItems).values(
          missing.map((item, index) => ({
            roadmapId: created.id,
            skillId: item.acceptedSkills?.[0]?.id ?? null,
            phase: index < 2 ? 1 : index < 5 ? 2 : index < 7 ? 3 : 4,
            title: `Improve ${item.name}`,
            description: `Learn ${item.name}, practise it in a focused exercise, and demonstrate it in a portfolio project.`,
            priority: (item.importance === "CORE"
              ? "LEARN_FIRST"
              : item.importance === "IMPORTANT"
                ? "HIGH"
                : "OPTIONAL") as "LEARN_FIRST" | "HIGH" | "OPTIONAL",
            estimatedHours: item.importance === "CORE" ? 12 : 8,
            sortOrder: index,
          })),
        );
      }
      return created;
    });
    res.status(201).json({ success: true, data: roadmap });
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get("/roadmaps", async (req, res, next) => {
  try {
    const data = await db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.userId, req.auth!.userId))
      .orderBy(desc(roadmaps.createdAt));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get("/roadmaps/:roadmapId", async (req, res, next) => {
  try {
    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(
        and(
          eq(roadmaps.id, req.params.roadmapId as string),
          eq(roadmaps.userId, req.auth!.userId),
        ),
      )
      .limit(1);
    if (!roadmap)
      throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap not found.");
    const items = await db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.roadmapId, roadmap.id))
      .orderBy(asc(roadmapItems.sortOrder));
    const completed = items.filter(
      (item) => item.status === "COMPLETED",
    ).length;
    res.json({
      success: true,
      data: {
        ...roadmap,
        items,
        completionPercentage: items.length
          ? Math.round((completed / items.length) * 100)
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

roadmapRouter.get("/analyses/:analysisId/roadmap", async (req, res, next) => {
  try {
    const [data] = await db
      .select()
      .from(roadmaps)
      .where(
        and(
          eq(roadmaps.analysisId, req.params.analysisId as string),
          eq(roadmaps.userId, req.auth!.userId),
        ),
      )
      .limit(1);
    res.json({ success: true, data: data ?? null });
  } catch (error) {
    next(error);
  }
});

roadmapRouter.patch(
  "/roadmaps/:roadmapId/items/:itemId/status",
  validateBody(updateRoadmapItemStatusInputSchema),
  async (req, res, next) => {
    try {
      const [roadmap] = await db
        .select()
        .from(roadmaps)
        .where(
          and(
            eq(roadmaps.id, req.params.roadmapId as string),
            eq(roadmaps.userId, req.auth!.userId),
          ),
        )
        .limit(1);
      if (!roadmap)
        throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap not found.");
      const input = updateRoadmapItemStatusInputSchema.parse(req.body);
      const [data] = await db
        .update(roadmapItems)
        .set({
          status: input.status,
          completedAt: input.status === "COMPLETED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(roadmapItems.id, req.params.itemId as string),
            eq(roadmapItems.roadmapId, roadmap.id),
          ),
        )
        .returning();
      if (!data)
        throw new AppError(
          404,
          "ROADMAP_ITEM_NOT_FOUND",
          "Roadmap item not found.",
        );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
