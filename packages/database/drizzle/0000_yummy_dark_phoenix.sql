CREATE TYPE "public"."analysis_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM('PREDEFINED_ROLE', 'CUSTOM_JOB');--> statement-breakpoint
CREATE TYPE "public"."evidence_source" AS ENUM('EXPERIENCE', 'PROJECT', 'CERTIFICATION', 'SUMMARY', 'SKILLS_LIST', 'OTHER', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('STUDENT', 'FRESHER', 'ZERO_TO_ONE', 'ONE_TO_THREE', 'THREE_PLUS');--> statement-breakpoint
CREATE TYPE "public"."job_description_status" AS ENUM('PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."match_level" AS ENUM('STRONG_MATCH', 'GOOD_MATCH', 'DEVELOPING_MATCH', 'SIGNIFICANT_GAPS');--> statement-breakpoint
CREATE TYPE "public"."requirement_importance" AS ENUM('CORE', 'IMPORTANT', 'OPTIONAL');--> statement-breakpoint
CREATE TYPE "public"."requirement_match_mode" AS ENUM('ANY', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."resume_status" AS ENUM('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."roadmap_item_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."roadmap_priority" AS ENUM('LEARN_FIRST', 'HIGH', 'MEDIUM', 'OPTIONAL');--> statement-breakpoint
CREATE TYPE "public"."roadmap_status" AS ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('LANGUAGE', 'FRONTEND', 'BACKEND', 'DATABASE', 'DEVOPS', 'TESTING', 'CLOUD', 'DATA_ANALYSIS', 'MACHINE_LEARNING', 'DESIGN', 'TOOLS', 'SOFT_SKILL');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"analysis_type" "analysis_type" NOT NULL,
	"career_role_id" uuid,
	"job_description_id" uuid,
	"status" "analysis_status" DEFAULT 'PENDING' NOT NULL,
	"calculation_version" varchar(30) DEFAULT '1.0.0' NOT NULL,
	"overall_score_bp" integer,
	"match_level" "match_level",
	"result" jsonb,
	"failure_reason" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_description_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_description_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"original_text" text NOT NULL,
	"importance" "requirement_importance" NOT NULL,
	"weight" integer NOT NULL,
	"confidence_bp" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"company_name" varchar(180),
	"source_url" text,
	"raw_description" text NOT NULL,
	"status" "job_description_status" DEFAULT 'PROCESSING' NOT NULL,
	"processing_error" text,
	"content_revision" integer DEFAULT 0 NOT NULL,
	"confirmed_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"jti" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_jti" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"original_text" varchar(180) NOT NULL,
	"evidence_text" text NOT NULL,
	"evidence_source" "evidence_source" NOT NULL,
	"evidence_factor_bp" integer NOT NULL,
	"confidence_bp" integer NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"is_removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"display_name" varchar(180) NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" "resume_status" DEFAULT 'UPLOADED' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"extracted_text" text,
	"processing_error" text,
	"content_revision" integer DEFAULT 0 NOT NULL,
	"confirmed_revision" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"skill_id" uuid,
	"phase" integer NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text NOT NULL,
	"priority" "roadmap_priority" NOT NULL,
	"estimated_hours" integer NOT NULL,
	"status" "roadmap_item_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" "roadmap_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_requirement_skills" (
	"role_requirement_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_requirement_skills_role_requirement_id_skill_id_pk" PRIMARY KEY("role_requirement_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "role_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"career_role_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"importance" "requirement_importance" NOT NULL,
	"weight" integer NOT NULL,
	"match_mode" "requirement_match_mode" DEFAULT 'ANY' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" varchar(160) NOT NULL,
	"normalized_alias" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_relations" (
	"source_skill_id" uuid NOT NULL,
	"target_skill_id" uuid NOT NULL,
	"match_factor_bp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_relations_source_skill_id_target_skill_id_pk" PRIMARY KEY("source_skill_id","target_skill_id")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "skill_category" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"college_name" varchar(200),
	"degree" varchar(200),
	"graduation_year" integer,
	"experience_level" "experience_level" DEFAULT 'STUDENT' NOT NULL,
	"primary_role_id" uuid,
	"secondary_role_id" uuid,
	"current_skill_level" "skill_level" DEFAULT 'BEGINNER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_career_role_id_career_roles_id_fk" FOREIGN KEY ("career_role_id") REFERENCES "public"."career_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_requirements" ADD CONSTRAINT "job_description_requirements_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_requirements" ADD CONSTRAINT "job_description_requirements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_requirement_skills" ADD CONSTRAINT "role_requirement_skills_role_requirement_id_role_requirements_id_fk" FOREIGN KEY ("role_requirement_id") REFERENCES "public"."role_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_requirement_skills" ADD CONSTRAINT "role_requirement_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_requirements" ADD CONSTRAINT "role_requirements_career_role_id_career_roles_id_fk" FOREIGN KEY ("career_role_id") REFERENCES "public"."career_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relations" ADD CONSTRAINT "skill_relations_source_skill_id_skills_id_fk" FOREIGN KEY ("source_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relations" ADD CONSTRAINT "skill_relations_target_skill_id_skills_id_fk" FOREIGN KEY ("target_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_primary_role_id_career_roles_id_fk" FOREIGN KEY ("primary_role_id") REFERENCES "public"."career_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_secondary_role_id_career_roles_id_fk" FOREIGN KEY ("secondary_role_id") REFERENCES "public"."career_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_idx" ON "analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analyses_resume_idx" ON "analyses" USING btree ("resume_id");--> statement-breakpoint
CREATE UNIQUE INDEX "career_roles_slug_unique" ON "career_roles" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "job_description_requirement_unique" ON "job_description_requirements" USING btree ("job_description_id","skill_id");--> statement-breakpoint
CREATE INDEX "job_description_requirements_job_idx" ON "job_description_requirements" USING btree ("job_description_id");--> statement-breakpoint
CREATE INDEX "job_descriptions_user_idx" ON "job_descriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_jti_unique" ON "refresh_tokens" USING btree ("jti");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_skills_resume_idx" ON "resume_skills" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_skills_skill_idx" ON "resume_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "resumes_user_idx" ON "resumes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resumes_user_active_idx" ON "resumes" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "roadmap_items_roadmap_idx" ON "roadmap_items" USING btree ("roadmap_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmaps_analysis_unique" ON "roadmaps" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "roadmaps_user_idx" ON "roadmaps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_requirements_role_idx" ON "role_requirements" USING btree ("career_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_aliases_normalized_unique" ON "skill_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_unique" ON "skills" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_name_unique" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");