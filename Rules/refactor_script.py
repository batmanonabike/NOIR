"""
Noir Translation Cleanup Script
Applies formatting rules from refactor_translate.md to the translated Markdown file.
"""
import re, sys, pathlib

INPUT_FILE = pathlib.Path(r'c:\source\NOIR_03\Rules\Results\Claude.ai_artifact\noir_english.md')
OUTPUT_FILE = pathlib.Path(r'c:\source\NOIR_03\Rules\Results\Claude.ai_artifact\noir_english_refactor.md')

text = INPUT_FILE.read_text(encoding='utf-8')

# ── Rule 5: Normalize HTML page-marker comments to English ─────────────────
# text = re.sub(r'<!-- Sida (\d+) -->', r'<!-- Page \1 -->', text)
text = re.sub(r'[ \t]*<!-- (?:Sida|Page) \d+ -->[ \t]*\n?', '\n', text)

# ── Rule 4: Remove "NNchapter N – title" footer/header labels ─────────────
# e.g. "15chapter 1 – introduction", "38 chapter 2—The Protagonist"
text = re.sub(r'\n\d+[ \t]*chapter \d+[ \t]*[–—\-]+[ \t]*.+\n',
              '\n', text, flags=re.IGNORECASE)

# ── Rule 4: Remove lone stray page numbers (1-3 digit line, between content) ─
# Only remove when flanked by non-structure content lines
text = re.sub(r'\n(\d{1,3})\n\n', '\n\n', text)
text = re.sub(r'\n(\d{1,3})\n(?=[A-Z"\'«\*\[#>-])', '\n', text)

# ── Rule 6: Normalise chapter headings ────────────────────────────────────
# "## CHAPTER .N. SOME TITLE" → "## Chapter N – Some title"
def norm_chapter(m):
    num = m.group(1)
    words = m.group(2).strip().split()
    title = words[0].capitalize()
    if len(words) > 1:
        title += ' ' + ' '.join(w.lower() for w in words[1:])
    return f'## Chapter {num} – {title}'

text = re.sub(r'## CHAPTER \.\s*(\d+)\.\s+(.+)', norm_chapter, text)

# Standalone "Chapter .N. Title" (no ## prefix) → add ## prefix
def norm_chapter_standalone(m):
    num = m.group(1)
    words = m.group(2).strip().split()
    title = words[0].capitalize()
    if len(words) > 1:
        title += ' ' + ' '.join(w.lower() for w in words[1:])
    return f'\n## Chapter {num} – {title}\n'

text = re.sub(r'\nChapter \.\s*(\d+)\.\s+(.+)\n', norm_chapter_standalone, text)

# ── Rule 8: Fix dropped decorative initial capitals ────────────────────────
# Single uppercase letter on its own line, followed by lowercase continuation
text = re.sub(r'\n([A-Z])\n([a-z])', r'\n\1\2', text)

# ── Rule 7: Remove bold column-break artefacts ─────────────────────────────
# **text fragment** immediately followed by a lowercase continuation line
def fix_bold_artifact(m):
    fragment = m.group(1).strip()
    continuation = m.group(2)
    return f'{fragment} {continuation}'

text = re.sub(r'\*\*([^*\n]+)\*\*\n([a-z][^\n]+)', fix_bold_artifact, text)

# ── Rule 3: Join mid-sentence line breaks ──────────────────────────────────
# Lines ending with lowercase letter, comma, or semicolon, followed by
# a line starting with lowercase – are mid-sentence breaks from PDF columns.
# Multiple passes handle cascaded breaks.
for _ in range(8):
    prev = text
    text = re.sub(r'([a-z,;])\n([a-z])', r'\1 \2', text)
    if text == prev:
        break

# ── Rule 2: Fix Table of Contents dot leaders ──────────────────────────────
# "Entry text ........ 16" → "- Entry text"
def strip_toc_entry(m):
    entry = m.group(1).strip().rstrip('. ')
    return f'- {entry}'

