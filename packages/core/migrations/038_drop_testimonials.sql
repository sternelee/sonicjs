-- Migration 038: Drop legacy testimonials table
-- Testimonials are now stored as documents in the document repository (migration 037).
-- The testimonials plugin API and admin routes have been repointed to the document model.

DROP TABLE IF EXISTS testimonials;
