import { logger } from './logging'
import * as util from './util'
import {
  StyleGroups,
  FontStyle,
  PageDict,
  MySpan,
  OutlineItem as OutlineItemType,
  Block,
  Span,
} from './types.ts'
// length unit is pt (1/72 inch, ~ 0.35 mm)

const params = {
  MAX_LEVELS: 3,

  TOL_BIN_SIZE: 6, // tolerance of alignment
  TOL_JOIN_SPAN: 24, // tolerance of joining spans with same style on same line
  ALIGN_DECAY_RATE: 0.5,
  ALIGN_LEFT_RATIO: 0.6,
  ALIGN_MID_RATIO: 0.6,
  // filter
  FILTER_FONTSIZE_SMALLER: 2.1,
  FILTER_TEXT_AVG_LEN: 2,
  FILTER_MIN_SPANS_PER_GROUP: 3,
  FILTER_MAX_SPANS_PER_PAGE: 10,
  // extra
  SPLIT_GROUP_RATIO: 0.3,
}

export function updateParams(newParams) {
  Object.assign(params, newParams)
}

class TextStyle {
  name: string
  family: string
  weight: string
  style: string
  color: string
  size: number
  constructor(font: FontStyle) {
    this.name = font.name
    this.family = font.family // serif, sans-serif, monospace
    this.weight = font.weight // normal, bold
    this.style = font.style // normal, italic
    this.size = font.size
    this.color = font.color.toString(16).padStart(6, '0')
  }

  toString() {
    let styleStr = ''
    if (this.family === 'sans-serif') {
      styleStr += 'Sa'
    }
    if (this.family === 'monospace') {
      styleStr += 'Mo'
    }
    if (this.weight === 'bold') {
      styleStr += 'Bo'
    }
    if (this.style === 'italic') {
      styleStr += 'It'
    }
    styleStr = `${this.size}_${this.name}_${styleStr}_${this.color}`
    return styleStr
  }
}

class OutlineItem implements OutlineItemType {
  constructor(
    public level: number,
    public text: string,
    public page: number,
    public x?: number,
    public y?: number
  ) {}
}

class Column {
  constructor(
    public xLeftBin: number,
    public xMidBin: number,
    public x0?: number,
    public x1?: number,
    public y0?: number,
    public y1?: number
  ) {}
  toString() {
    return `(l=${this.xLeftBin},m=${this.xMidBin})`
  }
}

function _processSpans(spans: Array<Span>) {
  const processedSpans = []
  const blockStyles = new Map()

  for (const span of spans) {
    const styleStr = new TextStyle(span.font).toString()
    const spanCurr = {
      styleStr: styleStr,
      text: span.text,
      ...span.bbox, // x, y, w, h
    }
    if (!blockStyles.has(styleStr)) {
      blockStyles.set(styleStr, 0)
    }
    blockStyles.set(
      styleStr,
      blockStyles.get(styleStr) + spanCurr.w * spanCurr.h
    )
    const spanPrev = processedSpans[processedSpans.length - 1]
    if (
      spanPrev &&
      spanPrev.styleStr === spanCurr.styleStr &&
      spanPrev.y === spanCurr.y &&
      spanPrev.h === spanCurr.h &&
      spanPrev.x + spanPrev.w + params.TOL_JOIN_SPAN >= spanCurr.x
    ) {
      // join adjacent spans instead of adding new one
      spanPrev.text += ' ' + spanCurr.text
      spanPrev.w = spanCurr.x + spanCurr.w - spanPrev.x
      continue
    } else {
      processedSpans.push(spanCurr)
    }
  }
  const [mainStyle, mainStyleArea] = util.findMaxKV(blockStyles)

  return [processedSpans, mainStyle]
}

