import {z} from "zod";

export const uuidSchema = z.string().uuid();
export const experienceLevelSchema = z.enum(["STUDENT", "FRESHER", "ZERO_TO_ONE", "ONE_TO_THREE", "THREE_PLUS"]);
export const importanceSchema = z.enum(["CORE", "IMPORTANT", "OPTIONAL"]);

export const registerInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict();

export const loginInputSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const updateProfileInputSchema = z.object({
  collegeName: z.string().trim().max(200).nullable().optional(),
  degree: z.string().trim().max(200).nullable().optional(),
  graduationYear: z.number().int().min(1980).max(2100).nullable().optional(),
  experienceLevel: experienceLevelSchema.optional(),
  primaryRoleId: uuidSchema.nullable().optional(),
  secondaryRoleId: uuidSchema.nullable().optional(),
  currentSkillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
}).strict();

export const createJobDescriptionInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  companyName: z.string().trim().max(180).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  description: z.string().trim().min(80).max(30000),
}).strict();


export const addJobRequirementInputSchema = z.object({
  skillId: uuidSchema,
  importance: importanceSchema.default("IMPORTANT"),
  weight: z.number().int().min(1).max(3).default(2),
  originalText: z.string().trim().min(1).max(1000).optional(),
}).strict();

export const updateJobRequirementInputSchema = z.object({
  importance: importanceSchema.optional(),
  weight: z.number().int().min(1).max(3).optional(),
}).strict();

export const createAnalysisInputSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("PREDEFINED_ROLE"), resumeId: uuidSchema, careerRoleId: uuidSchema}).strict(),
  z.object({type: z.literal("CUSTOM_JOB"), resumeId: uuidSchema, jobDescriptionId: uuidSchema}).strict(),
]);

export const createResumeUploadIntentInputSchema = z.object({
  displayName: z.string().trim().min(1).max(180).optional(),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
}).strict();

export const addResumeSkillInputSchema = z.object({
  skillId: uuidSchema,
  evidenceText: z.string().trim().min(2).max(1000),
}).strict();

export const updateRoadmapItemStatusInputSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]),
}).strict();

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type CreateJobDescriptionInput = z.infer<typeof createJobDescriptionInputSchema>;
export type CreateAnalysisInput = z.infer<typeof createAnalysisInputSchema>;
export type SafeUser = {id: string; fullName: string; email: string; onboardingCompleted: boolean};
export type AuthResponse = {accessToken: string; user: SafeUser};
export type ApiSuccess<T> = {success: true; data: T};
export type ApiFailure = {success: false; error: {code: string; message: string; details?: unknown}};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
