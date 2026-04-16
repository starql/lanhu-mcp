import { describe, it, expect } from 'vitest'
import { parseLanhuUrl, type LanhuParams } from '../src/utils/link-parser.js'

describe('parseLanhuUrl', () => {
  it('parses full URL with fragment params', () => {
    const url = 'https://lanhuapp.com/web/#/item/project/stage?tid=team1&pid=proj1&image_id=img1'
    const result = parseLanhuUrl(url)
    expect(result).toEqual({
      teamId: 'team1',
      projectId: 'proj1',
      imageId: 'img1',
      versionId: undefined,
    })
  })

  it('parses URL with product path', () => {
    const url = 'https://lanhuapp.com/web/#/item/project/product?tid=t2&pid=p2&docId=d2&versionId=v2'
    const result = parseLanhuUrl(url)
    expect(result).toEqual({
      teamId: 't2',
      projectId: 'p2',
      imageId: 'd2',
      versionId: 'v2',
    })
  })

  it('parses bare params string', () => {
    const url = 'tid=t3&pid=p3&image_id=i3'
    const result = parseLanhuUrl(url)
    expect(result).toEqual({
      teamId: 't3',
      projectId: 'p3',
      imageId: 'i3',
      versionId: undefined,
    })
  })

  it('throws on missing pid', () => {
    expect(() => parseLanhuUrl('https://lanhuapp.com/web/#/item?tid=t1')).toThrow('pid')
  })

  it('throws on missing tid', () => {
    expect(() => parseLanhuUrl('https://lanhuapp.com/web/#/item?pid=p1')).toThrow('tid')
  })
})