function groupTextByStyle(pageDicts): StyleGroups {
  const styleGroups = new Map()

  for (let iPage = 0; iPage < pageDicts.length; iPage++) {
    const pageDict = pageDicts[iPage]
    for (let iBlock = 0; iBlock < pageDict.blocks.length; iBlock++) {
      const block = pageDict.blocks[iBlock]
      let iSpan = 0

      // here "block.lines" are actully spans because of "preserve-spans"
      const [spans, mainStyle] = _processSpans(block.lines)
      block.spans = spans
      delete block.lines

      for (const span of block.spans) {
        span.iPage = iPage
        span.iBlock = iBlock
        span.iSpan = iSpan
        if (!styleGroups.has(span.styleStr)) {
          styleGroups.set(span.styleStr, [])
        }
        styleGroups.get(span.styleStr).push(span)
        iSpan++
      }

      block.mainStyleStr = mainStyle
      const ys = new Set(Array.from(block.spans, (span: MySpan) => span.y))
      block.nLines = ys.size
    }
  }
  return styleGroups
}

function findColumns(pageDicts: Array<PageDict>): Array<Column> {
  const columnMap = new Map()

  for (const pageDict of pageDicts) {
    for (const block of pageDict.blocks) {
      if (block.nLines < 5) continue
      const xLeft = block.bbox.x
      const xMid = Math.round(block.bbox.x + block.bbox.w / 2)
      const xLeftBin = util.roundToBin(xLeft, params.TOL_BIN_SIZE)
      const xMidBin = util.roundToBin(xMid, params.TOL_BIN_SIZE)
      const column = new Column(xLeftBin, xMidBin)
      const columnStr = column.toString()

      const currColumn = columnMap.get(columnStr)?.column
      if (currColumn) {
        column.x0 = Math.min(block.bbox.x, currColumn.x0)
        column.x1 = Math.max(block.bbox.w + block.bbox.x, currColumn.x1)
        column.y0 = Math.min(block.bbox.y, currColumn.y0)
        column.y1 = Math.max(block.bbox.h + block.bbox.y, currColumn.y1)
      } else {
        column.x0 = block.bbox.x
        column.x1 = block.bbox.w + block.bbox.x
        column.y0 = block.bbox.y
        column.y1 = block.bbox.h + block.bbox.y
      }

      columnMap.set(columnStr, {
        column,
        totalSize:
          block.bbox.w * block.bbox.h + columnMap.get(columnStr)?.totalSize ||
          0,
      })
    }
  }

  const columnLengthsItems = Array.from(columnMap.values()).sort(
    (a, b) => b.totalSize - a.totalSize
  )
  // find largest aligned columns
  const columns = [columnLengthsItems[0].column]
  let iCol = 1
  while (
    iCol < columnLengthsItems.length &&
    columnLengthsItems[iCol].totalSize >
      params.ALIGN_DECAY_RATE * columnLengthsItems[iCol - 1].totalSize
  ) {
    columns.push(columnLengthsItems[iCol].column)
    iCol++
  }
  columns.sort((a, b) => a.xLeftBin - b.xLeftBin)
  logger.info(`${columns.length} aligned columns ${columns}`)
  return columns
}

function passSpanFilters(span: MySpan, filters: { [key: string]: Function }) {
  for (const [name, filter] of Object.entries(filters)) {
    if (filter(span)) {
      return false
    }
  }
  return true
}

function filterSpansPre(styleGroups, columns) {
  const xLeft = columns.map((col) => col.x0).reduce((a, b) => Math.min(a, b))
  const xRight = columns.map((col) => col.x1).reduce((a, b) => Math.max(a, b))
  const yTop = columns.map((col) => col.y0).reduce((a, b) => Math.min(a, b))
  const yBottom = columns.map((col) => col.y1).reduce((a, b) => Math.max(a, b))
  logger.info(`main box x=[${xLeft},${xRight}] y=[${yTop},${yBottom}]`)
  const spanFilters = {
    spanInMargin: function (span) {
      return (
        span.x < xLeft - params.TOL_BIN_SIZE ||
        span.x + span.w > xRight + params.TOL_BIN_SIZE ||
        span.y < yTop - params.TOL_BIN_SIZE ||
        span.y + span.h > yBottom + params.TOL_BIN_SIZE
      )
    },
  }
  for (const [style, spans] of styleGroups) {
    const filteredSpans = spans.filter((span) =>
      passSpanFilters(span, spanFilters)
    )
    if (filteredSpans.length < spans.length) {
      logger.debug(
        `Pre-filtered ${style} from ${spans.length} to ${filteredSpans.length}`
      )
      styleGroups.set(
        style,
        spans.filter((span) => passSpanFilters(span, spanFilters))
      )
    }
  }
}

