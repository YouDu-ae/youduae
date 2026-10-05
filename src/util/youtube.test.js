import { youtubeEmbedUrl, youtubeVideoId } from './youtube';

describe('youtubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abcdef'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['  https://youtu.be/dQw4w9WgXcQ  '],
  ])('reads the id from %s', url => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it.each([
    [''],
    [undefined],
    ['not a url'],
    ['https://www.youtube.com/'],
    ['https://www.youtube.com/@youdu'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://vimeo.com/123456789'],
    ['https://evil.example/watch?v=dQw4w9WgXcQ'],
  ])('returns null for %s', url => {
    expect(youtubeVideoId(url)).toBeNull();
  });
});

describe('youtubeEmbedUrl', () => {
  it('points to the privacy-enhanced player', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    );
  });
});
