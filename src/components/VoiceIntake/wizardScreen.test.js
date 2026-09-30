import { describeScreen, stepOpenedUpdate } from './wizardScreen';

const screenAt = (step, number, missing = []) => ({ step, number, total: 5, missing });

describe('describeScreen', () => {
  it('names the open step and what it still lacks, as the person sees them', () => {
    expect(describeScreen(screenAt('details', 2, ['category', 'deadline']), false)).toBe(
      'Открыт шаг 2 из 5 «Детали». Не хватает: категория, срок.'
    );
    expect(describeScreen(screenAt('location', 3), false)).toBe('Открыт шаг 3 из 5 «Локация».');
  });

  it('says whether photos are attached on the last step', () => {
    expect(describeScreen(screenAt('photos', 5), false)).toContain('фото пока нет');
    expect(describeScreen(screenAt('photos', 5), true)).toContain('осталось нажать «Опубликовать задание»');
  });
});

describe('stepOpenedUpdate', () => {
  it('asks about a step that still needs an answer', () => {
    const update = stepOpenedUpdate(screenAt('pricing', 4, ['price']), false);

    expect(update.spoken).toBe(true);
    expect(update.content).toContain('шаг 4 из 5 «Цена». На нём не хватает: бюджет.');
  });

  it('suggests photos and publishing on the last step', () => {
    const update = stepOpenedUpdate(screenAt('photos', 5), false);

    expect(update.spoken).toBe(true);
    expect(update.content).toContain('добавить фото');
  });

  it('keeps quiet about a step that is already filled', () => {
    expect(stepOpenedUpdate(screenAt('title', 1), false)).toEqual({
      spoken: false,
      content: 'Человек сам открыл шаг 1 из 5 «Название». Этот шаг уже заполнен.',
    });
  });
});
