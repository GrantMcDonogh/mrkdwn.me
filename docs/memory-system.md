# Memory System

The memory system is the foundation of i60-memory. It manages a collection of Markdown files with structured frontmatter, indexes them for fast search, and provides template-based creation.

**Source:** `src/memory/` (reader, indexer, searcher, templates)

## File Format

Every memory file is a standard Markdown file with YAML frontmatter:

```yaml
---
title: "Q1 Board Meeting Minutes"
company: "cloud-nexus"
category: "meetings"
tags: [board, quarterly, finance]
created: "2026-01-15"
updated: "2026-01-15"
status: "active"
summary: "Minutes from Q1 2026 board meeting covering revenue, hiring, and product roadmap"
---

## Attendees
- Alice (CEO)
- Bob (CFO)
...
```

### Required Frontmatter Fields

| Field | Type | Purpose |
|-------|------|---------|
| `title` | string | Human-readable title |
| `company` | string | `i60-group` or subsidiary slug |
| `category` | string | One of: strategy, finance, contacts, meetings, decisions, legal, operations, projects, resources, policies, knowledge-base |
| `tags` | list | Free-form tags for search |
| `created` | date string | Creation date (YYYY-MM-DD) |
| `updated` | date string | Last modified date (YYYY-MM-DD) |
| `status` | string | `active`, `archived`, or `draft` |
| `summary` | string | One-line description -- this powers search ranking |

### Directory Layout

```
memories/
  _index/                   # Generated JSON index (gitignored)
  _templates/               # Document templates
  group/                    # Group-level documents
  companies/
    _company_template/      # Skeleton for new companies
    cloud-nexus/            # Per-company directories
      contacts/
      decisions/
      finance/
      meetings/
      operations/
      projects/
      overview.md
  shared/                   # Cross-company documents
```

## Reader (`src/memory/reader.py`)

The `MemoryFile` dataclass represents a parsed memory document. The `parse_memory_file(path)` function:

1. Loads the file using the `python-frontmatter` library
2. Validates that all 8 required fields are present
3. Normalises `tags` (accepts both lists and comma-separated strings)
4. Returns `None` on any parse failure (logged as a warning)

Key methods on `MemoryFile`:
- `relative_path` -- path relative to the `memories/` directory
- `to_index_entry()` -- serialises to a dict for the JSON index (includes a `filename` field for search)

## Indexer (`src/memory/indexer.py`)

The indexer scans the filesystem and builds a JSON index at `memories/_index/memories_index.json`.

### Functions

- **`scan_memories(memories_dir)`** -- recursively finds all `.md` files, skipping `_templates/` and `_company_template/`. Parses each file and collects index entries.
- **`build_index(memories_dir)`** -- calls `scan_memories()`, writes the JSON index `{"count": N, "entries": [...]}`, returns the index path.
- **`load_index(memories_dir)`** -- reads the JSON index from disk. Returns an empty list if the file doesn't exist.

### When the Index Is Built

| Trigger | Context |
|---------|---------|
| Bot startup | `src/bot/app.py` |
| Web app startup | `src/web/app.py` (lifespan) |
| `/refresh` command | Telegram bot |
| `POST /api/index/rebuild` | Web admin API |
| After file create/update/delete | Web admin memory CRUD |
| After generator save | Document generator |
| `python -m src.memory.indexer` | Manual CLI |

## Searcher (`src/memory/searcher.py`)

A weighted keyword scoring system. No embeddings or vector storage -- pure string matching against index entries.

### Scoring Weights

| Field | Weight | Rationale |
|-------|--------|-----------|
| Company | 4.0 | Company-specific queries should strongly match |
| Tags | 3.0 | Tags are curated relevance signals |
| Title | 2.5 | Titles are descriptive |
| Category | 2.0 | Category provides topic grouping |
| Summary | 1.5 | Summaries describe content |
| Filename | 1.0 | Filenames sometimes match queries |
| Recency bonus | 0.0 -- 1.0 | Linear decay over `recency_days` (default 30) |
| Archived penalty | -100.0 | Effectively excludes archived files |

### Algorithm

1. Tokenise the query into lowercase alphanumeric tokens (`[a-zA-Z0-9]+`)
2. For each index entry, sum `weight * (fraction of query tokens found in field)`
3. If score > 0, add a recency bonus based on the `updated` date
4. Filter to entries with score > 0, sort descending, return top N (default 15)

## Templates (`src/memory/templates.py`)

Templates live in `memories/_templates/` and use `{{ variable }}` placeholders (rendered via regex substitution). The `date` variable defaults to today's ISO date.

### Available Templates

| Template | Purpose |
|----------|---------|
| `company_profile.md` | Company overview with key info, core business, key people |
| `meeting_notes.md` | Agenda, notes, action items, decisions |
| `decision_log.md` | Context, options considered, decision, consequences |
| `contact.md` | Person's name, role, contact info, notes |
| `project.md` | Overview, objectives, timeline, team, status updates |
| `general_note.md` | Minimal title + body |

### Company Directory Template

`memories/companies/_company_template/` is a skeleton directory with empty subdirectories (`contacts/`, `decisions/`, `finance/`, `meetings/`, `operations/`, `projects/`) and an `overview.md`. When a new company is created through the document generator, this template is copied via `shutil.copytree`.
