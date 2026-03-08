# Converting Noir English Translation to PDF

This guide explains how to convert `noir_english_refactor.md` to PDF using Pandoc and your web browser.

## Why This Approach?

Pandoc's direct PDF conversion requires additional engines (pdflatex, wkhtmltopdf, etc.) which may not be installed. This method uses what you already have: Pandoc, a web browser, and Windows' built-in PDF printer.

## Prerequisites

- **Pandoc** (already installed)
- Any modern web browser (Chrome, Edge, Firefox)
- Windows built-in "Microsoft Print to PDF"

## Steps

### 1. Convert Markdown to HTML

Open PowerShell and run:

```powershell
cd "c:\source\NOIR_03\Rules\Results\Claude.ai_artifact"

pandoc noir_english_refactor.md -o noir_english_refactor.html --standalone --css=https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css
```

**What this does:**
- `--standalone` creates a complete HTML document with proper headers
- `--css=...` applies GitHub-style markdown formatting for better readability

### 2. Open HTML in Browser

```powershell
Start-Process noir_english_refactor.html
```

Or manually open `noir_english_refactor.html` in your preferred browser.

### 3. Print to PDF

1. Press **`Ctrl+P`** (or go to File → Print)
2. Select **"Microsoft Print to PDF"** or **"Save as PDF"** as the printer
3. Adjust settings:
   - **Layout**: Portrait (recommended)
   - **Margins**: Default or Custom (adjust as needed)
   - **Scale**: 100% or "Fit to page"
   - **Background graphics**: Check this box to include table borders
4. Click **Print** or **Save**
5. Choose location and filename: `noir_english_refactor.pdf`

## Tips for Better PDF Output

### Adjust Margins
For more content per page, set smaller margins:
- Top/Bottom: 0.3 inches
- Left/Right: 0.3 inches

### Enable Background Graphics
This ensures table borders and other styling elements appear in the PDF.

### Page Breaks
If tables or sections split awkwardly, you can add custom CSS to the HTML file before printing. Edit `noir_english_refactor.html` and add this in the `<style>` section:

```css
table { page-break-inside: avoid; }
h2, h3 { page-break-after: avoid; }
```

## Alternative: Install PDF Engine (Optional)

If you prefer direct PDF conversion, install wkhtmltopdf:

```powershell
# Download installer
Invoke-WebRequest -Uri "https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6-1/wkhtmltox-0.12.6-1.msvc2015-win64.exe" -OutFile "$env:TEMP\wkhtmltopdf.exe"

# Run installer
Start-Process "$env:TEMP\wkhtmltopdf.exe" -Wait

# Convert directly to PDF
pandoc noir_english_refactor.md -o noir_english_refactor.pdf --pdf-engine=wkhtmltopdf
```

## Files

- **noir_english.md** - Combined source from 4 translation chunks
- **noir_english_refactor.md** - Formatted version with tables, proper spacing, etc.
- **refactor_script.py** - Python script that applies 20+ formatting rules
- **refactor_translate.md** - Documentation of formatting rules

## Formatting Applied

The refactored markdown includes:
- ✓ Normalized page markers (Sida → Page)
- ✓ Properly formatted character stat blocks
- ✓ Expertise reference tables (converted from inline text)
- ✓ Proficiency tables (Markdown format)
- ✓ Game dialogue formatting (bold speaker names)
- ✓ Fixed mid-sentence line breaks
- ✓ Archetype lists (nature/occupation as bullets)
- ✓ Proper spacing throughout

Total rules applied: 20+ formatting transformations
