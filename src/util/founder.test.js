import { FOUNDER_ID, authorPerson, founderPerson, isFounderName } from './founder';

describe('founder', () => {
  it('recognises every spelling of the founder name', () => {
    expect(isFounderName('Александр Гросс')).toBe(true);
    expect(isFounderName('Aleksandr Gross')).toBe(true);
    expect(isFounderName('  alexander   GROSS ')).toBe(true);
    expect(isFounderName('Мария Иванова')).toBe(false);
    expect(isFounderName(undefined)).toBe(false);
  });

  it('keeps the shown name and moves the other spellings to alternateName', () => {
    const person = founderPerson('Александр Гросс');

    expect(person).toMatchObject({
      '@type': 'Person',
      '@id': FOUNDER_ID,
      name: 'Александр Гросс',
      url: 'https://youdu.ae/p/about',
    });
    expect(person.alternateName).toEqual(['Aleksandr Gross', 'Alexander Gross']);
    expect(person.sameAs).toEqual([
      'https://www.linkedin.com/in/aleksandr-gross-aa2155383',
      'https://www.instagram.com/less.grossman____/',
    ]);
  });

  it('uses Aleksandr Gross as the main spelling', () => {
    expect(founderPerson().name).toBe('Aleksandr Gross');
    expect(founderPerson().alternateName).toEqual(['Александр Гросс', 'Alexander Gross']);
  });

  it('leaves any other author as a plain Person', () => {
    expect(authorPerson('Мария Иванова')).toEqual({ '@type': 'Person', name: 'Мария Иванова' });
    expect(authorPerson('Aleksandr Gross')['@id']).toBe(FOUNDER_ID);
  });
});
