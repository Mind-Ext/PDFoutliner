
### PDFoutliner

Automatically extract outline from software-generated PDF based on layout and text styles

[![](https://flat.badgen.net/npm/v/pdfoutliner?color=485d92)](https://www.npmjs.com/package/pdfoutliner)

#### CLI
```sh
# Requires Node 20+
npm install -g pdfoutliner
pdfoutliner -h
# Install globally and see options
# Alternatively run `npx pdfoutliner -h` without installation
```


```sh
pdfoutliner example.pdf
# outline will be added to new file example_outlined.pdf
```


```sh
pdfoutliner example.pdf -o txt
pdfoutliner example.pdf --fromtxt
# first save outline to example_outline.txt for manual edit
# then add outline from txt file to pdf
```


#### Web

[**Demo**](https://mind-ext.github.io/PDFoutliner)

(Work in progress. Seem to have issue on large files.)

#### Motivation

Some scientific papers (particularly preprints) don't include outline in the PDF, making it inconvenient to jump between sections. This tool analyzes the layout of the document and extracts certain text as outline based on some heuristics. The result may not be perfect, but can still be useful. 

It only works on software-generated PDF and does not support scanned PDF. It is primarily tested on papers (see `example` folder for some open access ones), but may also work on longer documents such as books.

A Zotero plugin was originally planned, but a similar feature has been built into Zotero.

#### Other tools with similar functionality

- Google Scholar PDF Reader (not written to file)
- Zotero 7 (not written to file)
- github.com/hueyy/pdf_scout (an inspiration)
- github.com/cdevereaux/automatic_pdf_outline (semi-automatic)
- Some PDF suites maybe

<img src='https://count.lnfinite.space/repo/pdfoutliner.svg?plus=1' width='0' height='0' />