import {and, desc, eq, isNull, sql} from "drizzle-orm";
import {Router} from "express";
import {analyses, careerRoles, jobDescriptions, resumes, roadmaps, userProfiles} from "@skillbridge/database";
import {db} from "../config/database.js";
import {authenticate} from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const [profile] = await db.select({
      experienceLevel: userProfiles.experienceLevel,
      collegeName: userProfiles.collegeName,
      primaryRoleId: userProfiles.primaryRoleId,
      primaryRoleName: careerRoles.name,
    }).from(userProfiles)
      .leftJoin(careerRoles, eq(careerRoles.id, userProfiles.primaryRoleId))
      .where(eq(userProfiles.userId, req.auth!.userId))
      .limit(1);

    const [activeResume] = await db.select({
      id: resumes.id,
      displayName: resumes.displayName,
      status: resumes.status,
      contentRevision: resumes.contentRevision,
      confirmedRevision: resumes.confirmedRevision,
    }).from(resumes).where(and(
      eq(resumes.userId, req.auth!.userId),
      eq(resumes.isActive, true),
      isNull(resumes.deletedAt),
    )).limit(1);

    const targetName = sql<string>`coalesce(${careerRoles.name}, ${jobDescriptions.title})`.as("target_name");
    const recentAnalyses = await db.select({
      id: analyses.id,
      analysisType: analyses.analysisType,
      overallScoreBp: analyses.overallScoreBp,
      matchLevel: analyses.matchLevel,
      createdAt: analyses.createdAt,
      targetName,
    }).from(analyses)
      .leftJoin(careerRoles, eq(careerRoles.id, analyses.careerRoleId))
      .leftJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
      .where(eq(analyses.userId, req.auth!.userId))
      .orderBy(desc(analyses.createdAt))
      .limit(3);

    const [activeRoadmap] = await db.select({id: roadmaps.id, title: roadmaps.title, status: roadmaps.status})
      .from(roadmaps)
      .where(and(eq(roadmaps.userId, req.auth!.userId), eq(roadmaps.status, "ACTIVE")))
      .limit(1);

    res.json({
      success: true,
      data: {
        profile,
        activeResume: activeResume ?? null,
        latestAnalysis: recentAnalyses[0] ?? null,
        recentAnalyses,
        activeRoadmap: activeRoadmap ?? null,
      },
    });
  } catch (error) { next(error); }
});
