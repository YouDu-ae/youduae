import 'fake-indexeddb/auto';

// jsdom этой версии не даёт structuredClone, а IndexedDB клонирует им значения
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = value => JSON.parse(JSON.stringify(value));
}

import {
  saveGuestListingData,
  getGuestListingData,
  clearGuestListingData,
} from './guestListingStorage';

// Фотография весом ~1 МБ: две таких в localStorage уже не помещались,
// из-за чего задания публиковались без снимков.
const photo = name => ({
  name,
  type: 'image/jpeg',
  size: 750000,
  base64: `data:image/jpeg;base64,${'A'.repeat(1024 * 1024)}`,
});

const draft = {
  title: 'Восстановить столешницу',
  description: 'Кухонная столешница, нужно обновить затирку',
  category: 'repairs_main',
  images: [photo('one.jpg'), photo('two.jpg'), photo('three.jpg')],
};

describe('хранилище черновика задания', () => {
  beforeEach(async () => {
    await clearGuestListingData();
  });

  it('возвращает черновик вместе с фотографиями', async () => {
    await saveGuestListingData(draft);

    const restored = await getGuestListingData();

    expect(restored.title).toEqual(draft.title);
    expect(restored.images).toHaveLength(3);
    expect(restored.images.map(i => i.name)).toEqual(['one.jpg', 'two.jpg', 'three.jpg']);
    expect(restored.images[0].base64).toEqual(draft.images[0].base64);
  });

  it('не кладёт фотографии в localStorage', async () => {
    await saveGuestListingData(draft);

    const stored = localStorage.getItem('guestListingData');
    expect(stored).not.toContain('base64');
    expect(stored.length).toBeLessThan(4096);
  });

  it('очищает и текстовые поля, и фотографии', async () => {
    await saveGuestListingData(draft);
    await clearGuestListingData();

    expect(await getGuestListingData()).toBeNull();
  });

  it('отдаёт текстовые поля, даже если фотографий нет', async () => {
    await saveGuestListingData({ ...draft, images: [] });

    const restored = await getGuestListingData();

    expect(restored.title).toEqual(draft.title);
    expect(restored.images).toEqual([]);
  });
});
