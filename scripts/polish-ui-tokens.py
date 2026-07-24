#!/usr/bin/env python3
"""Apply HD UI token replacements across landing, solution, and app surfaces."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGET_DIRS = [
    ROOT / "src/components/landing",
    ROOT / "src/pages",
    ROOT / "src/components/performance",
    ROOT / "src/components/itam",
    ROOT / "src/components/projects",
    ROOT / "src/components/policies",
    ROOT / "src/components/reports",
]

# Order matters — longer / more specific patterns first
REPLACEMENTS: list[tuple[str, str]] = [
    # Remove playful scale / lift hovers
    (r"\s*hover:-translate-y-3", ""),
    (r"\s*hover:-translate-y-2", ""),
    (r"\s*hover:-translate-y-1", ""),
    (r"\s*hover:scale-\[1\.02\]", ""),
    (r"\s*hover:scale-105", ""),
    (r"\s*hover:scale-110", ""),
    (r"\s*group-hover:scale-\[1\.02\]", ""),
    (r"\s*group-hover:scale-110", ""),
    (r"\s*group-hover:scale-105", ""),
    (r"\s*group-hover/card:scale-125", ""),
    (r"\s*group-hover/card:scale-105", ""),
    (r"\s*group-hover/row:scale-110", ""),
    (r"\s*group-hover/card:-translate-y-3", ""),
    # Cards → enterprise surfaces
    (r"hover:shadow-2xl", "hover:shadow-token-lg"),
    (r"hover:shadow-xl", "hover:shadow-token-md"),
    (r"hover:shadow-lg", "hover:shadow-token-md"),
    (r"bg-white border border-gray-200", "border border-border/70 bg-card"),
    (r"bg-white/80 backdrop-blur-sm border-border/50 hover:bg-white", "bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card"),
    (r"hover:bg-white hover:scale-105 hover:shadow-lg", "hover:bg-card hover:shadow-token-md"),
    (r"hover:bg-white hover:shadow-lg", "hover:bg-card hover:shadow-token-md"),
    # Semantic badge / status colors
    (r"bg-emerald-50 text-emerald-800 border-emerald-200", "bg-success/10 text-success border-success/20"),
    (r"bg-emerald-50 text-emerald-700 border-emerald-200", "bg-success/10 text-success border-success/20"),
    (r"bg-emerald-100 text-emerald-800", "bg-success/10 text-success"),
    (r"bg-emerald-100 text-emerald-700", "bg-success/10 text-success"),
    (r"text-emerald-600", "text-success"),
    (r"text-emerald-700", "text-success"),
    (r"group-hover:text-emerald-600", "group-hover:text-success"),
    (r"group-hover/card:text-emerald-600", "group-hover/card:text-success"),
    (r"bg-sky-50 text-sky-800 border-sky-200", "bg-info/10 text-info border-info/20"),
    (r"bg-blue-100 text-blue-800", "bg-info/10 text-info"),
    (r"bg-blue-100 text-blue-700", "bg-info/10 text-info"),
    (r"text-blue-600", "text-info"),
    (r"text-blue-700", "text-info"),
    (r"group-hover:text-blue-600", "group-hover:text-info"),
    (r"group-hover/card:text-blue-600", "group-hover/card:text-info"),
    (r"bg-amber-100 text-amber-800", "bg-warning/10 text-warning"),
    (r"text-amber-400 fill-amber-400", "text-warning fill-warning"),
    (r"text-amber-800", "text-warning"),
    (r"bg-red-100 text-red-800", "bg-destructive/10 text-destructive"),
    (r"text-red-600", "text-destructive"),
    (r"text-red-500", "text-destructive"),
    (r"bg-purple-100 text-purple-800", "bg-accent/10 text-accent-foreground"),
    (r"text-purple-600", "text-accent"),
    (r"group-hover/card:text-purple-600", "group-hover/card:text-accent"),
    (r"bg-violet-50 text-violet-800 border-violet-200", "bg-accent/10 text-accent-foreground border-accent/20"),
    (r"bg-gray-100 text-gray-800", "bg-muted text-muted-foreground"),
    (r"text-gray-300", "text-muted-foreground/40"),
    (r"text-yellow-400 fill-yellow-400", "text-warning fill-warning"),
    # Icon size normalization (common patterns)
    (r'\bclassName="h-3 w-3\b', 'className="icon-xs'),
    (r'\bclassName="w-3 h-3\b', 'className="icon-xs'),
    (r'\bclassName="h-4 w-4\b', 'className="icon-md'),
    (r'\bclassName="w-4 h-4\b', 'className="icon-md'),
    (r'\bclassName="h-5 w-5\b', 'className="icon-lg'),
    (r'\bclassName="w-5 h-5\b', 'className="icon-lg'),
    (r'\bclassName="h-6 w-6\b', 'className="icon-xl'),
    (r'\bclassName="w-6 h-6\b', 'className="icon-xl'),
    (r'\bclassName="h-8 w-8\b', 'className="size-8'),
    (r'\bclassName="w-8 h-8\b', 'className="size-8'),
    # Trailing icon fragments after icon-* rename
    (r'icon-xs ([^"]*?)"', r'icon-xs \1"'),
]

SKIP_FILES = {"Auth.tsx", "Dashboard.tsx"}  # already polished


def polish_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original
    for pattern, repl in REPLACEMENTS:
        updated = re.sub(pattern, repl, updated)
    # Collapse duplicate spaces in className strings
    updated = re.sub(r'className="([^"]*?)\s{2,}', lambda m: f'className="{re.sub(r"\\s+", " ", m.group(1))}', updated)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed: list[str] = []
    for directory in TARGET_DIRS:
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*.tsx")):
            if path.name in SKIP_FILES:
                continue
            if polish_file(path):
                changed.append(str(path.relative_to(ROOT)))
    print(f"Updated {len(changed)} files")
    for name in changed:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
