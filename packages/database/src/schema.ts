import {boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar} from "drizzle-orm/pg-core";

export const experienceLevelEnum = pgEnum("experience_level", ["STUDENT", "FRESHER", "ZERO_TO_ONE", "ONE_TO_THREE", "THREE_PLUS"]);
export const skillLevelEnum = pgEnum("skill_level", ["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const skillCategoryEnum = pgEnum("skill_category", ["LANGUAGE", "FRONTEND", "BACKEND", "DATABASE", "DEVOPS", "TESTING", "CLOUD", "DATA_ANALYSIS", "MACHINE_LEARNING", "DESIGN", "TOOLS", "SOFT_SKILL"]);
export const requirementImportanceEnum = pgEnum("requirement_importance", ["CORE", "IMPORTANT", "OPTIONAL"]);
export const requirementMatchModeEnum = pgEnum("requirement_match_mode", ["ANY", "ALL"]);
export const resumeStatusEnum = pgEnum("resume_status", ["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"]);
export const evidenceSourceEnum = pgEnum("evidence_source", ["EXPERIENCE", "PROJECT", "CERTIFICATION", "SUMMARY", "SKILLS_LIST", "OTHER", "MANUAL"]);
export const jobDescriptionStatusEnum = pgEnum("job_description_status", ["PROCESSING", "READY", "FAILED"]);
export const analysisTypeEnum = pgEnum("analysis_type", ["PREDEFINED_ROLE", "CUSTOM_JOB"]);
export const analysisStatusEnum = pgEnum("analysis_status", ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
export const matchLevelEnum = pgEnum("match_level", ["STRONG_MATCH", "GOOD_MATCH", "DEVELOPING_MATCH", "SIGNIFICANT_GAPS"]);
export const roadmapStatusEnum = pgEnum("roadmap_status", ["ACTIVE", "COMPLETED", "ARCHIVED"]);
export const roadmapItemStatusEnum = pgEnum("roadmap_item_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]);
export const roadmapPriorityEnum = pgEnum("roadmap_priority", ["LEARN_FIRST", "HIGH", "MEDIUM", "OPTIONAL"]);

const timestamps = {
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", {length: 120}).notNull(),
  email: varchar("email", {length: 255}).notNull(),
  passwordHash: varchar("password_hash", {length: 255}).notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  jti: uuid("jti").notNull(),
  tokenHash: varchar("token_hash", {length: 64}).notNull(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  revokedAt: timestamp("revoked_at", {withTimezone: true}),
  replacedByJti: uuid("replaced_by_jti"),
  ...timestamps,
}, (table) => [
  uniqueIndex("refresh_tokens_jti_unique").on(table.jti),
  uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
  index("refresh_tokens_user_idx").on(table.userId),
]);

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", {length: 120}).notNull(),
  name: varchar("name", {length: 160}).notNull(),
  category: skillCategoryEnum("category").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("skills_slug_unique").on(table.slug), uniqueIndex("skills_name_unique").on(table.name)]);

export const skillAliases = pgTable("skill_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  alias: varchar("alias", {length: 160}).notNull(),
  normalizedAlias: varchar("normalized_alias", {length: 160}).notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
}, (table) => [uniqueIndex("skill_aliases_normalized_unique").on(table.normalizedAlias)]);

export const skillRelations = pgTable("skill_relations", {
  sourceSkillId: uuid("source_skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  targetSkillId: uuid("target_skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  matchFactorBp: integer("match_factor_bp").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
}, (table) => [primaryKey({columns: [table.sourceSkillId, table.targetSkillId]})]);

export const careerRoles = pgTable("career_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", {length: 120}).notNull(),
  name: varchar("name", {length: 160}).notNull(),
  description: text("description").notNull(),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("career_roles_slug_unique").on(table.slug)]);

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  collegeName: varchar("college_name", {length: 200}),
  degree: varchar("degree", {length: 200}),
  graduationYear: integer("graduation_year"),
  experienceLevel: experienceLevelEnum("experience_level").default("STUDENT").notNull(),
  primaryRoleId: uuid("primary_role_id").references(() => careerRoles.id, {onDelete: "set null"}),
  secondaryRoleId: uuid("secondary_role_id").references(() => careerRoles.id, {onDelete: "set null"}),
  currentSkillLevel: skillLevelEnum("current_skill_level").default("BEGINNER").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("user_profiles_user_unique").on(table.userId)]);

export const roleRequirements = pgTable("role_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  careerRoleId: uuid("career_role_id").notNull().references(() => careerRoles.id, {onDelete: "cascade"}),
  name: varchar("name", {length: 180}).notNull(),
  description: text("description"),
  importance: requirementImportanceEnum("importance").notNull(),
  weight: integer("weight").notNull(),
  matchMode: requirementMatchModeEnum("match_mode").default("ANY").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => [index("role_requirements_role_idx").on(table.careerRoleId)]);