# Lines with actual dot leaders (3+ dots or spaced dots) ending with a page num
text = re.sub(
    r'^(.+?)\s*(?:\.{3,}|(?:\. ){3,}\.?)\s*\d+\s*$',
    strip_toc_entry,
    text, flags=re.MULTILINE
)

# ── Rule 9: Replace GENERIC blank character sheet with notice ──────────────
# The generic sheet starts at "Story:\n\nName:\nConcept:" and runs until
# "**What Noir Is**"
START_GENERIC_SHEET = 'Story:\n\nName:\nConcept:'
END_GENERIC_SHEET   = '**What Noir Is**'
SHEET_NOTICE = (
    '> **Character Sheet** — *This section contains a fillable print '
    'character sheet. See the original PDF for the form layout.*\n\n'
)
p1 = text.find(START_GENERIC_SHEET)
p2 = text.find(END_GENERIC_SHEET)
if p1 != -1 and p2 != -1 and p1 < p2:
    text = text[:p1] + SHEET_NOTICE + text[p2:]

# ── Rule 9: Replace Gabriel's raw-numbers block (stat-box extraction) ──────
# Between "Become debt-free (Burning)" and "Lockpicking: Door locks"
GABRIEL_NUMS_START = 'Become debt-free (Burning)\n\n3\n'
GABRIEL_NUMS_END   = 'Lockpicking: Door locks (+2 Dexterity)'
GABRIEL_NUMS_NOTICE = (
    'Become debt-free (Burning)\n\n'
    '> **Character Sheet (stats)** — *Attribute and skill values extracted '
    'from the printed character sheet; see the original PDF for the complete '
    'stat block.*\n\n'
)
p3 = text.find(GABRIEL_NUMS_START)
p4 = text.find(GABRIEL_NUMS_END)
if p3 != -1 and p4 != -1 and p3 < p4:
    text = text[:p3] + GABRIEL_NUMS_NOTICE + text[p4:]

# ── Rule 9/10: Replace page-39 blank form section ──────────────────────────
# The blank form on page 39 (equipment fields, relationship table, defense)
# Starts at the SECOND blank weapons table header (after Rule 10 still matches it)
# and ends just before "in the evenings"
PAGE39_FORM_END = '\nin the evenings, several times a week, he trains at the gym'
p5 = text.find(PAGE39_FORM_END)
if p5 != -1:
    # Walk backward to find the blank weapons table header that precedes this
    weapons_header = '\n**Weapons**\nWeapon Draw Hit Damage Range Accuracy Recoil Conceal Malfunction Magazine\nUnarmed _____'
    p6 = text.rfind(weapons_header, 0, p5)
    if p6 != -1:
        FORM_NOTICE = (
            '\n> **Character Sheet (form fields)** — *This section contains '
            'the fillable equipment, relationship and combat stats form. '
            'See the original PDF for the form layout.*\n'
        )
        text = text[:p6] + FORM_NOTICE + text[p5:]

# ── Rule 10: Replace remaining blank weapons forms with notice ─────────────
BLANK_WEAPONS_NOTICE = '> **Weapons Table** — *This section contains a fillable weapons table. See the original PDF.*\n\n'
text = re.sub(
    r'\*\*Weapons\*\*\nWeapon Draw Hit Damage Range Accuracy Recoil Conceal '
    r'Malfunction Magazine\nUnarmed _____[^\n]*\n(?:_+[^\n]*\n?){2,}',
    BLANK_WEAPONS_NOTICE, text
)

