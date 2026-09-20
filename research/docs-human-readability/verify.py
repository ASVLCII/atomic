#!/usr/bin/env python3
"""Repeatable audit against the immutable pre-pass commit; never updates expectations."""
import collections
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = "2175058c1e1dfd5850a61914566ab45110a65ef4"
DOCS = ROOT / "packages/coding-agent/docs"
EVIDENCE = ROOT / "research/docs-human-readability"


def original(path):
    return subprocess.check_output(["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT).decode()


def split(text):
    blocks, prose, block = [], [], []
    delimiter = None
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^\s*(`{3,}|~{3,})(.*)$", line.rstrip("\n"))
        if delimiter:
            block.append(line)
            if marker and marker[1][0] == delimiter[0] and len(marker[1]) >= len(delimiter) and not marker[2].strip():
                blocks.append("".join(block))
                block, delimiter = [], None
        elif marker:
            delimiter, block = marker[1], [line]
        else:
            prose.append(line)
    assert delimiter is None, "Unclosed fence"
    return blocks, "".join(prose)


def headings(text):
    return re.findall(r"^#{1,6} .*$", split(text)[1], re.M)


def ids(text):
    return re.findall(r'<[\w-]+\s+id=[\"\']([^\"\']+)[\"\']', split(text)[1])


def github_anchors(text):
    counts = collections.Counter()
    result = set(ids(text))
    for heading in headings(text):
        slug = re.sub(r"[^\w\- ]", "", re.sub(r"^#+\s+", "", heading).lower()).replace(" ", "-")
        count = counts[slug]
        counts[slug] += 1
        result.add(slug if not count else f"{slug}-{count}")
    return result


def inline_literals(text):
    return {match[2] for match in re.finditer(r"(?<!`)(`+)([^\n]*?)\1(?!`)", text)}


def main():
    pages = sorted(p for p in DOCS.rglob("*") if p.suffix in (".md", ".mdx"))
    assert len(pages) == 92
    ledger = {}
    for batch in "abc":
        text = (EVIDENCE / f"batch-{batch}.md").read_text()
        initial = text.split("## Authoritative audience amendment")[0]
        for line in initial.splitlines():
            if not line.startswith("| "):
                continue
            cells = [cell.strip().strip("`") for cell in line.split("|")[1:-1]]
            if cells and cells[0].endswith((".md", ".mdx")):
                assert cells[0] not in ledger, f"Duplicate {cells[0]}"
                ledger[cells[0]] = {"batch": batch, "reason": " ".join(cells[2:])}
        audience = text.split("## Authoritative audience amendment", 1)[1]
        reviewed = set()
        for line in audience.splitlines():
            cells = [cell.strip().strip("`") for cell in line.split("|")[1:-1]]
            if cells and cells[0] in ledger and ledger[cells[0]]["batch"] == batch:
                assert cells[0] not in reviewed, f"Duplicate audience review: {cells[0]}"
                reviewed.add(cells[0])
                ledger[cells[0]]["audience_reason"] = " ".join(cells[1:])
        assert reviewed == {name for name, row in ledger.items() if row["batch"] == batch}
    assert set(ledger) == {str(p.relative_to(DOCS)) for p in pages}
    destinations = sorted((ROOT / "docs/maintainer").rglob("*.md"))
    mapping = json.loads((EVIDENCE / "relocated-fences.json").read_text())
    mapped = {(row["source"], row["original_index"]): row for row in mapping}
    assert len(mapped) == len(mapping), "Duplicate fence custody mapping"
    used_mapping = set()
    public_count = 0
    coverage, literals, links = [], [], 0
    for page in pages:
        name = str(page.relative_to(DOCS))
        old, new = original(page), page.read_bytes().decode("utf-8")
        assert headings(old) == headings(new), f"Headings: {name}"
        assert ids(old) == ids(new), f"Explicit anchors: {name}"
        old_blocks, old_prose = split(old)
        new_blocks, new_prose = split(new)
        public = []
        for index, block in enumerate(old_blocks):
            relocation = mapped.get((name, index))
            if relocation:
                used_mapping.add((name, index))
                destination = ROOT / relocation["destination"]
                assert block in split(destination.read_bytes().decode("utf-8"))[0], f"Relocated fence: {name}:{index}"
            else:
                public.append(block)
        assert public == new_blocks, f"Ordered public fences: {name}"
        public_count += len(public)
        lost = sorted(inline_literals(old_prose) - inline_literals(new_prose))
        if lost:
            custody = {literal: [str(d.relative_to(ROOT)) for d in destinations if literal in d.read_text()] for literal in lost}
            literals.append({"page": name, "removed_from_public_prose": custody, "review": f"batch-{ledger[name]['batch']}.md authoritative audience amendment"})
        coverage.append({"page": name, "status": "revised" if old != new else "unchanged", **ledger[name], "audience_review": f"batch-{ledger[name]['batch']}.md"})
    for page in pages + destinations:
        for target in re.findall(r"\]\(([^\s)]+)\)", split(page.read_text())[1]):
            prefix = "https://github.com/bastani-inc/atomic/blob/main/"
            if target.startswith(prefix) and ("/maintainer/" in target or target[len(prefix):].startswith("docs/")):
                path, _, anchor = target[len(prefix):].partition("#")
                destination = ROOT / path
            elif page in destinations and not re.match(r"[a-z]+:|/", target):
                path, _, anchor = target.partition("#")
                destination = (page.parent / path).resolve() if path else page
            else:
                continue
            assert destination.exists(), f"Missing local target: {page}: {target}"
            if anchor:
                assert anchor in github_anchors(destination.read_text()), f"GitHub anchor: {page}: {target}"
            links += 1
    assert sum(row["status"] == "unchanged" for row in coverage) == 18
    assert len(mapping) == 16
    assert used_mapping == set(mapped), "Unused fence custody mapping"
    assert (DOCS / "changelog.mdx").read_bytes().decode("utf-8") == original(DOCS / "changelog.mdx")
    print(json.dumps({"baseline": BASE, "pages": coverage, "ordered_public_fences": public_count, "relocated_fences": len(mapping), "maintainer_links_checked": links, "inline_literal_review": literals}, indent=2))


if __name__ == "__main__":
    main()
