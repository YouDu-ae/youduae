import React, { useEffect, useState } from 'react';
import { object, string } from 'prop-types';

import { fetchAreaStats, fetchCategorySpecialists } from '../../util/api';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { pathByRouteName } from '../../util/routes';

import css from './CategorySpecialistsCard.module.css';

/**
 * Подсказка «по вашей категории есть мастера» в мастере задания.
 *
 * Заказчик не видит исполнителей, пока не опубликует задание, и до этого момента
 * непонятно, есть ли вообще кому его брать. Карточка отвечает на этот вопрос
 * прямо во время заполнения.
 */

// Данные одинаковы для всех шагов и не меняются в течение сессии, поэтому запрос
// живёт на уровне модуля: переходы между шагами его не повторяют.
let summaryPromise = null;

const loadSummary = () => {
  if (!summaryPromise) {
    summaryPromise = fetchCategorySpecialists();
  }
  return summaryPromise;
};

const pluralize = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const CategorySpecialistsCard = props => {
  const { categoryId, categoryName, className, location } = props;
  const routeConfiguration = useRouteConfiguration();
  const [summary, setSummary] = useState(null);
  const [areaStats, setAreaStats] = useState(null);

  // Адрес приходит из LocationAutocompleteInput только после выбора подсказки,
  // до этого координат нет и остаётся городская статистика.
  const origin = location?.selectedPlace?.origin;
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;

  useEffect(() => {
    let cancelled = false;

    loadSummary()
      .then(data => {
        if (!cancelled) {
          setSummary(data);
        }
      })
      .catch(error => {
        // Подсказка необязательна: молча остаёмся без карточки
        console.error('Не удалось загрузить число специалистов:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setAreaStats(null);
      return undefined;
    }

    let cancelled = false;

    fetchAreaStats({ category: categoryId, lat, lng })
      .then(data => {
        if (!cancelled) {
          setAreaStats(data);
        }
      })
      .catch(error => {
        console.error('Не удалось загрузить статистику по району:', error);
        if (!cancelled) {
          setAreaStats(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, lat, lng]);

  if (!summary) {
    return null;
  }

  const total = summary.total;

  if (!total) {
    return null;
  }

  const inCategory = (categoryId && summary.categories?.[categoryId]) || null;
  const count = inCategory?.count || 0;
  const showCategory = count > 0;

  // Аватарки берём только те, что принадлежат категории: чужие лица рядом с её
  // счётчиком читались бы как мастера этой категории.
  const avatars = (showCategory ? inCategory.avatars : summary.avatars) || [];

  const totalOnYoudu = `${total} ${pluralize(
    total,
    'специалист',
    'специалиста',
    'специалистов'
  )} на YouDu`;

  const title = showCategory
    ? `${count} ${pluralize(count, 'мастер', 'мастера', 'мастеров')} по категории «${categoryName}»`
    : totalOnYoudu;

  // Лента заданий общая, фильтра по категориям для откликов нет — поэтому обещание
  // «увидят все» верно и для категории, где мастеров пока нет.
  const text = showCategory
    ? `Задание увидят все специалисты YouDu — сейчас их ${total}, откликнуться может любой.`
    : categoryName
    ? `В категории «${categoryName}» мастеров пока нет — задание попадёт в общую ленту, откликнуться может любой.`
    : 'Задание попадёт в общую ленту — её смотрят все специалисты площадки.';

  // Район точнее и убедительнее города, поэтому он вытесняет городскую строку,
  // когда набралось достаточно выполненных заданий именно там. Сервер отдаёт
  // ячейку только после порога, так что здесь достаточно проверить наличие.
  const proofCell = areaStats?.area || areaStats?.city || null;
  const proofPlace = areaStats?.area ? `в районе ${areaStats.area.communityLabel}` : 'в Дубае';

  const proof = proofCell
    ? `Через YouDu ${proofPlace} уже выполнено ${proofCell.orders} ${pluralize(
        proofCell.orders,
        'задание',
        'задания',
        'заданий'
      )} этой категории — работали ${proofCell.specialists} ${pluralize(
        proofCell.specialists,
        'мастер',
        'мастера',
        'мастеров'
      )}.`
    : null;

  const classes = className ? `${css.root} ${className}` : css.root;

  return (
    <div className={classes}>
      {avatars.length > 0 && (
        <div className={css.avatars}>
          {avatars.map(url => (
            <img key={url} src={url} alt="" className={css.avatar} loading="lazy" />
          ))}
        </div>
      )}

      <div className={css.body}>
        <div className={css.title}>{title}</div>
        <div className={css.text}>{text}</div>
        {proof && <div className={css.proof}>{proof}</div>}
        {showCategory && (
          // Новая вкладка, чтобы не уводить заказчика с недозаполненного задания
          <a
            href={pathByRouteName('CategoryExecutorsPage', routeConfiguration, { categoryId })}
            target="_blank"
            rel="noopener noreferrer"
            className={css.link}
          >
            Посмотреть мастеров
          </a>
        )}
      </div>
    </div>
  );
};

CategorySpecialistsCard.propTypes = {
  categoryId: string,
  categoryName: string,
  className: string,
  // Объект LocationAutocompleteInput; читается только selectedPlace.origin.
  location: object,
};

export default CategorySpecialistsCard;
