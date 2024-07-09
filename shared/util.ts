import { OutlineItem } from './algo.ts'

export function roundToBin(x: number, binSize: number) {
  return Math.round(x / binSize) * binSize
}

export function findAbsMinDist(x: number, refs: Array<number>) {
  const ds = refs.map((ref) => Math.abs(x - ref))
  const iAbsMin = ds.reduce((iMin, d, i) => (d < ds[iMin] ? i : iMin), 0)
  return [ds[iAbsMin], iAbsMin]
}

export function findMaxKV(map: Map<string, number>): [string, number] {
  const items = [...map.entries()]
  let maxK = items[0][0]
  let maxV = items[0][1]
  for (const [k, v] of items) {
    if (v > maxV) {
      maxK = k
      maxV = v
    }
  }
  return [maxK, maxV]
}

export function findMode(arr: Array<number>): number {
  const counts = new Map()
  let mode = arr[0]
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1)
    if (counts.get(item) > counts.get(mode)) {
      mode = item
    }
  }
  return mode
}

////// PDF utils

export function outlineToStr(outline: Array<OutlineItem>) {
  function toString(outlineItem) {
    const entries = [outlineItem.text, outlineItem.page]
    if (outlineItem.y) {
      const coordStr = outlineItem.x
        ? `${Math.round(outlineItem.x)},${Math.round(outlineItem.y)}`
        : Math.round(outlineItem.y)
      entries.push(coordStr)
    }
    return '\t'.repeat(outlineItem.level - 1) + entries.join('\t')
  }
  return outline.map((outlineItem) => toString(outlineItem)).join('\n')
}

export function parseOutlineStr(content) {
  const lines = content.trim().split('\n')
  const outline: Array<OutlineItem> = []
  for (const line of lines) {
    const info = line.trimStart()
    const level = 1 + line.length - info.length
    const infoList = info.split('\t')
    const text = infoList[0]
    const page = parseInt(infoList[1])
    let y
    let x
    if (infoList.length > 2) {
      const coordStr = infoList[2].split(',')
      if (coordStr.length === 1) {
        y = Number(coordStr[0])
        // only y is provided
      } else {
        x = Number(coordStr[0])
        y = Number(coordStr[1])
      }
    }
    outline.push(new OutlineItem(level, text, page, x, y))
  }
  return outline
}

export function flattenOutline(outline, output = [], level = 1) {
  if (!outline) return output
  for (let item of outline) {
    output.push({
      level,
      ...item,
    })
    // title, uri, open, page
    if (item.down) {
      flattenOutline(item.down, output, level + 1)
    }
  }
  return output
}

export function getOutline(doc): Array<OutlineItem> {
  const existingOutline = flattenOutline(doc.loadOutline())
  const outline = []
  for (const item of existingOutline) {
    const outlineItem = new OutlineItem(item.level, item.title, item.page + 1)
    const dest = doc.resolveLinkDestination(item.uri)
    if (dest.x) {
      outlineItem.x = dest.x
    }
    if (dest.y) {
      outlineItem.y = dest.y
    }
    outline.push(outlineItem)
  }
  return outline
}

export function setOutline(doc, outline, foldLevel = 2) {
  const outlineIterator = doc.outlineIterator()
  while (outlineIterator.item()) {
    outlineIterator.delete()
  }
  let currLevel = 1
  for (const outlineItem of outline) {
    if (outlineItem.level > currLevel) {
      outlineIterator.prev()
      outlineIterator.down()
    } else if (outlineItem.level < currLevel) {
      for (let i = 0; i < currLevel - outlineItem.level; i++) {
        outlineIterator.up()
      }
      outlineIterator.next()
    }
    currLevel = outlineItem.level
    const item = {
      title: outlineItem.text,
      open: outlineItem.level < foldLevel,
      uri: doc.formatLinkURI({
        page: outlineItem.page - 1,
        type: 'XYZ',
        x: outlineItem.x,
        y: outlineItem.y,
      }),
    }
    outlineIterator.insert(item)
  }
}
