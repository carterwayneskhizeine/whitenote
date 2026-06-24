-- Cleanup merged posts from WhiteNote database
-- Run AFTER re-importing markdown files via POST /api/sync/import-all
--
-- This deletes posts that were marked with "#merged" during reorganization.
-- The content "[merged into xxx.md]" in the body identifies these records.
--
-- IMPORTANT: Back up your database before running these statements.
--   cp data/whitenote.db data/whitenote.db.bak

-- 1. Preview what will be deleted
SELECT id, substr(content, 1, 60) as preview, workspaceId
FROM Message
WHERE content LIKE '[merged into%';

-- 2. Delete comment tags for comments on merged messages
DELETE FROM CommentTag
WHERE commentId IN (
  SELECT c.id FROM Comment c
  WHERE c.messageId IN (
    SELECT id FROM Message WHERE content LIKE '[merged into%'
  )
);

-- 3. Delete comments on merged messages
DELETE FROM Comment
WHERE messageId IN (
  SELECT id FROM Message WHERE content LIKE '[merged into%'
);

-- 4. Delete message tags for merged messages
DELETE FROM MessageTag
WHERE messageId IN (
  SELECT id FROM Message WHERE content LIKE '[merged into%'
);

-- 5. Delete the merged messages themselves
DELETE FROM Message
WHERE content LIKE '[merged into%';

-- 6. Verify cleanup
SELECT count(*) as remaining_merged FROM Message WHERE content LIKE '[merged into%';
