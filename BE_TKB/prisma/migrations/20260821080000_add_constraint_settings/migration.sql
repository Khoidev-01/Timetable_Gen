-- Admin overrides for constraint weights and on/off state.
-- Only the override is stored; names and defaults stay in constraint-catalogue.ts.
CREATE TABLE "constraint_settings" (
    "key" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constraint_settings_pkey" PRIMARY KEY ("key")
);