# ── Rule 9: Replace second Gabriel stat dump (after "39chapter" label gone) ─
# The block: "+1 (Battle-hardened)6\n4\n..." before relationships
GABRIEL_STAT2_START = '\n+1 (Battle-hardened)6\n'
GABRIEL_STAT2_END   = 'Domenik "Manik" Jaeger Smuggler\n12\n'
STAT2_NOTICE = (
    '\n> **Character Sheet (compiled stat block)** — *Derived stats and '
    'secondary attributes extracted from the printed character sheet; '
    'see the original PDF.*\n\n'
)
p7 = text.find(GABRIEL_STAT2_START)
p8 = text.find(GABRIEL_STAT2_END)
if p7 != -1 and p8 != -1 and p7 < p8:
    text = text[:p7] + STAT2_NOTICE + text[p8:]

# ── Rule 10: Convert Gabriel's real weapons to a Markdown table ─────────────
# Replace the raw weapon lines with a proper Markdown table
GABRIEL_WEAPONS_RAW = (
    'Domenik "Manik" Jaeger Smuggler\n12\n'
    '**Dr Yannik Reasescu Private Doctor**\n9\n'
    '**Talia Navarre Society Woman**\n9\n'
    'Calder M2245 16 15 2D+1 10–50m +2 4E +4 1 8+1\n'
    'Calder M2245 16 15 2D+1 10–50m +2 4E +4 1 8+1\n'
    'R&S .38 Snub 12 13 2D−1 5–20m +1 3E +12 1 5r\n'
    'Rais H100 Pump. — 13 S5D−4(S2D−1) 10–30m +4 4E −7 1 5i\n'
    '7 B1D+3\n'
)
GABRIEL_WEAPONS_TABLE = (
    '**Relationships**\n\n'
    '| Name/Concept | Influence | Relationship |\n'
    '|---|---|---|\n'
    '| Domenik "Manik" Jaeger, smuggler | 12 | Favorable |\n'
    '| Dr. Yannik Reasescu, private doctor | 9 | Neutral |\n'
    '| Talia Navarre, society woman | 9 | Hostile (Attraction) |\n\n'
    '**Weapons**\n\n'
    '| Weapon | Draw | Hit | Damage | Range | Accuracy | Recoil | Conceal | Malfunction | Magazine |\n'
    '|---|---|---|---|---|---|---|---|---|---|\n'
    '| Calder M2245 | 16 | 15 | 2D+1 | 10–50m | +2 | 4E | +4 | 1 | 8+1 |\n'
    '| Calder M2245 | 16 | 15 | 2D+1 | 10–50m | +2 | 4E | +4 | 1 | 8+1 |\n'
    '| R&S .38 Snub | 12 | 13 | 2D−1 | 5–20m | +1 | 3E | +12 | 1 | 5r |\n'
    '| Rais H100 Pump | — | 13 | S5D−4 (S2D−1) | 10–30m | +4 | 4E | −7 | 1 | 5i |\n'
    '| Unarmed | — | 7 | B1D+3 | — | — | — | — | — | — |\n\n'
)
text = text.replace(GABRIEL_WEAPONS_RAW, GABRIEL_WEAPONS_TABLE)

# ── Fix hyphenated word-wrap breaks from PDF columns ─────────────────────
# e.g.  "anti-\nheroes" → "anti-heroes"
text = re.sub(r'-\n([a-z])', r'-\1', text)

# ── Extra TOC pass: clean up remaining section headings with page numbers ──
# Applied only within the TOC region (before the opening fiction epigraph).
toc_end_marker = '"This must be the place I\'ve always wanted to leave."'
toc_end_pos = text.find(toc_end_marker)
if toc_end_pos != -1:
    toc_section = text[:toc_end_pos]

    # Join split TOC entries where a line ends with a word and the next
    # starts with "&", "and", or a lowercase word (continuation of the title)
    toc_section = re.sub(r'\n([^#\-\*\n][^\n]+)\n(&\s)', r' \1 \2', toc_section)

    # Remove "THE ARCHIVE" all-caps heading, replace with a proper heading
    toc_section = toc_section.replace('\nTHE ARCHIVE\n', '\n## The archive\n')

    # Convert remaining "Title text NNN" lines to "- Title text"
    # Skip lines already starting with -, #, *, or blank, or inside code blocks
    def toc_entry_to_bullet(m):
        title = m.group(1).strip().rstrip('. ')
        return f'- {title}'

    toc_section = re.sub(
        r'^(?![ \t]*[-#*\|`]|[ \t]*$)([A-Za-z"&\'][^\n]+?)\s+\d{1,3}\s*$',
        toc_entry_to_bullet,
        toc_section,
        flags=re.MULTILINE
    )

    # Fix any remaining " . NN" or ". NN" trailing on bullet lines
    toc_section = re.sub(r'^(- .+?)\s*\.\s*\d{1,3}\s*$', r'\1', toc_section, flags=re.MULTILINE)

    text = toc_section + text[toc_end_pos:]

