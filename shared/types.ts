// custom types

export type MySpan = {
  x: number
  y: number
  w: number
  h: number
  text: string
  styleStr: string
  iPage: number
  iBlock: number
  iSpan: number
  iCol: number
}

export type StyleGroups = Map<string, Array<MySpan>>

export type OutlineItem = {
  level: number
  text: string
  page: number
  y?: number
}

// data format from mupdf, with additional fields
export type PageDict = {
  blocks: Array<Block>
}

export type Block = {
  type: string
  bbox: {
    x: number
    y: number
    w: number
    h: number
  }
  lines: Array<Span>
  mainStyleStr?: string
  mainStyleRatio?: number
  nLines?: number
}

export type Span = {
  wmode: number
  bbox: {
    x: number
    y: number
    w: number
    h: number
  }
  font: FontStyle
  x: number
  y: number
  text: string
}

export type FontStyle = {
  name: string
  family: string
  weight: string
  style: string
  size: number
  color: number
}
