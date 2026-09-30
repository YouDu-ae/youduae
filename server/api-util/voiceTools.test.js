// jest.mock is hoisted above the file, so the factory may only reach names
// prefixed with "mock".
const mockFetchAutocomplete = jest.fn();
const mockFetchPlaceDetails = jest.fn();
const mockGetSpecialistsSummary = jest.fn();

jest.mock('../api/places-proxy', () => {
  class PlacesError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  return {
    fetchAutocomplete: (...args) => mockFetchAutocomplete(...args),
    fetchPlaceDetails: (...args) => mockFetchPlaceDetails(...args),
    PlacesError,
  };
});

jest.mock('./specialistsSummary', () => ({
  getSpecialistsSummary: (...args) => mockGetSpecialistsSummary(...args),
}));

const { PlacesError } = require('../api/places-proxy');
const {
  validateDraftFields,
  validateTaskFields,
  isTaskComplete,
  toWizardLocation,
  executeTool,
  TOOL_DEFINITIONS,
  STEP_TOOL_DEFINITIONS,
  TOOL_NAMES,
} = require('./voiceTools');

const categories = [
  {
    id: 'repairs_main',
    name: 'Ремонт и строительство',
    subcategories: [{ id: 'electric_work', name: 'Электромонтажные работы' }],
  },
  { id: 'cleaning', name: 'Уборка', subcategories: [] },
];

const validArgs = {
  title: 'Нужен электрик',
  description: 'Не работают розетки на кухне, приходить после 18:00.',
  category: 'repairs_main',
  subcategory: 'electric_work',
  deadline: 'tomorrow',
  price: 400,
  place_id: 'place-marina',
};

const marinaDetails = {
  status: 'OK',
  result: {
    formatted_address: 'Dubai Marina, Dubai, UAE',
    geometry: { location: { lat: 25.08, lng: 55.14 } },
  },
};

describe('validateDraftFields', () => {
  it('accepts the example from the pilot brief', () => {
    const { errors, fields } = validateDraftFields(validArgs, categories);

    expect(errors).toEqual({});
    expect(fields.category.id).toBe('repairs_main');
    expect(fields.subcategory.id).toBe('electric_work');
    expect(fields.price).toBe(400);
  });

  // The wizard rejects these same bounds; a draft it refuses would make the
  // person fix what the assistant had already agreed with them.
  it('holds titles and descriptions to the wizard limits', () => {
    const { errors } = validateDraftFields(
      { ...validArgs, title: 'Эл', description: 'Коротко' },
      categories
    );

    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
  });

  it('refuses a category that is not on the list', () => {
    const { errors } = validateDraftFields({ ...validArgs, category: 'electricians' }, categories);
    expect(errors.category).toBeDefined();
  });

  it('refuses a subcategory from another category', () => {
    const { errors } = validateDraftFields(
      { ...validArgs, category: 'cleaning', subcategory: 'electric_work' },
      categories
    );
    expect(errors.subcategory).toBeDefined();
  });

  it('allows leaving the subcategory out', () => {
    const { errors, fields } = validateDraftFields(
      { ...validArgs, subcategory: undefined },
      categories
    );
    expect(errors).toEqual({});
    expect(fields.subcategory).toBeNull();
  });

  // The wizard's deadline is an enum, not a date.
  it('accepts only the wizard deadline values', () => {
    expect(validateDraftFields({ ...validArgs, deadline: '2026-09-24' }, categories).errors.deadline)
      .toBeDefined();
    ['today', 'tomorrow', 'week', 'long-term'].forEach(deadline => {
      expect(validateDraftFields({ ...validArgs, deadline }, categories).errors).toEqual({});
    });
  });

  it('wants a positive whole budget in dirhams', () => {
    expect(validateDraftFields({ ...validArgs, price: 0 }, categories).errors.price).toBeDefined();
    expect(validateDraftFields({ ...validArgs, price: '400' }, categories).errors.price).toBeDefined();
    expect(validateDraftFields({ ...validArgs, price: 399.6 }, categories).fields.price).toBe(400);
  });

  it('needs a confirmed place rather than an address typed by the model', () => {
    const { errors } = validateDraftFields({ ...validArgs, place_id: '' }, categories);
    expect(errors.place_id).toBeDefined();
  });
});

