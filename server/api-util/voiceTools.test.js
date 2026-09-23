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
  toWizardLocation,
  executeTool,
  TOOL_DEFINITIONS,
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
    expect(TOOL_NAMES).toEqual(['resolve_location', 'count_specialists', 'prepare_task_draft']);
    TOOL_DEFINITIONS.forEach(tool => {
      expect(tool.type).toBe('function');
      expect(tool.parameters.additionalProperties).toBe(false);
    });
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

  it('says so when nothing matches', async () => {
    mockFetchAutocomplete.mockResolvedValue({ predictions: [] });
    const result = await executeTool('resolve_location', { query: 'нигде' }, { categories });
    expect(result.ok).toBe(false);
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

  it('rejects a tool that was never declared', async () => {
    await expect(executeTool('publish_task', {}, { categories })).rejects.toThrow('Unknown voice tool');
  });
});
