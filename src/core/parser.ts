export interface CleanedNode {
  type: 'container' | 'text' | 'image' | 'shape' | 'icon'
  name: string
  class: string
  text?: string
  imageRef?: string
  children?: CleanedNode[]
}

interface ParseOptions {
  isFigma: boolean
  sliceScale: number
}

// 图片资源尺寸分类阈值：小于此尺寸（px）归类为 icon
const ICON_MAX_SIZE = 128

/** 将 RGBA 颜色对象转换为十六进制字符串 */
function rgbaToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r)
  const g = Math.round(color.g)
  const b = Math.round(color.b)
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()
  if (color.a !== undefined && color.a < 1) {
    const alpha = Math.round(color.a * 255).toString(16).padStart(2, '0').toUpperCase()
    return `#${hex}${alpha}`
  }
  return `#${hex}`
}

/** 根据图层属性构建 UnoCSS 原子类字符串 */
function buildUnoClass(layer: any): string {
  const classes: string[] = []
  const frame = layer.frame ?? layer.bounds ?? {}

  // 尺寸
  if (frame.width) classes.push(`w-${Math.round(frame.width)}px`)
  if (frame.height) classes.push(`h-${Math.round(frame.height)}px`)

  // 圆角处理：支持数值和对象两种格式
  const radius = layer.radius
  if (radius) {
    if (typeof radius === 'number') {
      classes.push(`rounded-${Math.round(radius)}px`)
    } else {
      const tl = radius.topLeft ?? 0
      const tr = radius.topRight ?? 0
      const bl = radius.bottomLeft ?? 0
      const br = radius.bottomRight ?? 0
      if (tl === tr && tr === bl && bl === br && tl > 0) {
        // 四角相同时使用简写
        classes.push(`rounded-${Math.round(tl)}px`)
      } else {
        if (tl) classes.push(`rounded-tl-${Math.round(tl)}px`)
        if (tr) classes.push(`rounded-tr-${Math.round(tr)}px`)
        if (bl) classes.push(`rounded-bl-${Math.round(bl)}px`)
        if (br) classes.push(`rounded-br-${Math.round(br)}px`)
      }
    }
  }

  // 背景色（取第一个 fill）
  const fills = layer.fills
  if (fills?.length) {
    const fill = fills[0]
    if (fill.color) {
      classes.push(`bg-${rgbaToHex(fill.color)}`)
    }
  }

  // 透明度
  if (layer.opacity !== undefined && layer.opacity < 1) {
    classes.push(`opacity-${Math.round(layer.opacity * 100)}`)
  }

  // 边框
  const borders = layer.borders ?? layer.strokes
  if (borders?.length) {
    const border = borders[0]
    if (border.isEnabled !== false) {
      const thickness = border.thickness ?? 1
      classes.push(`border-${Math.round(thickness)}px`)
      if (border.color) {
        classes.push(`border-${rgbaToHex(border.color)}`)
      }
      classes.push('border-solid')
    }
  }

  // 文本样式
  const textStyle = layer.textStyle
  if (textStyle) {
    if (textStyle.fontSize) classes.push(`text-${Math.round(textStyle.fontSize)}px`)
    if (textStyle.fontWeight) classes.push(`font-${textStyle.fontWeight}`)
    if (textStyle.color) classes.push(`text-${rgbaToHex(textStyle.color)}`)
    if (textStyle.lineHeight) classes.push(`lh-${Math.round(textStyle.lineHeight)}px`)
    if (textStyle.letterSpacing) classes.push(`tracking-${Math.round(textStyle.letterSpacing)}px`)
    if (textStyle.align) {
      const alignMap: Record<string, string> = {
        center: 'text-center',
        right: 'text-right',
        left: 'text-left',
      }
      if (alignMap[textStyle.align]) classes.push(alignMap[textStyle.align])
    }
  }

  // 阴影
  if (layer.shadows?.length) {
    const s = layer.shadows[0]
    if (s.isEnabled !== false && s.color) {
      const ox = Math.round(s.offsetX ?? 0)
      const oy = Math.round(s.offsetY ?? 0)
      const blur = Math.round(s.blurRadius ?? 0)
      const color = rgbaToHex(s.color)
      classes.push(`shadow-[${ox}px_${oy}px_${blur}px_${color}]`)
    }
  }

  return classes.join(' ')
}

/** 判断图层是否带有导出图片标记 */
function isExportImage(layer: any, isFigma: boolean): boolean {
  if (layer.hasExportImage) return true
  if (!isFigma && layer.ddsImage?.imageUrl) return true
  if (layer.image?.imageUrl || layer.image?.svgUrl) {
    if (isFigma) return !!layer.hasExportImage
    return true
  }
  return false
}

