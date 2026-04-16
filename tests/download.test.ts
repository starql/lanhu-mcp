import { describe, it, expect } from 'vitest'
import { buildSliceFileName, deduplicateSlices, buildScaleUrl } from '../src/utils/download.js'

describe('buildSliceFileName', () => {
  it('names icon correctly', () => {
    expect(buildSliceFileName('icon', 1, 'webp')).toBe('icon-1.webp')
  })

  it('names bg correctly', () => {
    expect(buildSliceFileName('bg', 3, 'png')).toBe('bg-3.png')
  })

  it('names img correctly', () => {
    expect(buildSliceFileName('img', 2, 'webp')).toBe('img-2.webp')
  })
})

describe('deduplicateSlices', () => {
  it('removes duplicate URLs', () => {
    const slices = [
      { url: 'https://a.com/1.png', category: 'icon' as const },
      { url: 'https://a.com/1.png', category: 'icon' as const },
      { url: 'https://a.com/2.png', category: 'img' as const },
    ]
    const result = deduplicateSlices(slices)
    expect(result).toHaveLength(2)
  })
})

describe('buildScaleUrl', () => {
  it('returns original URL for stored scale', () => {
    const url = 'https://alipic.lanhuapp.com/abc.png'
    // 72x72 逻辑尺寸, scale 2 → 存储 144x144, 请求 2x = 144x144 = 存储尺寸
    expect(buildScaleUrl(url, 72, 72, 2, 2)).toBe(url)
  })

  it('adds OSS resize params for different scale', () => {
    const url = 'https://alipic.lanhuapp.com/abc.png'
    // 72x72 逻辑尺寸, scale 2 → 存储 144x144, 请求 1x = 72x72 ≠ 存储尺寸
    const result = buildScaleUrl(url, 72, 72, 2, 1)
    expect(result).toContain('x-oss-process=image/resize')
    expect(result).toContain('w_72')
    expect(result).toContain('h_72')
  })
})