describe('validateTaskFields', () => {
  it('checks only the fields it was given', () => {
    const { fields, errors, placeId } = validateTaskFields(
      { title: 'Нужен электрик', description: 'Не работают розетки на кухне, приходить после 18:00.' },
      categories
    );

    expect(errors).toEqual({});
    expect(fields).toEqual({
      title: 'Нужен электрик',
      description: 'Не работают розетки на кухне, приходить после 18:00.',
    });
    expect(placeId).toBeUndefined();
  });

  it('puts values in the shape the wizard stores', () => {
    const { fields, placeId } = validateTaskFields(
      {
        category: 'repairs_main',
        subcategory: 'electric_work',
        deadline: 'today',
        price: 399.6,
        payment_method: 'cash',
        place_id: 'place-marina',
      },
      categories
    );

    expect(fields).toEqual({
      category: 'repairs_main',
      subcategory: 'electric_work',
      deadline: 'today',
      price: 400,
      paymentMethod: 'cash',
    });
    expect(placeId).toBe('place-marina');
  });

  // A good title should reach the screen even when the budget was misheard.
  it('keeps the good fields next to a wrong one', () => {
    const { fields, errors } = validateTaskFields({ title: 'Нужен электрик', price: -5 }, categories);

    expect(fields).toEqual({ title: 'Нужен электрик' });
    expect(errors.price).toBeDefined();
  });

  it('checks a subcategory only together with its category', () => {
    const alone = validateTaskFields({ subcategory: 'electric_work' }, categories);
    expect(alone.fields).toEqual({});
    expect(alone.errors.subcategory).toMatch(/вместе с категорией/);

    const wrongParent = validateTaskFields({ category: 'nope', subcategory: 'electric_work' }, categories);
    expect(wrongParent.fields).toEqual({});
    expect(wrongParent.errors.category).toBeDefined();
  });

  it('holds the same limits as the full draft', () => {
    const { errors } = validateTaskFields(
      { title: 'Эл', description: 'Коротко', deadline: '2026-09-24', price: '400' },
      categories
    );
    expect(Object.keys(errors).sort()).toEqual(['deadline', 'description', 'price', 'title']);
  });
});

describe('isTaskComplete', () => {
  const complete = {
    title: 'Нужен электрик',
    description: 'Не работают розетки на кухне, приходить после 18:00.',
    category: 'repairs_main',
    deadline: 'tomorrow',
    address: 'Dubai Marina',
    price: 400,
  };

  it('wants everything the wizard requires before publishing', () => {
    expect(isTaskComplete(complete, categories)).toBe(true);
    ['title', 'description', 'category', 'deadline', 'address', 'price'].forEach(field => {
      expect(isTaskComplete({ ...complete, [field]: '' }, categories)).toBe(false);
    });
  });

  it('does not need the optional fields', () => {
    expect(isTaskComplete({ ...complete, subcategory: '', paymentMethod: '' }, categories)).toBe(true);
  });
});

describe('toWizardLocation', () => {
  it('matches what LocationAutocompleteInput stores', () => {
    expect(toWizardLocation({ address: 'Dubai Marina', lat: 25.08, lng: 55.14 })).toEqual({
      search: 'Dubai Marina',
      predictions: [],
      selectedPlace: { address: 'Dubai Marina', origin: { lat: 25.08, lng: 55.14 }, bounds: null },
    });
  });
});

