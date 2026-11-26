CREATE TYPE "public"."document_kind" AS ENUM('blood_report_pdf', 'apple_health_xml', 'wearable_csv');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_request_status" AS ENUM('requested', 'mock_confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('member', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('extracted', 'user_provided', 'calculated', 'synthetic_seed');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'approved', 'changed', 'rejected');--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"primary_action" jsonb NOT NULL,
	"supporting_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text NOT NULL,
	"generated_by" text NOT NULL,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biomarkers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_id" uuid,
	"code" text,
	"name_as_reported" text NOT NULL,
	"value_numeric" numeric,
	"value_text" text NOT NULL,
	"unit_as_reported" text,
	"ref_low" numeric,
	"ref_high" numeric,
	"ref_text" text,
	"flag_as_reported" text,
	"observed_on" date,
	"source" "record_source" NOT NULL,
	"confidence" real,
	"page_number" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"status" "document_status" DEFAULT 'uploaded' NOT NULL,
	"extraction_method" text,
	"collected_on" date,
	"error_message" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "event_request_status" DEFAULT 'requested' NOT NULL,
	"note" text,
	"is_mock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"how_it_may_help" text NOT NULL,
	"expected_outcome" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"location" text,
	"starts_at" timestamp with time zone,
	"price_text" text,
	"is_sample" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"conversation_id" text DEFAULT 'default' NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"structured" jsonb,
	"engine" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"role" "profile_role" DEFAULT 'member' NOT NULL,
	"display_name" text NOT NULL,
	"birth_year" smallint,
	"sex_at_birth" text,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routine" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "supplement_catalogue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"relevance_notes" text NOT NULL,
	"caution_notes" text NOT NULL,
	"source_url" text,
	"is_sample" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplement_catalogue_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "supplement_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"catalogue_id" uuid NOT NULL,
	"rationale" text NOT NULL,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"reviewer_dose" text,
	"reviewer_note" text,
	"reviewer_profile_id" uuid,
	"reviewed_at" timestamp with time zone,
	"is_simulated_review" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"description" text NOT NULL,
	"severity" smallint,
	"started_on" date,
	"resolved_on" date,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "record_source" DEFAULT 'user_provided' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_id" uuid,
	"metric_type" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"aggregation" text NOT NULL,
	"day" date NOT NULL,
	"sample_count" integer DEFAULT 1 NOT NULL,
	"source_format" text NOT NULL,
	"source_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biomarkers" ADD CONSTRAINT "biomarkers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biomarkers" ADD CONSTRAINT "biomarkers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_suggestions" ADD CONSTRAINT "supplement_suggestions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_suggestions" ADD CONSTRAINT "supplement_suggestions_catalogue_id_supplement_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."supplement_catalogue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_suggestions" ADD CONSTRAINT "supplement_suggestions_reviewer_profile_id_profiles_id_fk" FOREIGN KEY ("reviewer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_entries" ADD CONSTRAINT "symptom_entries_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_metrics" ADD CONSTRAINT "wearable_metrics_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_metrics" ADD CONSTRAINT "wearable_metrics_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_plans_profile_date_idx" ON "action_plans" USING btree ("profile_id","plan_date");--> statement-breakpoint
CREATE INDEX "biomarkers_profile_code_idx" ON "biomarkers" USING btree ("profile_id","code","observed_on");--> statement-breakpoint
CREATE INDEX "documents_profile_idx" ON "documents" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_profile_sha_idx" ON "documents" USING btree ("profile_id","sha256");--> statement-breakpoint
CREATE INDEX "event_requests_profile_idx" ON "event_requests" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "messages_profile_conv_idx" ON "messages" USING btree ("profile_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "supplement_suggestions_profile_idx" ON "supplement_suggestions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "symptom_entries_profile_idx" ON "symptom_entries" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_metrics_daily_idx" ON "wearable_metrics" USING btree ("profile_id","metric_type","day","aggregation","source_format");