export const roleRequirementSkills = pgTable("role_requirement_skills", {
  roleRequirementId: uuid("role_requirement_id").notNull().references(() => roleRequirements.id, {onDelete: "cascade"}),
  skillId: uuid("skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
}, (table) => [primaryKey({columns: [table.roleRequirementId, table.skillId]})]);

export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  originalFilename: varchar("original_filename", {length: 255}).notNull(),
  displayName: varchar("display_name", {length: 180}).notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: varchar("mime_type", {length: 120}).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  status: resumeStatusEnum("status").default("UPLOADED").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  extractedText: text("extracted_text"),
  processingError: text("processing_error"),
  contentRevision: integer("content_revision").default(0).notNull(),
  confirmedRevision: integer("confirmed_revision").default(0).notNull(),
  processedAt: timestamp("processed_at", {withTimezone: true}),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps,
}, (table) => [index("resumes_user_idx").on(table.userId), index("resumes_user_active_idx").on(table.userId, table.isActive)]);

export const resumeSkills = pgTable("resume_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  resumeId: uuid("resume_id").notNull().references(() => resumes.id, {onDelete: "cascade"}),
  skillId: uuid("skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  originalText: varchar("original_text", {length: 180}).notNull(),
  evidenceText: text("evidence_text").notNull(),
  evidenceSource: evidenceSourceEnum("evidence_source").notNull(),
  evidenceFactorBp: integer("evidence_factor_bp").notNull(),
  confidenceBp: integer("confidence_bp").notNull(),
  isManual: boolean("is_manual").default(false).notNull(),
  isRemoved: boolean("is_removed").default(false).notNull(),
  ...timestamps,
}, (table) => [index("resume_skills_resume_idx").on(table.resumeId), index("resume_skills_skill_idx").on(table.skillId)]);

export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  title: varchar("title", {length: 180}).notNull(),
  companyName: varchar("company_name", {length: 180}),
  sourceUrl: text("source_url"),
  rawDescription: text("raw_description").notNull(),
  status: jobDescriptionStatusEnum("status").default("PROCESSING").notNull(),
  processingError: text("processing_error"),
  contentRevision: integer("content_revision").default(0).notNull(),
  confirmedRevision: integer("confirmed_revision").default(0).notNull(),
  ...timestamps,
}, (table) => [index("job_descriptions_user_idx").on(table.userId)]);

export const jobDescriptionRequirements = pgTable("job_description_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobDescriptionId: uuid("job_description_id").notNull().references(() => jobDescriptions.id, {onDelete: "cascade"}),
  skillId: uuid("skill_id").notNull().references(() => skills.id, {onDelete: "cascade"}),
  originalText: text("original_text").notNull(),
  importance: requirementImportanceEnum("importance").notNull(),
  weight: integer("weight").notNull(),
  confidenceBp: integer("confidence_bp").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("job_description_requirement_unique").on(table.jobDescriptionId, table.skillId),
  index("job_description_requirements_job_idx").on(table.jobDescriptionId),
]);

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  resumeId: uuid("resume_id").notNull().references(() => resumes.id, {onDelete: "cascade"}),
  analysisType: analysisTypeEnum("analysis_type").notNull(),
  careerRoleId: uuid("career_role_id").references(() => careerRoles.id, {onDelete: "restrict"}),
  jobDescriptionId: uuid("job_description_id").references(() => jobDescriptions.id, {onDelete: "restrict"}),
  status: analysisStatusEnum("status").default("PENDING").notNull(),
  calculationVersion: varchar("calculation_version", {length: 30}).default("1.0.0").notNull(),
  overallScoreBp: integer("overall_score_bp"),
  matchLevel: matchLevelEnum("match_level"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  failureReason: text("failure_reason"),
  startedAt: timestamp("started_at", {withTimezone: true}),
  completedAt: timestamp("completed_at", {withTimezone: true}),
  ...timestamps,
}, (table) => [index("analyses_user_idx").on(table.userId), index("analyses_resume_idx").on(table.resumeId)]);

export const roadmaps = pgTable("roadmaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  analysisId: uuid("analysis_id").notNull().references(() => analyses.id, {onDelete: "cascade"}),
  title: varchar("title", {length: 200}).notNull(),
  status: roadmapStatusEnum("status").default("ACTIVE").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("roadmaps_analysis_unique").on(table.analysisId), index("roadmaps_user_idx").on(table.userId)]);

export const roadmapItems = pgTable("roadmap_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  roadmapId: uuid("roadmap_id").notNull().references(() => roadmaps.id, {onDelete: "cascade"}),
  skillId: uuid("skill_id").references(() => skills.id, {onDelete: "set null"}),
  phase: integer("phase").notNull(),
  title: varchar("title", {length: 220}).notNull(),
  description: text("description").notNull(),
  priority: roadmapPriorityEnum("priority").notNull(),
  estimatedHours: integer("estimated_hours").notNull(),
  status: roadmapItemStatusEnum("status").default("NOT_STARTED").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  completedAt: timestamp("completed_at", {withTimezone: true}),
  ...timestamps,
}, (table) => [index("roadmap_items_roadmap_idx").on(table.roadmapId)]);
