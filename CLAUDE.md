# CLAUDE.md

Project information

See the README.md file for a project overview.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current


NEVER write any .md files inside the codebase except for README.md
Build and Test Commands

    Install: just install or pip install -e ".[dev]"
    Run all tests (SQLite + Postgres): just test
    Run all tests against SQLite: just test-sqlite
    Run all tests against Postgres: just test-postgres (uses testcontainers)
    Run unit tests (SQLite): just test-unit-sqlite
    Run unit tests (Postgres): just test-unit-postgres
    Run integration tests (SQLite): just test-int-sqlite
    Run integration tests (Postgres): just test-int-postgres
    Generate HTML coverage: just coverage
    Single test: pytest tests/path/to/test_file.py::test_function_name
    Run benchmarks: pytest test-int/test_sync_performance_benchmark.py -v -m "benchmark and not slow"
    Lint: just lint or ruff check . --fix
    Type check: just typecheck or uv run pyright
    Format: just format or uv run ruff format .
    Run all code checks: just check (runs lint, format, typecheck, test)
    Create db migration: just migration "Your migration message"
    Run development MCP Inspector: just run-inspector

Note: Project requires Python 3.12+ (uses type parameter syntax and type aliases introduced in 3.12)

Postgres Testing: Uses testcontainers which automatically spins up a Postgres instance in Docker. No manual database setup required - just have Docker running.
Test Structure

    tests/ - Unit tests for individual components (mocked, fast)
    test-int/ - Integration tests for real-world scenarios (no mocks, realistic)
    Both directories are covered by unified coverage reporting
    Benchmark tests in test-int/ are marked with @pytest.mark.benchmark
    Slow tests are marked with @pytest.mark.slow

Code Style Guidelines

    Line length: 100 characters max
    Python 3.12+ with full type annotations (uses type parameters and type aliases)
    Format with ruff (consistent styling)
    Import order: standard lib, third-party, local imports
    Naming: snake_case for functions/variables, PascalCase for classes
    Prefer async patterns with SQLAlchemy 2.0
    Use Pydantic v2 for data validation and schemas
    CLI uses Typer for command structure
    API uses FastAPI for endpoints
    Follow the repository pattern for data access
    Tools communicate to api routers via the httpx ASGI client (in process)

Code Change Guidelines

    Full file read before edits: Before editing any file, read it in full first to ensure complete context; partial reads lead to corrupted edits
    Minimize diffs: Prefer the smallest change that satisfies the request. Avoid unrelated refactors or style rewrites unless necessary for correctness
    No speculative getattr: Never use getattr(obj, "attr", default) when unsure about attribute names. Check the class definition or source code first
    Fail fast: Write code with fail-fast logic by default. Do not swallow exceptions with errors or warnings
    No fallback logic: Do not add fallback logic unless explicitly told to and agreed with the user
    No guessing: Do not say "The issue is..." before you actually know what the issue is. Investigate first.

Literate Programming Style

Code should tell a story. Comments must explain the "why" and narrative flow, not just the "what".

Section Headers: For files with multiple phases of logic, add section headers so the control flow reads like chapters:

# --- Authentication ---
# ... auth logic ...

# --- Data Validation ---
# ... validation logic ...

# --- Business Logic ---
# ... core logic ...

Decision Point Comments: For conditionals that materially change behavior (gates, fallbacks, retries, feature flags), add comments with:

    Trigger: what condition causes this branch
    Why: the rationale (cost, correctness, UX, determinism)
    Outcome: what changes downstream

# Trigger: project has no active sync watcher
# Why: avoid duplicate file system watchers consuming resources
# Outcome: starts new watcher, registers in active_watchers dict
if project_id not in active_watchers:
    start_watcher(project_id)

Constraint Comments: If code exists because of a constraint (async requirements, rate limits, schema compatibility), explain the constraint near the code:

# SQLite requires WAL mode for concurrent read/write access
connection.execute("PRAGMA journal_mode=WAL")

What NOT to Comment: Avoid comments that restate obvious code:

# Bad - restates code
counter += 1  # increment counter

# Good - explains why
counter += 1  # track retries for backoff calculation

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
Check EXAMPLES.md for more details on common assumptions and better procedures. 

---