# ── Fix archive illustration index formatting ──────────────────────────────
# Convert **Table of Contents** and **Illustration Index** to proper headings
text = text.replace('\n**Table of Contents**\n', '\n\n### Table of Contents\n\n')
text = text.replace('\n**Illustration Index**\n', '\n\n### Illustration Index\n\n')

# ── Rule 17: Promote standalone bold headings to ### subheadings ───────────
# **Heading** preceded by a blank line → ### Heading (with blank lines around it).
# This converts section headings like **What Noir Is** and **Sandukar** that
# were bolded but not given a heading level by the translator.
# Skipped when the heading is immediately followed by another bold line
# (which indicates a credits/label list rather than a section heading).
text = re.sub(
    r'\n\n\*\*([^*\n]+)\*\*\n\n?(?=\S)',
    lambda m: f'\n\n### {m.group(1)}\n\n',
    text
)

# Known plain-text subsection headings that weren't bolded in the source
# and so weren't caught by the rule above — add heading markup and spacing.
PLAIN_HEADINGS = [
    'Mood & Setup', 'Realism',
]
for h in PLAIN_HEADINGS:
    text = re.sub(
        r'\n(' + re.escape(h) + r')\n',
        f'\n\n### {h}\n\n',
        text
    )

# ── Fix character stat blocks formatting ───────────────────────────────────
# Add blank lines around stat block subheadings for proper Markdown rendering
# (Limitations, Traits, Characteristics, Relationships sections)
STAT_SUBHEADINGS = ['Limitations', 'Traits', 'Characteristics', 'Relationships']
for heading in STAT_SUBHEADINGS:
    # Add blank line before the heading if not already present
    text = re.sub(
        r'([^\n])\n(\*\*' + re.escape(heading) + r'\*\*)\n',
        r'\1\n\n\2\n\n',
        text
    )
    # Also handle cases where it's already on its own line but needs spacing after
    text = re.sub(
        r'\n(\*\*' + re.escape(heading) + r'\*\*)\n([^\n])',
        r'\n\1\n\n\2',
        text
    )

# ── Convert stat list items to bullet format ──────────────────────────────
# Lines like "Item [X points]" or "Item: Description [X points]" → "- Item [X points]"
# Match lines that contain [...points] or [...point] (may have "extra" before "points")
text = re.sub(
    r'^([A-Za-z][^:\n]*(?::\s*[^\[]+?)?\s*\[\d+\s*(?:extra\s+)?points?\s*\])\s*$',
    r'- \1',
    text,
    flags=re.MULTILINE
)

# ── Rule 16: Replace angle-bracket placeholders with parentheses ──────────
# Markdown parses <tag> as HTML, causing everything after to render as a link.
text = re.sub(r'<([^>]+)>', lambda m: '(' + m.group(1) + ')', text)

# ── Rule 11: Collapse excessive blank lines ────────────────────────────────
text = re.sub(r'\n{3,}', '\n\n', text)

# ── Final tidy: strip trailing spaces from lines ──────────────────────────
# text = re.sub(r'[ \t]+\n', '\n', text)

OUTPUT_FILE.write_text(text, encoding='utf-8')
print(f"Refactoring complete. Output written to: {OUTPUT_FILE.name}")