function findAlignedGroups(styleGroups: StyleGroups, columns) {
  const alignedBinsLeft = columns.map((col) => col.xLeftBin)
  const alignedBinsMid = columns.map((col) => col.xMidBin)

  const outlineGroups = new Map()
  const alignmentScores = new Map()

  for (const [style, spans] of styleGroups) {
    // find which column the span is closest to
    const leftDists: Array<number> = []
    const midDists: Array<number> = []

    for (const span of spans) {
      const [dLeft, iLeft] = util.findAbsMinDist(
        util.roundToBin(span.x, params.TOL_BIN_SIZE),
        alignedBinsLeft
      )
      const [dMid, iMid] = util.findAbsMinDist(
        util.roundToBin(span.x + span.w / 2, params.TOL_BIN_SIZE),
        alignedBinsMid
      )
      span.iCol = dLeft < dMid ? iLeft : iMid
      leftDists.push(dLeft)
      midDists.push(dMid)
    }

    const dLeftMode = util.findMode(leftDists)
    const dMidMode = util.findMode(midDists)
    // if aligned, spans should have consistent distance
    // to the reference (left or middle of column)

    const leftAlignedRatio =
      leftDists.filter((d) => d === dLeftMode).length / spans.length
    const midAlignedRatio =
      midDists.filter((d) => d === dMidMode).length / spans.length

    alignmentScores.set(style, Math.max(leftAlignedRatio, midAlignedRatio))

    if (
      leftAlignedRatio > params.ALIGN_LEFT_RATIO ||
      midAlignedRatio > params.ALIGN_MID_RATIO
    ) {
      // keep only the aligned spans
      outlineGroups.set(
        style,
        spans.filter(
          (span, i) => leftDists[i] === dLeftMode || midDists[i] === dMidMode
        )
      )
      logger.debug(
        `Style ${style}  ${
          outlineGroups.get(style).length
        } spans, align l=${leftAlignedRatio.toFixed(
          2
        )} m=${midAlignedRatio.toFixed(2)}`
      )
    }
  }

  logger.info(
    `${outlineGroups.size} of ${styleGroups.size} style groups aligned`
  )
  return [outlineGroups, alignmentScores]
}

/**
 * filter out groups that are unlikely to be headings
 */
function filterGroups(styleGroups: StyleGroups, pageDicts, alignmentScores) {
  const styleGroupLengths = new Map(
    Array.from(styleGroups).map(([k, v]) => [k, v.length])
  )
  const [mainStyle, _mainGroupArea] = util.findMaxKV(styleGroupLengths)
  const mainFontSize = Number(mainStyle.split('_')[0])
  const filters = {
    tooFewLines: (style, group) => {
      if (group.length > 1 && alignmentScores.get(style) === 1) return false
      return group.length < params.FILTER_MIN_SPANS_PER_GROUP
    },
    tooManyLines: (style, group) => {
      // too many spans on one page
      const counts = {}
      for (const span of group) {
        let count = (counts[span.iPage] || 0) + 1
        if (count > params.FILTER_MAX_SPANS_PER_PAGE) {
          return true
        }
        counts[span.iPage] = count
      }
      return false
    },
    textTooSmall: (style, group) => {
      const size = Number(style.split('_')[0])
      return size < mainFontSize - params.FILTER_FONTSIZE_SMALLER
    },
    textTooShort: (style, group) => {
      // e.g. figure label
      const avgLen = group.reduce((a, b) => a + b.text.length, 0) / group.length
      return avgLen < 2
    },
  }
  const nPre = styleGroups.size
  for (const [style, group] of styleGroups) {
    for (const [name, filter] of Object.entries(filters)) {
      if (filter(style, group)) {
        styleGroups.delete(style)
        logger.debug(`Style: ${style}, Spans: ${group.length}, Filter: ${name}`)
        break
      }
    }
  }
  logger.info(`${styleGroups.size} of ${nPre} style groups after group filter`)
  for (const [style, group] of styleGroups) {
    logger.debug(`Style: ${style}, Spans: ${group.length}`)
  }
}