describe('executeTool', () => {
  beforeEach(() => {
    mockFetchAutocomplete.mockReset();
    mockFetchPlaceDetails.mockReset();
    mockGetSpecialistsSummary.mockReset();
  });

  it('declares every tool it can execute', () => {
    expect(TOOL_NAMES).toEqual([
      'resolve_location',
      'count_specialists',
      'prepare_task_draft',
      'fill_task_fields',
    ]);
    [...TOOL_DEFINITIONS, ...STEP_TOOL_DEFINITIONS].forEach(tool => {
      expect(tool.type).toBe('function');
      expect(tool.parameters.additionalProperties).toBe(false);
    });
  });

  // The iOS app waits for a whole draft; only the site fills its wizard step by step.
  it('keeps the app on the whole-draft tools', () => {
    expect(TOOL_DEFINITIONS.map(tool => tool.name)).toEqual([
      'resolve_location',
      'count_specialists',
      'prepare_task_draft',
    ]);
    expect(STEP_TOOL_DEFINITIONS.map(tool => tool.name)).toEqual([
      'resolve_location',
      'count_specialists',
      'fill_task_fields',
    ]);
  });

  it('offers at most three address candidates', async () => {
    mockFetchAutocomplete.mockResolvedValue({
      predictions: [1, 2, 3, 4].map(i => ({ place_id: `p${i}`, description: `Вариант ${i}` })),
    });

    const result = await executeTool('resolve_location', { query: 'Marina' }, { categories });

    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]).toEqual({ place_id: 'p1', description: 'Вариант 1' });
  });

  it('asks for the Latin spelling when a Cyrillic name finds nothing', async () => {
    mockFetchAutocomplete.mockResolvedValue({ predictions: [] });
    const result = await executeTool('resolve_location', { query: 'Эмаар Бичфронт' }, { categories });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/латиницей/);
  });

  it('says so when nothing matches', async () => {
    mockFetchAutocomplete.mockResolvedValue({ predictions: [] });
    const result = await executeTool('resolve_location', { query: 'Nowhere Street' }, { categories });
    expect(result.ok).toBe(false);
    expect(result.error).not.toMatch(/латиницей/);
  });

  it('turns a Places outage into something the assistant can say', async () => {
    mockFetchAutocomplete.mockRejectedValue(new PlacesError(502, 'down'));
    const result = await executeTool('resolve_location', { query: 'Marina' }, { categories });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('counts specialists in the category and overall', async () => {
    mockGetSpecialistsSummary.mockResolvedValue({
      total: 41,
      categories: { repairs_main: { count: 21 } },
    });

    const result = await executeTool('count_specialists', { category: 'repairs_main' }, { categories });

    expect(result).toEqual({
      ok: true,
      category_name: 'Ремонт и строительство',
      specialists_in_category: 21,
      specialists_total: 41,
    });
  });

  it('reports zero for a category nobody works in yet', async () => {
    mockGetSpecialistsSummary.mockResolvedValue({ total: 41, categories: {} });
    const result = await executeTool('count_specialists', { category: 'cleaning' }, { categories });
    expect(result.specialists_in_category).toBe(0);
  });

  it('builds a draft in the shape the wizard stores', async () => {
    mockFetchPlaceDetails.mockResolvedValue(marinaDetails);

    const result = await executeTool('prepare_task_draft', validArgs, { categories });

    expect(result.ok).toBe(true);
    expect(result.draft).toEqual({
      title: 'Нужен электрик',
      description: 'Не работают розетки на кухне, приходить после 18:00.',
      category: 'repairs_main',
      subcategory: 'electric_work',
      deadline: 'tomorrow',
      paymentMethod: '',
      price: 400,
      location: toWizardLocation({ address: 'Dubai Marina, Dubai, UAE', lat: 25.08, lng: 55.14 }),
    });
    expect(result.summary.deadline).toBe('завтра');
  });

  it('does not look up the address when other fields are wrong', async () => {
    const result = await executeTool(
      'prepare_task_draft',
      { ...validArgs, price: -1 },
      { categories }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.price).toBeDefined();
    expect(mockFetchPlaceDetails).not.toHaveBeenCalled();
  });

  it('refuses a place Google cannot resolve', async () => {
    mockFetchPlaceDetails.mockResolvedValue({ status: 'NOT_FOUND' });
    const result = await executeTool('prepare_task_draft', validArgs, { categories });
    expect(result.errors.place_id).toBeDefined();
  });

  describe('fill_task_fields', () => {
    const titleStep = {
      title: 'Нужен электрик',
      description: 'Не работают розетки на кухне, приходить после 18:00.',
    };

    it('fills one step without asking for the rest', async () => {
      const result = await executeTool('fill_task_fields', titleStep, { categories });

      expect(result).toEqual({ ok: true, fields: titleStep, complete: false });
      expect(mockFetchPlaceDetails).not.toHaveBeenCalled();
    });

    it('turns a confirmed place into the address field', async () => {
      mockFetchPlaceDetails.mockResolvedValue(marinaDetails);

      const result = await executeTool('fill_task_fields', { place_id: 'place-marina' }, { categories });

      expect(mockFetchPlaceDetails).toHaveBeenCalledWith({ placeId: 'place-marina' });
      expect(result.fields).toEqual({
        location: toWizardLocation({ address: 'Dubai Marina, Dubai, UAE', lat: 25.08, lng: 55.14 }),
      });
    });

    it('says when a place cannot be resolved and keeps the rest', async () => {
      mockFetchPlaceDetails.mockResolvedValue({ status: 'NOT_FOUND' });

      const result = await executeTool(
        'fill_task_fields',
        { place_id: 'place-x', price: 300 },
        { categories }
      );

      expect(result.ok).toBe(false);
      expect(result.fields).toEqual({ price: 300 });
      expect(result.errors.place_id).toBeDefined();
    });

    // The server records a finished draft for the pilot funnel from this flag.
    it('tells when the new fields complete what the form already holds', async () => {
      const form = {
        ...titleStep,
        category: 'repairs_main',
        deadline: 'tomorrow',
        address: 'Dubai Marina, Dubai, UAE',
      };

      const result = await executeTool('fill_task_fields', { price: 400 }, { categories, form });

      expect(result.complete).toBe(true);
    });

    it('asks for something to fill', async () => {
      const result = await executeTool('fill_task_fields', {}, { categories });
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    });
  });

  it('rejects a tool that was never declared', async () => {
    await expect(executeTool('publish_task', {}, { categories })).rejects.toThrow('Unknown voice tool');
  });
});
