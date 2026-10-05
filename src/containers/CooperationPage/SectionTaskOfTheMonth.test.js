import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import SectionTaskOfTheMonth from './SectionTaskOfTheMonth';

const { screen } = testingLibrary;

const task = {
  title: 'Реставрационные работы в квартире',
  amountAED: 2700,
  completedAt: '2026-09-25T17:42:11.296Z',
  specialist: {
    id: 'specialist-1',
    displayName: 'Cultura Restoration',
    avatarUrl: 'https://img.example/480.jpg',
  },
  review: { rating: 5, content: 'Благодарю за талант и пунктуальность', authorName: 'Alex' },
};

describe('SectionTaskOfTheMonth', () => {
  it('shows the task, its price, the specialist and the review', () => {
    const { container } = render(<SectionTaskOfTheMonth month="2026-09" task={task} />);

    expect(screen.getByText('Реставрационные работы в квартире')).toBeInTheDocument();
    expect(screen.getByText('2,700 AED')).toBeInTheDocument();
    expect(screen.getByText('Cultura Restoration').closest('a')).toHaveAttribute(
      'href',
      '/u/specialist-1'
    );
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.example/480.jpg');
    expect(screen.getByText('Благодарю за талант и пунктуальность')).toBeInTheDocument();
    expect(screen.getByTitle('5/5')).toBeInTheDocument();
  });

  it('shows initials without a photo and drops the review part without a review', () => {
    render(
      <SectionTaskOfTheMonth
        month="2026-09"
        task={{
          ...task,
          specialist: { id: 'specialist-2', displayName: 'иван петров', avatarUrl: null },
          review: null,
        }}
      />
    );

    expect(screen.getByText('ИП')).toBeInTheDocument();
    expect(screen.queryByText('CooperationPage.taskOfTheMonthReviewLabel')).not.toBeInTheDocument();
  });

  it('renders nothing for a month without a finished task', () => {
    const { container } = render(<SectionTaskOfTheMonth month="2026-09" task={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
