import { describe, expect, it } from 'vitest'
import imageManifest from '@/assets/blog/generated-images.json?raw'
import { BLOG_POSTS } from '@/features/blog/blogPosts'
import { postImage } from '@/features/blog/postImages'

const images = (JSON.parse(imageManifest) as { images: { slug: string; file: string }[] }).images

describe('blog article artwork', () => {
  it('covers every published article with a unique generated asset', () => {
    expect(images.map((image) => image.slug).sort()).toEqual(BLOG_POSTS.map((post) => post.slug).sort())
    expect(new Set(images.map((image) => image.file)).size).toBe(BLOG_POSTS.length)
    expect(new Set(BLOG_POSTS.map((post) => postImage(post).src)).size).toBe(BLOG_POSTS.length)
  })

  it('assigns each article the image generated for its own brief', () => {
    for (const post of BLOG_POSTS) {
      const image = images.find((entry) => entry.slug === post.slug)
      expect(image, post.slug).toBeDefined()
      expect(postImage(post).src, post.slug).toMatch(new RegExp(`/assets/blog/${image!.file}$`))
      expect(postImage(post).credit, post.slug).toBeUndefined()
    }
  })
})
