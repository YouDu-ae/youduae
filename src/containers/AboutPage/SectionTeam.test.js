import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { FOUNDER_ID } from '../../util/founder';

import SectionTeam from './SectionTeam';

const { waitFor } = testingLibrary;

const LINKEDIN = 'https://www.linkedin.com/in/aleksandr-gross-aa2155383';

const member = (id, name, linkedin = null) => ({
  id,
  name,
  role: 'Роль',
  bio: 'О себе',
  photo: `/static/about/team/${id}.jpg`,
  photoAlt: name,
  linkedin,
});

const teamSchema = async () => {
  let script;
  await waitFor(
    () => {
      script = [...document.head.querySelectorAll('script[type="application/ld+json"]')].find(s =>
        s.textContent.includes('"Person"')
      );
      expect(script).toBeDefined();
    },
    { timeout: 3000 }
  );
  return JSON.parse(script.textContent)['@graph'];
};

describe('SectionTeam', () => {
  it('marks up the founder as the same person as in the rest of the site', async () => {
    const members = [
      member('aleksandr-gross', 'Александр Гросс', LINKEDIN),
      member('maria', 'Мария Иванова'),
    ];
    const { getByText } = render(<SectionTeam sectionId="about-team" members={members} />);

    const [founder, other] = await teamSchema();

    expect(getByText('LinkedIn')).toHaveAttribute('href', LINKEDIN);
    expect(founder).toMatchObject({ '@id': FOUNDER_ID, name: 'Александр Гросс', jobTitle: 'Роль' });
    expect(founder.sameAs).toContain(LINKEDIN);
    expect(founder.sameAs).toHaveLength(2);
    expect(other['@id']).toBeUndefined();
    expect(other.sameAs).toBeUndefined();
    expect(other.worksFor['@id']).toBe('https://youdu.ae#organization');
  });
});