/** 获取图层的图片 URL */
function getImageUrl(layer: any): string | undefined {
  if (layer.image?.imageUrl) return layer.image.imageUrl
  if (layer.image?.svgUrl) return layer.image.svgUrl
  if (layer.ddsImage?.imageUrl) return layer.ddsImage.imageUrl
  return undefined
}

/** 根据尺寸将图片资源分类为 bg / img / icon */
function classifyImageType(layer: any): 'bg' | 'img' | 'icon' {
  const frame = layer.frame ?? layer.bounds ?? {}
  const w = frame.width ?? 0
  const h = frame.height ?? 0
  const maxDim = Math.max(w, h)

  if (maxDim <= ICON_MAX_SIZE) return 'icon'
  if (w >= 600) return 'bg'
  return 'img'
}

/** 判断图层是否需要被剪枝（移除） */
function shouldPrune(layer: any): boolean {
  if (!layer) return true
  // 不可见图层
  if (layer.visible === false) return true
  // 完全透明图层
  if (layer.opacity === 0) return true
  // 蓝湖内部标注图层
  const name = layer.name ?? ''
  if (name.startsWith('__lanhu') || name.startsWith('_annotation')) return true
  return false
}

/** 递归将图层处理为 CleanedNode 节点树 */
function processLayer(layer: any, opts: ParseOptions): CleanedNode | null {
  if (shouldPrune(layer)) return null

  const layerType = layer.type ?? layer.layerType ?? ''
  const name = layer.name ?? ''

  // 文本图层
  if (layerType === 'textLayer' || layerType === 'text') {
    return {
      type: 'text',
      name,
      class: buildUnoClass(layer),
      text: layer.textContent ?? layer.text ?? layer.value ?? '',
    }
  }

  // 带导出标记的图片/位图图层
  if (isExportImage(layer, opts.isFigma)) {
    const imgType = classifyImageType(layer)
    const imageUrl = getImageUrl(layer)
    return {
      type: imgType === 'icon' ? 'icon' : 'image',
      name,
      class: buildUnoClass(layer),
      imageRef: imageUrl,
    }
  }

  // 组图层（递归处理子节点）
  const childLayers = layer.layers ?? layer.children ?? []
  if (childLayers.length > 0) {
    const children = childLayers
      .map((child: any) => processLayer(child, opts))
      .filter((c: CleanedNode | null): c is CleanedNode => c !== null)

    // 剪枝后空组 → 移除
    if (children.length === 0) return null

    // 单子节点组 → 扁平化，直接返回子节点
    if (children.length === 1) return children[0]

    return {
      type: 'container',
      name,
      class: buildUnoClass(layer),
      children,
    }
  }

  // 形状图层（无子节点、无导出图片）
  if (
    layerType.includes('shape') ||
    layerType.includes('rect') ||
    layerType.includes('oval') ||
    layer.fills?.length ||
    layer.radius
  ) {
    return {
      type: 'shape',
      name,
      class: buildUnoClass(layer),
    }
  }

  // 未知类型但有有效 frame → 兜底当作 shape
  const frame = layer.frame ?? layer.bounds
  if (frame?.width && frame?.height) {
    return {
      type: 'shape',
      name,
      class: buildUnoClass(layer),
    }
  }

  return null
}

/**
 * 解析蓝湖返回的原始 Sketch JSON，转换为清洗后的节点树。
 *
 * 处理逻辑：
 * 1. 剪枝：移除不可见、透明、空组、注解等无用图层
 * 2. 扁平化：单子节点组直接提升为子节点
 * 3. 分类：区分 container / text / image / shape / icon
 * 4. 样式转换：将图层样式转为 UnoCSS 原子类字符串
 *
 * @param sketchData - 蓝湖 JSON 根对象（支持 .layers / .artboard.layers / .info 三种格式）
 * @param opts - 解析选项（isFigma 标记、sliceScale 切图倍率）
 * @returns 清洗后的顶层节点数组
 */
export function parseSketchJson(sketchData: any, opts: ParseOptions): CleanedNode[] {
  let rootLayers: any[] = []

  if (sketchData.layers) {
    rootLayers = sketchData.layers
  } else if (sketchData.artboard?.layers) {
    rootLayers = sketchData.artboard.layers
  } else if (Array.isArray(sketchData.info)) {
    rootLayers = sketchData.info
  }

  return rootLayers
    .map((layer: any) => processLayer(layer, opts))
    .filter((n: CleanedNode | null): n is CleanedNode => n !== null)
}
