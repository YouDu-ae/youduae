import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import GuestListingWizard from './GuestListingWizard';

const { screen, fireEvent, waitFor, act } = testingLibrary;

// The voice assistant stand-in records what the wizard hands it and whether it
// was ever torn down: unmounting it hangs up the conversation.
const mockIntake = { props: null, mounts: 0, unmounts: 0 };

jest.mock('../../components/VoiceIntake/VoiceIntake', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: props => {
      React.useEffect(() => {
        mockIntake.mounts += 1;
        return () => {
          mockIntake.unmounts += 1;
        };
      }, []);
      mockIntake.props = props;
      return null;
    },
  };
});

jest.mock('../../components/Page/Page', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../components/LayoutComposer', () => {
  const PassThrough = ({ children }) => <div>{children}</div>;
  return {
    __esModule: true,
    default: PassThrough,
    LayoutSingleColumn: PassThrough,
    LayoutSideNavigation: PassThrough,
  };
});

jest.mock('../../components/CategorySpecialistsCard/CategorySpecialistsCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../TopbarContainer/TopbarContainer', () => () => null);

jest.mock('../../components/LocationAutocompleteInput/LocationAutocompleteInputImpl', () => () =>
  null
);

jest.mock('../../util/guestListingStorage', () => ({
  getGuestListingData: async () => null,
  saveGuestListingData: async () => {},
  saveImagesToStorage: async () => [],
}));

const mockConfig = {
  categoryConfiguration: {
    categories: [
      {
        id: 'repairs_main',
        name: 'Ремонт',
        subcategories: [{ id: 'electric_work', name: 'Электрика' }],
      },
      { id: 'cleaning', name: 'Уборка', subcategories: [] },
    ],
  },
};

jest.mock('../../context/configurationContext', () => ({
  ...jest.requireActual('../../context/configurationContext'),
  useConfiguration: () => mockConfig,
}));

const signedIn = { user: { currentUser: { id: { uuid: 'user-1' }, attributes: {} } } };

const titleStep = {
  title: 'Нужен электрик',
  description: 'Не работают розетки на кухне, приходить после 18:00.',
};

const marina = {
  search: 'Dubai Marina',
  predictions: [],
  selectedPlace: { address: 'Dubai Marina', origin: { lat: 25.08, lng: 55.14 }, bounds: null },
};

const stepHeading = key => screen.findByRole('heading', { name: `GuestListingWizard.${key}` });

const renderWizard = async () => {
  render(<GuestListingWizard />, { initialState: signedIn });
  await waitFor(() => expect(mockIntake.props).not.toBeNull());
};

const voiceFills = fields => {
  let shown;
  act(() => {
    shown = mockIntake.props.onFields(fields, { sessionId: 'sess_1' });
  });
  return shown;
};

describe('GuestListingWizard with the voice assistant', () => {
  beforeEach(() => {
    mockIntake.props = null;
    mockIntake.mounts = 0;
    mockIntake.unmounts = 0;
  });

  // «Далее» used to end the conversation without a word: the assistant lived
  // inside the first step and went away with it.
  it('keeps the conversation going when the person presses «Далее»', async () => {
    await renderWizard();

    fireEvent.change(screen.getByPlaceholderText('GuestListingWizard.titlePlaceholder'), {
      target: { value: titleStep.title },
    });
    fireEvent.change(screen.getByPlaceholderText('GuestListingWizard.descriptionPlaceholder'), {
      target: { value: titleStep.description },
    });
    fireEvent.click(screen.getByRole('button', { name: 'GuestListingWizard.next' }));

    expect(await stepHeading('detailsStepTitle')).toBeInTheDocument();
    expect(mockIntake.mounts).toBe(1);
    expect(mockIntake.unmounts).toBe(0);
    expect(mockIntake.props.screen).toEqual({
      step: 'details',
      number: 2,
      total: 5,
      missing: ['category', 'deadline'],
    });
  });

  it('moves on as the assistant fills each step and stops on the photos', async () => {
    await renderWizard();
    expect(mockIntake.props.screen.step).toBe('title');

    expect(voiceFills(titleStep)).toEqual({
      step: 'details',
      number: 2,
      total: 5,
      missing: ['category', 'deadline'],
    });
    expect(await stepHeading('detailsStepTitle')).toBeInTheDocument();

    expect(voiceFills({ category: 'repairs_main', deadline: 'today' }).step).toBe('location');
    expect(voiceFills({ location: marina }).step).toBe('pricing');
    expect(voiceFills({ price: 400 })).toEqual({ step: 'photos', number: 5, total: 5, missing: [] });

    expect(await stepHeading('photosStepTitle')).toBeInTheDocument();
    expect(mockIntake.props.currentFields).toMatchObject({
      title: titleStep.title,
      category: 'repairs_main',
      address: 'Dubai Marina',
      price: 400,
    });
  });

  it('jumps straight to the photos when the whole task is told at once', async () => {
    await renderWizard();

    const shown = voiceFills({
      ...titleStep,
      category: 'repairs_main',
      deadline: 'week',
      location: marina,
      price: 300,
    });

    expect(shown.step).toBe('photos');
    expect(await stepHeading('photosStepTitle')).toBeInTheDocument();
  });

  it('stays on the open step when the assistant changes an earlier one', async () => {
    await renderWizard();
    voiceFills(titleStep);

    const shown = voiceFills({ title: 'Нужен электрик срочно' });

    expect(shown.step).toBe('details');
    expect(mockIntake.props.currentFields.title).toBe('Нужен электрик срочно');
  });

  it('keeps a subcategory only while the category stays the same', async () => {
    await renderWizard();
    voiceFills({ ...titleStep, category: 'repairs_main', subcategory: 'electric_work' });
    voiceFills({ deadline: 'today' });
    expect(mockIntake.props.currentFields.subcategory).toBe('electric_work');

    voiceFills({ category: 'repairs_main' });
    expect(mockIntake.props.currentFields.subcategory).toBe('electric_work');

    voiceFills({ category: 'cleaning' });
    expect(mockIntake.props.currentFields.subcategory).toBe('');
  });
});
