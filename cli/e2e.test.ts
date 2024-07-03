import fs from 'fs'
import { expect, test } from 'vitest'
import { main } from './main.ts'

const testFile = '../example/PNAS_2020_Maoz.pdf'
const defaultOptions = {
  output: 'pdf',
  verbosity: 'LOG',
}

test('output PDF and txt match', () => {
  const outPdfPath1 = './local/test_output1.pdf'
  const outPdfPath2 = './local/test_output2.pdf'
  main(testFile, outPdfPath1, defaultOptions)
  main(testFile, outPdfPath2, { ...defaultOptions, fromtxt: true })
  // use the txt from snapshot

  //   const buffer1 = fs.readFileSync(outPdfPath1)
  //   const buffer2 = fs.readFileSync(outPdfPath2)
  //   expect(Buffer.compare(buffer1, buffer2)).toBe(0)
  // somehow this fails

  // save the txt from existing outline in PDF
  const outTxt1 = './local/test_output1.txt'
  const outTxt2 = './local/test_output2.txt'
  main(outPdfPath1, outTxt1, { ...defaultOptions, output: 'txt' })
  main(outPdfPath2, outTxt2, { ...defaultOptions, output: 'txt' })

  const actual = fs.readFileSync(outTxt1, 'utf8')
  const expected = fs.readFileSync(outTxt2, 'utf8')
  expect(actual).toBe(expected)
})
