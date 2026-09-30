/**
 * What the voice assistant is told about the task wizard on screen.
 *
 * On the site the assistant fills the wizard step by step while the
 * conversation goes on. After every fill_task_fields call, and whenever the
 * person opens another step themselves, it learns which step is open and what
 * that step still lacks, so it asks about the step the person is looking at.
 *
 * Step names are the ones the person sees and the ones the server's
 * WIZARD_STEPS (server/api-util/voiceSession.js) gives the assistant.
 */

const STEP_NAMES = {
  title: 'Название',
  details: 'Детали',
  location: 'Локация',
  pricing: 'Цена',
  photos: 'Фото',
};

const FIELD_NAMES = {
  title: 'название',
  description: 'описание',
  category: 'категория',
  deadline: 'срок',
  location: 'адрес',
  price: 'бюджет',
};

const stepTitle = ({ step, number, total }) =>
  `шаг ${number} из ${total} «${STEP_NAMES[step] || step}»`;

const missingText = missing => missing.map(field => FIELD_NAMES[field] || field).join(', ');

/**
 * @typedef {Object} WizardScreen
 * @property {string} step id of the open step: title, details, location, pricing, photos
 * @property {number} number 1-based position of the step
 * @property {number} total number of steps
 * @property {string[]} missing wizard fields the step still needs
 */

/**
 * Added to the fill_task_fields output.
 *
 * @param {WizardScreen} screen
 * @param {boolean} hasPhotos
 */
export const describeScreen = (screen, hasPhotos) => {
  if (screen.step === 'photos') {
    return hasPhotos
      ? `Открыт ${stepTitle(screen)}. Все поля заполнены, фото прикреплены: осталось нажать «Опубликовать задание».`
      : `Открыт ${stepTitle(screen)}. Все поля заполнены, фото пока нет.`;
  }
  return screen.missing.length > 0
    ? `Открыт ${stepTitle(screen)}. Не хватает: ${missingText(screen.missing)}.`
    : `Открыт ${stepTitle(screen)}.`;
};

/**
 * A step the person opened with «Далее» or «Назад». Worth saying something
 * only when the step needs an answer or it is the last one; an already filled
 * step the person went back to look at is just context.
 *
 * @param {WizardScreen} screen
 * @param {boolean} hasPhotos
 * @returns {{spoken: boolean, content: string}}
 */
export const stepOpenedUpdate = (screen, hasPhotos) => {
  const opened = `Человек сам открыл ${stepTitle(screen)}.`;
  if (screen.step === 'photos') {
    return {
      spoken: true,
      content: hasPhotos
        ? `${opened} Все поля заполнены, фото прикреплены. Коротко скажи, что осталось нажать «Опубликовать задание».`
        : `${opened} Все поля заполнены. Коротко предложи добавить фото, если они есть, и нажать «Опубликовать задание». Не настаивай на фото.`,
    };
  }
  if (screen.missing.length > 0) {
    return {
      spoken: true,
      content: `${opened} На нём не хватает: ${missingText(screen.missing)}. Коротко спроси об этом, по одному вопросу за раз.`,
    };
  }
  return { spoken: false, content: `${opened} Этот шаг уже заполнен.` };
};