function _joinSpanLines(style, spans, pageDicts) {
  const joinedSpans = []
  const seenSpans = new Set()
  for (const span of spans) {
    const key = `${span.iPage}_${span.iBlock}_${span.iSpan}`
    if (seenSpans.has(key)) {
      continue
    }
    const block = pageDicts[span.iPage].blocks[span.iBlock]
    // join multi-line headings
    for (let i = span.iSpan + 1; i < block.spans.length; i++) {
      const nextSpan = block.spans[i]
      if (nextSpan.styleStr !== style) {
        break
      }
      span.text = span.text + ' ' + nextSpan.text
      span.w = Math.max(span.w, nextSpan.w)
      span.h = nextSpan.y - span.y + nextSpan.h
      seenSpans.add(`${nextSpan.iPage}_${nextSpan.iBlock}_${nextSpan.iSpan}`)
    }
    joinedSpans.push(span)
    seenSpans.add(key)
  }
  return joinedSpans
}

function _splitAllCapGroups(outlineGroups) {
  const allCapGroups = new Map()
  for (const [style, spans] of outlineGroups) {
    const allCapSpans: Array<MySpan> = []
    const normalSpans: Array<MySpan> = []
    for (const span of spans) {
      if (span.text.length > 5 && span.text === span.text.toUpperCase()) {
        // param, prevent abbreviations being counted
        allCapSpans.push(span)
      } else {
        normalSpans.push(span)
      }
    }
    // param, % of the spans must be all caps to be split
    const allCapRatio = allCapSpans.length / spans.length
    if (allCapRatio === 1) {
      // all all-caps, no need to split
      continue
    } else if (allCapRatio > params.SPLIT_GROUP_RATIO) {
      // split into all-caps and normal
      outlineGroups.set(style, normalSpans)
      const newStyle = style + '_allCap'
      logger.info(
        `add group ${newStyle}, ${allCapSpans.length} spans out of ${spans.length}`
      )
      allCapGroups.set(newStyle, allCapSpans)
    }
  }
  for (const [style, spans] of allCapGroups) {
    outlineGroups.set(style, spans)
  }
}

function _splitInlineGroups(outlineGroups, pageDicts) {
  const newGroups = new Map()

  for (const [style, spans] of outlineGroups) {
    const blockSpans: Array<MySpan> = []
    // block only consist this style
    const sepLineSpans: Array<MySpan> = []
    // block contains other styles, but in different lines
    // sometimes same level of headings can be block or sep-line
    const inlineSpans: Array<MySpan> = []
    // block contains other styles
    for (const span of spans) {
      const block = pageDicts[span.iPage].blocks[span.iBlock]
      if (block.mainStyleStr === style) {
        blockSpans.push(span)
      } else {
        let isInline = false
        for (const blockSpan of block.spans) {
          if (
            blockSpan.iSpan !== span.iSpan &&
            Math.abs(blockSpan.y - span.y) < params.TOL_BIN_SIZE
          ) {
            inlineSpans.push(span)
            isInline = true
            break
          }
        }
        if (!isInline) {
          sepLineSpans.push(span)
        }
      }
    }
    // if (sepLineSpans.length === 1) {
    //   // could be chance
    //   inlineSpans.push(sepLineSpans.pop())
    // }
    const standaloneSpans = blockSpans.concat(sepLineSpans)
    if (inlineSpans.length > 0 && inlineSpans.length < spans.length) {
      const newStyleStr = style + '_inline'
      newGroups.set(newStyleStr, inlineSpans)
      outlineGroups.set(style, standaloneSpans)
    }
  }
  for (const [style, spans] of newGroups) {
    outlineGroups.set(style, spans)
  }
}

