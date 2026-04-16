import { describe, it, expect } from 'vitest'
import { parseSketchJson, type CleanedNode } from '../src/core/parser.js'

// 最小化的 Sketch 风格 JSON 测试数据
const textLayer = {
  name: 'Title',
  type: 'textLayer',
  visible: true,
  frame: { left: 0, top: 0, width: 200, height: 40 },
  opacity: 1,
  textContent: '语音房每日任务统计',
  textStyle: {
    fontSize: 28,
    fontWeight: 600,
    color: { r: 0, g: 0, b: 0, a: 1 },
    lineHeight: 42,
  },
}

const imageLayer = {
  name: 'avatar',
  type: 'bitmapLayer',
  visible: true,
  hasExportImage: true,
  frame: { left: 32, top: 100, width: 72, height: 72 },
  opacity: 1,
  image: { imageUrl: 'https://alipic.lanhuapp.com/abc.png', size: { width: 72, height: 72 } },
}

const shapeLayer = {
  name: 'card-bg',
  type: 'shapeLayer',
  visible: true,
  frame: { left: 0, top: 0, width: 686, height: 120 },
  opacity: 1,
  fills: [{ color: { r: 255, g: 255, b: 255, a: 1 } }],
  radius: { topLeft: 24, topRight: 24, bottomLeft: 24, bottomRight: 24 },
}

const invisibleLayer = {
  name: 'hidden',
  type: 'shapeLayer',
  visible: false,
  frame: { left: 0, top: 0, width: 100, height: 100 },
}

const emptyGroup = {
  name: 'empty-group',
  type: 'groupLayer',
  visible: true,
  frame: { left: 0, top: 0, width: 0, height: 0 },
  layers: [],
}

const singleChildGroup = {
  name: 'wrapper',
  type: 'groupLayer',
  visible: true,
  frame: { left: 0, top: 0, width: 200, height: 40 },
  layers: [textLayer],
}

describe('parseSketchJson', () => {
  it('classifies text layer', () => {
    const result = parseSketchJson({ layers: [textLayer] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    expect(result[0].text).toBe('语音房每日任务统计')
    expect(result[0].class).toContain('text-28px')
    expect(result[0].class).toContain('font-600')
  })

  it('classifies image layer with export mark', () => {
    const result = parseSketchJson({ layers: [imageLayer] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('icon') // 72x72 较小 → icon
    expect(result[0].imageRef).toBeDefined()
  })

  it('classifies shape layer as shape', () => {
    const result = parseSketchJson({ layers: [shapeLayer] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('shape')
    expect(result[0].class).toContain('rounded-24px')
    expect(result[0].class).toContain('bg-#FFFFFF')
  })

  it('removes invisible layers', () => {
    const result = parseSketchJson({ layers: [textLayer, invisibleLayer] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Title')
  })

  it('removes empty groups', () => {
    const result = parseSketchJson({ layers: [emptyGroup, textLayer] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
  })

  it('flattens single-child groups', () => {
    const result = parseSketchJson({ layers: [singleChildGroup] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    expect(result[0].name).toBe('Title')
  })

  it('handles container with multiple children', () => {
    const group = {
      name: 'card',
      type: 'groupLayer',
      visible: true,
      frame: { left: 0, top: 0, width: 686, height: 120 },
      layers: [shapeLayer, textLayer],
    }
    const result = parseSketchJson({ layers: [group] }, { isFigma: false, sliceScale: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('container')
    expect(result[0].children).toHaveLength(2)
  })
})
