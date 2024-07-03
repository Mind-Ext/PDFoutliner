import fs from 'fs'
import { expect, test } from 'vitest'
import * as mupdf from '../mupdf/mupdf.js'
import { findOutline } from '../shared/algo.ts'
import { outlineToStr } from '../shared/util.ts'

export function snapshotTest(testFileDir = '../example') {
  for (const file of fs.readdirSync(testFileDir)) {
    if (file.endsWith('.txt') || file.endsWith('_outlined.pdf')) continue
    const filePath = `${testFileDir}/${file}`
    const fileName = file.slice(0, -4)
    const outlinePath = `${testFileDir}/${fileName}_outline.txt`
    if (!fs.existsSync(outlinePath)) {
      console.log('Not found:', outlinePath)
      continue
    }
    test(fileName, async () => {
      const doc = mupdf.Document.openDocument(
        fs.readFileSync(filePath),
        'application/pdf'
      )
      const outline = findOutline(doc)
      const outlineStr = outlineToStr(outline)
      await expect(outlineStr).toMatchFileSnapshot(outlinePath)
    })
  }
}

snapshotTest()
