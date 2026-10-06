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
  toAppLocation,
  dubaiDate,
  fieldChecksFor,
  executeTool,
  TOOL_DEFINITIONS,
  STEP_TOOL_DEFINITIONS,
  APP_STEP_TOOL_DEFINITIONS,
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

  it('takes null for the subcategory and payment method nobody named', () => {
    const { errors, fields } = validateDraftFields(
      { ...validArgs, subcategory: null, payment_method: null },
      categories
    );
    expect(errors).toEqual({});
    expect(fields.subcategory).toBeNull();
    expect(fields.paymentMethod).toBe('');
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

  it('wants a date rather than a deadline choice in the app', () => {
    const appChecks = fieldChecksFor('app', new Date('2026-10-02T08:00:00Z'));

    expect(isTaskComplete({ ...complete, deadline: '2026-10-03' }, categories, appChecks)).toBe(true);
    expect(isTaskComplete(complete, categories, appChecks)).toBe(false);
  });
});

describe('dubaiDate', () => {
  // 23 Sep 2026, 22:30 UTC is already the 24th in Dubai.
  it('counts days in Dubai, not on the UTC server', () => {
    const lateEveningUtc = new Date('2026-09-23T22:30:00Z');

    expect(dubaiDate(lateEveningUtc)).toBe('2026-09-24');
    expect(dubaiDate(lateEveningUtc, 7)).toBe('2026-10-01');
  });
});