function processStyleGroups(outlineGroups, pageDicts) {
  for (const [style, spans] of outlineGroups) {
    outlineGroups.set(style, _joinSpanLines(style, spans, pageDicts))
  }

  _splitInlineGroups(outlineGroups, pageDicts)

  _splitAllCapGroups(outlineGroups)
}

function filterSpansPost(outlineGroups, pageDicts, columns) {
  const spanFilters = {
    spanNotAtBeginnig: function (span) {
      // false positive when inline heading is in the middle of a block
      return span.iSpan > 0
    },
    mainSpanInLargeBlock: function (span) {
      const MAX_LINES = 3
      const block = pageDicts[span.iPage].blocks[span.iBlock]
      return span.styleStr === block.mainStyleStr && block.nLines > MAX_LINES
    },
  }
  const nPre = outlineGroups.size
  for (const [style, spans] of outlineGroups) {
    outlineGroups.set(
      style,
      spans.filter((span) => passSpanFilters(span, spanFilters))
    )
    if (outlineGroups.get(style).length < params.FILTER_MIN_SPANS_PER_GROUP) {
      outlineGroups.delete(style)
    }
  }
  logger.info(`${outlineGroups.size} of ${nPre} style groups after span filter`)
}

function structureOutline(outlineGroups) {
  const outlineSpans: Array<MySpan> = []

  for (const [style, spans] of outlineGroups) {
    for (const span of spans) {
      span.styleStr = style
      outlineSpans.push(span)
    }
  }

  outlineSpans.sort((a, b) => {
    if (a.iPage !== b.iPage) {
      return a.iPage - b.iPage
    }
    if (a.iCol !== b.iCol) {
      return a.iCol - b.iCol
    }
    return a.y - b.y
  })

  // TODO maybe process outlineGroups based on regex,
  // e.g. ([0-9]+|[A-Z])\. like 1.2 / A.3 / I,II,III

  const outline: Array<OutlineItem> = []
  const levels = {}
  let level = 1
  for (const span of outlineSpans) {
    if (!(span.styleStr in levels)) {
      levels[span.styleStr] = level
      level++
    }
    outline.push(
      new OutlineItem(
        levels[span.styleStr],
        span.text,
        span.iPage + 1,
        span.x,
        span.y
      )
    )
  }
  // console.log(JSON.stringify(levels, null, 2))
  // ensure if level decrease, only decrease by 1 (i.e. tree)
  let i = 0
  let prevLevel = 0
  while (i < outline.length) {
    const item = outline[i]
    if (item.level > prevLevel + 1) {
      item.level = prevLevel + 1
    } else {
      prevLevel = item.level
    }
    i++
  }

  return outline.filter((item) => item.level <= params.MAX_LEVELS)
}

function findOutline(doc) {
  const pageDicts = Array.from({ length: doc.countPages() }, (_, i) => {
    const page = doc.loadPage(i)
    const [x0, y0, x1, y1] = page.getBounds()
    const [width, height] = [x1 - x0, y1 - y0]
    const sText = page.toStructuredText('preserve-spans')
    return { width, height, ...JSON.parse(sText.asJSON()) }
  }) as Array<PageDict>

  const styleGroups = groupTextByStyle(pageDicts)

  const columns = findColumns(pageDicts)

  filterSpansPre(styleGroups, columns)

  const [outlineGroups, alignmentScores] = findAlignedGroups(
    styleGroups,
    columns
  )

  filterGroups(outlineGroups, pageDicts, alignmentScores)
  processStyleGroups(outlineGroups, pageDicts)

  filterSpansPost(outlineGroups, pageDicts, columns)

  const outline = structureOutline(outlineGroups)
  return outline
}

export { findOutline, OutlineItem, params }
