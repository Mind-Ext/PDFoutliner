#!/usr/bin/env node

import fs from 'fs'
import { program } from 'commander'
import * as mupdf from '../mupdf/mupdf.js'
import { logger, setVerbosity } from '../shared/logging.js'
import { findOutline, OutlineItem, updateParams } from '../shared/algo.ts'
import {
  outlineToStr,
  parseOutlineStr,
  getOutline,
  setOutline,
} from '../shared/util.ts'

const MARK_TEXT = 'Added by PDFoutliner'

program
  .name('pdfoutliner')
  .argument('<inputFile>', 'input PDF file path')
  .argument(
    '[outputFile]',
    'output file path (default to {inputFileName}_outlined.pdf)',
  )
  .option('-o, --output <format>', 'output format (pdf, txt, stdout)', 'pdf')
  .option(
    '--ignore-existing',
    'extract outline even if it already exists in the PDF'
  )
  .option(
    '--fromtxt [tocFile]',
    'add outline from text file to pdf (default to the FILENAME_outlined.txt)'
  )
  .option(
    '-p, --params <params>',
    'set parameters in the algorithm using comma separated key-value pairs e.g. -p MAX_LEVELS=1',
  )
  .option('--mark', `include "${MARK_TEXT}" as the first outline item`)
  .option('--verbosity <level>', 'set verbosity level', 'LOG')
  .action(main)

if (process.env.NODE_ENV !== 'test') {
  program.parse()
}

export function main(inputFile, outputFile, options) {
  setVerbosity(options.verbosity)

  if (!inputFile.toLowerCase().endsWith('.pdf')) {
    logger.error('Input file must have .pdf extension')
    process.exit(1)
  }

  if (options.params) {
    for (const kv of options.params.split(',')) {
      const [k, v] = kv.split('=')
      updateParams({ [k]: parseFloat(v) })
    }
  }

  const file = fs.readFileSync(inputFile)
  const doc = mupdf.Document.openDocument(file, 'application/pdf')
  const existingOutline = getOutline(doc)

  let outline
  if (existingOutline.length && !options.ignoreExisting) {
    logger.log('Outline already exists in input PDF; using it')
    outline = existingOutline
  } else if (existingOutline.length && options.ignoreExisting) {
    logger.log('Outline already exists in input PDF; ignoring it')
    outline = findOutline(doc)
  } else if (options.fromtxt) {
    const tocFile =
    options.fromtxt === true
    ? `${inputFile.slice(0, -4)}_outline.txt`
    : options.fromtxt
    logger.log(`Using outline from ${tocFile}`)
    outline = parseOutlineStr(fs.readFileSync(tocFile, 'utf-8'))
  } else {
    outline = findOutline(doc)
  }

  if (options.mark) {
    outline.unshift(new OutlineItem(1, MARK_TEXT, 0))
  }

  if (options.output === 'txt') {
    if (outputFile && !outputFile.endsWith('.txt')) {
      outputFile = `${outputFile}.txt`
    }
    const outputTxtPath = outputFile || `${inputFile.slice(0, -4)}_outline.txt`
    fs.writeFileSync(outputTxtPath, outlineToStr(outline))
    logger.log(
      `${
        existingOutline.length ? 'Existing' : 'Extracted'
      } outline saved to ${outputTxtPath}`
    )
  }
  if (options.output === 'stdout') {
    console.log(outlineToStr(outline))
  }

  if (options.output === 'pdf') {
    if (existingOutline.length && !options.ignoreExisting) {
      logger.log('Nothing to do')
      return
    }
    setOutline(doc, outline)
    const outputPdfPath = outputFile || `${inputFile.slice(0, -4)}_outlined.pdf`
    // @ts-ignore
    fs.writeFileSync(outputPdfPath, doc.saveToBuffer().asUint8Array())
    logger.log(`Saved to ${outputPdfPath}`)
  }
}
