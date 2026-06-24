---
name: reorganize-posts
description: >
  Classify, merge, and reorganize WhiteNote posts exported as markdown files.
  Use this skill when the user wants to clean up old posts, merge fragmented short messages,
  reorganize content by topic, or batch-edit exported .md files before re-importing into WhiteNote.
  Also use when the user mentions "整理帖子", "合并帖子", "分类帖子", "导出帖子", "reindex",
  or asks about re-embedding or vectorizing old content.
---

# Reorganize WhiteNote Posts

You are helping reorganize posts exported from WhiteNote (a microblogging platform).
The posts live as .md files in a directory structure managed by a sync system.
Your job is to safely edit these files — classifying, merging, and cleaning up content —
so they can be re-imported without breaking the sync mapping.

## The Directory Structure

```
data/link_md/
├── {workspace-name}/           ← one folder per workspace
│   ├── .whitenote/
│   │   └── workspace.json      ← mapping table (DO NOT TOUCH)
│   ├── some-post.md            ← a message (post)
│   └── some-post/              ← comment subfolder for that message
│       ├── reply-abc123.md     ← a comment
│       └── reply-def456.md
```

Every workspace has a `.whitenote/workspace.json` that maps filenames to database IDs.
The import system uses this file to find which database record corresponds to which .md file.

## Markdown Format (Fixed)

Every .md file follows this exact structure:

```markdown
#tag1 #tag2 #tag3

Body content starts here on line 3.
```

- **Line 1**: Tag line. Space-separated hashtags (`#tag`). Empty line if no tags.
- **Line 2**: Empty line (separator).
- **Line 3+**: Body content (the actual post text).

The parser reads line 1 as tags, everything from line 2 onward as body.
If you put a title or paragraph on line 1 that doesn't match `#word` patterns,
it gets silently discarded or misinterpreted as a tag.

## Rules

### What you CAN do (safe, no side effects)

- Edit body content (line 3+) freely — rewrite, expand, condense, fix grammar
- Edit tags on line 1 — add, remove, or change tags
- Add new tags based on your understanding of the content

### What you MUST NOT do (will break the sync)

- **Do not rename files.** The filename is tracked in `workspace.json` as `currentFilename`.
  Renaming breaks the lookup — the import system won't find the file.
- **Do not move files.** Same reason — path-based lookup fails.
- **Do not create new files.** New files have no mapping in `workspace.json` and get skipped.
- **Do not delete files.** The database record survives, creating an orphan with stale content.
- **Do not edit `workspace.json`.** A wrong ID mapping means content gets written to the wrong record.
- **Do not rename or restructure comment subfolders.** Folder names are tracked in `workspace.json`
  as `commentFolderName` (for messages) and `folderName` (for comments).

## Merging Posts

WhiteNote has many short, fragmented posts (under 50 characters).
Merging them into one coherent note is a primary use case for this skill.

### How to merge

1. Pick the "keeper" file — the one that will hold the merged content.
2. Edit the keeper file to contain the combined, reorganized content.
3. For every file being merged away, replace its entire content with:

```markdown
#merged

[merged into keeper-filename.md]
```

Where `keeper-filename.md` is the actual filename of the keeper.

This preserves the `workspace.json` mapping (the file still exists under the same name),
but marks the database record for cleanup after re-import.

### After re-import, the user needs to:

1. Run the SQL in `references/cleanup-merged.sql` to delete merged stubs from the database
2. Run `POST /api/sync/export-all` to refresh `workspace.json` mappings
3. Run `POST /api/ai/reindex` to regenerate vector embeddings

### Merging rules

- Only merge posts from the same workspace (same parent folder)
- Only merge posts that are genuinely about the same topic
- Never merge a file that has a comment subfolder (those comments reference this message)
  — if a subfolder exists with the same name as the .md file (minus extension), it has comments
- When merging, preserve all substantive information — don't lose details for brevity

## Classification

When organizing posts, tag them consistently. Use these guidelines:

1. **Keep existing tags** unless they're clearly wrong
2. **Add missing tags** that accurately describe the content
3. **Use consistent tag names** — prefer existing tags over creating near-duplicates
   (e.g., if `#openclaw` exists, don't add `#openclaw-gateway` unless the distinction matters)
4. **Tag language**: match the language of the content — Chinese content gets Chinese tags

## Content Rewrite Guidelines

When cleaning up post body content:

- Preserve the author's intent and key information
- Convert fragmented notes into coherent paragraphs
- Keep it concise — this is a microblog, not a wiki
- Preserve code blocks, links, and structured content as-is
- Don't add filler — if a short post says "buy earplugs", just tag it and leave it
- Don't add `#merged` tags to posts you rewrote but didn't merge — that tag is reserved

## Handling Comments

Files inside subfolders are comments belonging to the parent message.

- You can edit comment content the same way as messages
- You can edit comment tags
- Do NOT move comments between subfolders or merge comments from different messages
- Comments are usually fewer (66 total across all workspaces) — focus effort on messages first

## References

See `references/cleanup-merged.sql` for the SQL to run after re-importing merged posts.
