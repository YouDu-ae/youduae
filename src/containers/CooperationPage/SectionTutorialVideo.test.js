import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import SectionTutorialVideo from './SectionTutorialVideo';

const { screen } = testingLibrary;

describe('SectionTutorialVideo', () => {
  it('embeds the video from a regular YouTube link', () => {
    render(<SectionTutorialVideo videoUrl="https://youtu.be/dQw4w9WgXcQ?si=abc" />);

    expect(screen.getByTitle('CooperationPage.videoTitle')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    );
  });

  it('renders nothing until the link is set', () => {
    const { container } = render(<SectionTutorialVideo videoUrl="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