describe('the app deadline', () => {
  const now = new Date('2026-10-02T08:00:00Z');
  const check = deadline => validateTaskFields({ deadline }, categories, fieldChecksFor('app', now));

  it('takes a day from today on', () => {
    expect(check('2026-10-02').fields).toEqual({ deadline: '2026-10-02' });
    expect(check('2026-10-09').fields).toEqual({ deadline: '2026-10-09' });
  });

  it('refuses the past, a day that does not exist and a year too far', () => {
    ['2026-10-01', '2026-02-30', '2026-13-01', '2027-10-03', 'tomorrow', '03.10.2026'].forEach(
      deadline => {
        expect(check(deadline).errors.deadline).toBeDefined();
      }
    );
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

describe('toAppLocation', () => {
  it('matches the location the app form keeps', () => {
    expect(toAppLocation({ address: 'Dubai Marina', lat: 25.08, lng: 55.14 })).toEqual({
      address: 'Dubai Marina',
      lat: 25.08,
      lng: 55.14,
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
    [...TOOL_DEFINITIONS, ...STEP_TOOL_DEFINITIONS, ...APP_STEP_TOOL_DEFINITIONS].forEach(tool => {
      expect(tool.type).toBe('function');
      expect(tool.parameters.additionalProperties).toBe(false);
    });
  });

  // Responses turns a tool without `strict` into a strict one where every field
  // is required, and the backend then made up a budget of 1 AED to fill it.
  it('lets fill_task_fields leave unknown fields as null', () => {
    [STEP_TOOL_DEFINITIONS, APP_STEP_TOOL_DEFINITIONS].forEach(tools => {
      const tool = tools.find(t => t.name === 'fill_task_fields');
      const properties = Object.entries(tool.parameters.properties);

      expect(tool.strict).toBe(true);
      expect(tool.parameters.required).toEqual(properties.map(([name]) => name));
      properties.forEach(([, property]) => {
        expect(property.type).toContain('null');
        if (property.enum) expect(property.enum).toContain(null);
      });
    });
  });

  it('asks the app for a date instead of the site deadlines', () => {
    const appTool = APP_STEP_TOOL_DEFINITIONS.find(t => t.name === 'fill_task_fields');
    const siteTool = STEP_TOOL_DEFINITIONS.find(t => t.name === 'fill_task_fields');

    expect(appTool.parameters.properties.deadline.enum).toBeUndefined();
    expect(appTool.parameters.properties.deadline.description).toContain('ГГГГ-ММ-ДД');
    expect(siteTool.parameters.properties.deadline.enum).toContain('week');
  });

  // The app's first step holds the photos and waits for them; the site asks
  // for photos on its last step, where the person publishes the task anyway.
  it('lets only the app hear that the person has no photos', () => {
    const appTool = APP_STEP_TOOL_DEFINITIONS.find(t => t.name === 'fill_task_fields');
    const siteTool = STEP_TOOL_DEFINITIONS.find(t => t.name === 'fill_task_fields');

    expect(appTool.parameters.properties.photos_done.type).toEqual(['boolean', 'null']);
    expect(appTool.parameters.required).toContain('photos_done');
    expect(siteTool.parameters.properties.photos_done).toBeUndefined();
  });

  it('lets prepare_task_draft leave only the optional fields as null', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'prepare_task_draft');
    const { properties, required } = tool.parameters;
    const nullableFields = Object.keys(properties).filter(name =>
      [].concat(properties[name].type).includes('null')
    );

    expect(tool.strict).toBe(true);
    expect(required).toEqual(Object.keys(properties));
    expect(nullableFields).toEqual(['subcategory', 'payment_method']);
    expect(properties.payment_method.enum).toContain(null);
  });

  // App builds already installed wait for a whole draft; the site and newer
  // app builds fill their wizard step by step.
  it('keeps older app builds on the whole-draft tools', () => {
    expect(TOOL_DEFINITIONS.map(tool => tool.name)).toEqual([
      'resolve_location',
      'count_specialists',
      'prepare_task_draft',
    ]);
    [STEP_TOOL_DEFINITIONS, APP_STEP_TOOL_DEFINITIONS].forEach(tools => {
      expect(tools.map(tool => tool.name)).toEqual([
        'resolve_location',
        'count_specialists',
        'fill_task_fields',
      ]);
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

  // The app read the address from the site's shape, found nothing there and
  // was left with an empty address after every voice draft.
  it('builds a draft in the shape the app form keeps', async () => {
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
      location: { address: 'Dubai Marina, Dubai, UAE', lat: 25.08, lng: 55.14 },
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

    it('has no photos to pass on to the site', async () => {
      const result = await executeTool('fill_task_fields', { photos_done: true }, { categories });
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    });

    describe('in the app', () => {
      const app = { categories, wizard: 'app', now: new Date('2026-10-02T08:00:00Z') };

      // The app does not let the person past the second step without coordinates.
      it('gives the address together with its coordinates', async () => {
        mockFetchPlaceDetails.mockResolvedValue(marinaDetails);

        const result = await executeTool('fill_task_fields', { place_id: 'place-marina' }, app);

        expect(result.fields).toEqual({
          location: { address: 'Dubai Marina, Dubai, UAE', lat: 25.08, lng: 55.14 },
        });
      });

      it('fills the date the person named', async () => {
        const result = await executeTool('fill_task_fields', { deadline: '2026-10-09' }, app);
        expect(result).toEqual({ ok: true, fields: { deadline: '2026-10-09' }, complete: false });
      });

      it('passes on that the person has no photos, so the first step can go on', async () => {
        const result = await executeTool('fill_task_fields', { photos_done: true }, app);
        expect(result).toEqual({ ok: true, fields: { photosDone: true }, complete: false });
      });

      it('leaves the photos out while the person has not answered about them', async () => {
        const result = await executeTool(
          'fill_task_fields',
          { deadline: '2026-10-09', photos_done: null },
          app
        );
        expect(result.fields).toEqual({ deadline: '2026-10-09' });
      });

      it('tells when the form is complete', async () => {
        const form = {
          ...titleStep,
          category: 'repairs_main',
          deadline: '2026-10-03',
          address: 'Dubai Marina, Dubai, UAE',
        };

        const result = await executeTool('fill_task_fields', { price: 400 }, { ...app, form });

        expect(result.complete).toBe(true);
      });
    });
  });

  it('rejects a tool that was never declared', async () => {
    await expect(executeTool('publish_task', {}, { categories })).rejects.toThrow('Unknown voice tool');
  });
});
