CREATE TABLE "health_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_timeline_events" ADD CONSTRAINT "health_timeline_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_timeline_events_profile_idx" ON "health_timeline_events" USING btree ("profile_id","occurred_at");