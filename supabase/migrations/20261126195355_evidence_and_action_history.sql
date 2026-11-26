CREATE TYPE "public"."action_outcome" AS ENUM('completed', 'skipped');--> statement-breakpoint
CREATE TABLE "action_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"plan_id" uuid,
	"action_id" text NOT NULL,
	"action_title" text NOT NULL,
	"category" text NOT NULL,
	"outcome" "action_outcome" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"heading" text NOT NULL,
	"content" text NOT NULL,
	"biomarkers" text[] DEFAULT '{}' NOT NULL,
	"systems" text[] DEFAULT '{}' NOT NULL,
	"themes" text[] DEFAULT '{}' NOT NULL,
	"embedding" vector(384),
	"embedding_model" text,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', heading || ' ' || content)) STORED
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published_on" date,
	"last_updated_on" date,
	"last_reviewed_on" date,
	"next_review_due" date,
	"retrieved_on" date NOT NULL,
	"date_note" text,
	"topic" text NOT NULL,
	"evidence_class" text NOT NULL,
	"limitations" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_history" ADD CONSTRAINT "action_history_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_history" ADD CONSTRAINT "action_history_plan_id_action_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."action_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_chunks" ADD CONSTRAINT "evidence_chunks_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_history_profile_idx" ON "action_history" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_chunks_embedding_idx" ON "evidence_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "evidence_chunks_tsv_idx" ON "evidence_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "evidence_chunks_systems_idx" ON "evidence_chunks" USING gin ("systems");--> statement-breakpoint
CREATE INDEX "evidence_chunks_biomarkers_idx" ON "evidence_chunks" USING gin ("biomarkers");