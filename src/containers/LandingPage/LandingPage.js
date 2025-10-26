import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import css from './LandingPage.module.css';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer'; // 👈 импортируем топбар с Redux
import FooterCustom from '../FooterCustom/FooterCustom';

const LandingPage = () => {
  const history = useHistory();
  const [taskTitle, setTaskTitle] = useState('');

  const handleSearchClick = (e) => {
    e.preventDefault();
    console.log('🎯 Landing Page - "Найти" clicked with title:', taskTitle);
    
    // Redirect to GuestListingWizard with title as query parameter
    if (taskTitle && taskTitle.trim()) {
      history.push({
        pathname: '/l/new',
        search: `?title=${encodeURIComponent(taskTitle.trim())}`,
      });
    } else {
      // If no title, just redirect to wizard
      history.push('/l/new');
    }
  };

  return (
    <div className={css.shell}>
      {/* --- TOP BAR --- */}
      <TopbarContainer />

      <div className={css.page}>       {/* ← вся твоя текущая страница */}
         {/* main-bg */}
      <div className={css.mainBg} aria-hidden="true" />

      {/* illustration-back */}
      <div className={css.illustrationBack} aria-hidden="true" />

      {/* container 1200 */}
      <div className={css.container}>

        {/* --- TITLE --- */}
        <div className={css.title}>
          <h1 className={css.titleH1}>Освободим вас<br />от бытовых забот в ОАЭ</h1>
          <p className={css.titleSub}>Найдите надежного исполнителя для любой задачи</p>
        </div>

        {/* --- SEARCH LINE --- */}
        <div className={css.searchLine}>
          <div className={css.search}>
            <input
              type="text"
              className={css.searchInput}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Услуга или специалист"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchClick(e);
                }
              }}
            />
          </div>
          <button onClick={handleSearchClick} className={css.btnFind}>Найти</button>
        </div>

        {/* --- КАТЕГОРИИ УСЛУГ / ЗАГОЛОВОК И ПОДЗАГОЛОВОК --- */}
        <h2 className={css.catTitle}>Категории услуг</h2>
        <p className={css.catSubtitle}>
          Мы экономим ваше время и деньги благодаря<br />большой базе мастеров с отзывами
        </p>

        {/* --- КНОПКА: СТРОИТЕЛЬСТВО И РЕМОНТ --- */}
        <a href="/category/construction" className={css.btnConstruction1}>
          <div className={css.textIcon1}>
            <span className={css.iconDrill}></span>
            <span className={css.btnText1}>Строительство и ремонт</span>
          </div>
        </a>

        {/* --- КНОПКА: КРАСОТА И ЗДОРОВЬЕ --- */}
        <a href="/category/beauty" className={css.btnConstruction2}>
          <div className={css.textIcon2}>
            <span className={css.iconScissors}></span>
            <span className={css.btnText2}>Красота и здоровье</span>
          </div>
        </a>

        {/* --- КНОПКА: РЕПЕТИТОРЫ И ОБУЧЕНИЕ --- */}
        <a href="/category/tutoring" className={css.btnConstruction3}>
          <div className={css.textIcon3}>
            <span className={css.iconSchool}></span>
            <span className={css.btnText3}>Репетиторы и обучение</span>
          </div>
        </a>

        {/* --- КНОПКА: УБОРКА И ПОМОЩЬ В ДОМЕ --- */}
        <a href="/category/cleaning" className={css.btnConstruction4}>
          <div className={css.textIcon4}>
            <span className={css.iconHousekeeper}></span>
            <span className={css.btnText4}>Уборка и помощь в доме</span>
          </div>
        </a>

        {/* --- КНОПКА: ЮРИДИЧЕСКАЯ И БУХГАЛТЕРСКАЯ ПОМОЩЬ --- */}
        <a href="/category/legal" className={css.btnConstruction5}>
          <div className={css.textIcon5}>
            <span className={css.iconWeight}></span>
            <span className={css.btnText5}>Юридическая и бухгалтерская<br />помощь</span>
          </div>
        </a>

        {/* --- КНОПКА: УСТАНОВКА БЫТОВОЙ ТЕХНИКИ --- */}
        <a href="/category/appliances" className={css.btnConstruction6}>
          <div className={css.textIcon6}>
            <span className={css.iconKitchen}></span>
            <span className={css.btnText6}>Установка бытовой техники</span>
          </div>
        </a>

        {/* --- КНОПКА: ФОТО, ВИДЕО, АУДИО --- */}
        <a href="/category/media" className={css.btnConstruction7}>
          <div className={css.textIcon7}>
            <span className={css.iconCamera}></span>
            <span className={css.btnText7}>Фото, видео, аудио</span>
          </div>
        </a>

        {/* --- КНОПКА: КУРЬЕРСКИЕ УСЛУГИ --- */}
        <a href="/category/courier" className={css.btnConstruction8}>
          <div className={css.textIcon8}>
            <span className={css.iconCourier}></span>
            <span className={css.btnText8}>Курьерские услуги</span>
          </div>
        </a>

        {/* --- КНОПКА: ГРУЗОПЕРЕВОЗКИ --- */}
        <a href="/category/moving" className={css.btnConstruction9}>
          <div className={css.textIcon9}>
            <span className={css.iconTruck}></span>
            <span className={css.btnText9}>Грузоперевозки</span>
          </div>
        </a>

         {/* --- КНОПКА: РЕМОНТ ЦИФРОВОЙ ТЕХНИКИ --- */}
        <a href="/category/tech-repair" className={css.btnConstruction10}>
          <div className={css.textIcon10}>
            <span className={css.iconSearch}></span>
            <span className={css.btnText10}>Ремонт цифровой техники</span>
          </div>
        </a>

        {/* --- КНОПКА: АВТОМОБИЛЬНЫЕ УСЛУГИ --- */}
        <a href="/category/auto" className={css.btnConstruction11}>
          <div className={css.textIcon11}>
            <span className={css.iconCar}></span>
            <span className={css.btnText11}>Автомобильные услуги</span>
          </div>
        </a>

        {/* --- ADVANTAGES LINE --- */}
        <div className={css.advantagesLine}>
          {/* advantage 1 */}
          <div className={css.advantage}>
            <div className={css.advRow}>
              <span className={`${css.icon} ${css.iconTexting}`} />
              <span className={css.advTitle}>Специалисты<br />напишут сами</span>
            </div>
            <div className={css.advText}>
              Создайте задание, исполнители увидят это и сами напишут вам, предложив цену
            </div>
          </div>

          {/* advantage 2 */}
          <div className={css.advantage}>
            <div className={css.advRow}>
              <span className={`${css.icon} ${css.iconFire}`} />
              <span className={css.advTitle}>Лучшие мастера<br />и цены</span>
            </div>
            <div className={css.advText}>
              Вы сами выбираете из предложенных вариантов,<br />кому доверить вашу задачу
            </div>
          </div>

          {/* advantage 3 */}
          <div className={css.advantage}>
            <div className={css.advRow}>
              <span className={`${css.icon} ${css.iconPopular}`} />
              <span className={css.advTitle}>Настоящие<br />отзывы</span>
            </div>
            <div className={css.advText}>
              Отзыв можно оставить только после выполненных работ,<br />мы всё проверяем
            </div>
          </div>
        </div>


        {/* --- ЗАГОЛОВОК "КАК ЭТО РАБОТАЕТ" --- */}
        <div className={css.howItWorksTitle}>
          Как это работает
        </div>

        {/* --- КАК ЭТО РАБОТАЕТ : карточка 1 --- */}
        <div className={css.howItWorks1}>
        <div className={css.hwBackText1}>
        <div className={css.hwText1}>
        <div className={css.hwTitle1}>Опишите задачу и условия</div>
        <div className={css.hwDesc1}>
        Мы зададим несколько вопросов вам,<br />чтобы специалист смог
        оценить<br />предстоящую работу
      </div>
    </div>
  </div>
</div>

        
        {/* --- КАК ЭТО РАБОТАЕТ : карточка 2 --- */}
<div className={css.howItWorks2}>
  <div className={css.hwBackText2}>
    <div className={css.hwText2}>
      <div className={css.hwTitle2}>Получите отклики</div>
      <div className={css.hwDesc2}>
        Вашу задачу увидят специалисты и напишут,<br />
        если готовы помочь
      </div>
    </div>
  </div>
</div>

        {/* --- КАК ЭТО РАБОТАЕТ : карточка 3 --- */}
<div className={css.howItWorks3}>
  <div className={css.hwBackText3}>
    <div className={css.hwText3}>
      <div className={css.hwTitle3}>Выберите исполнителя</div>
      <div className={css.hwDesc3}>
        Выберите подходящего специалиста<br />и обсудите
        детали и сроки
      </div>
    </div>
  </div>
</div>

       {/* --- ЗАГОЛОВОК "ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ" --- */}
        <div className={css.reviewsTitle}>
  Отзывы об исполнителях
        </div>

        {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 1 --- */}
<div className={css.reviewCard1}>
  <div className={css.frame1}>
    <div className={css.namePic1}>
      <div className={css.avatar1}></div>

      <div className={css.nameGroup1}>
        <div className={css.name1}>Краснова Евгения</div>
        <div className={css.rating1}>
          <div className={css.starSmall1}></div>
          <div className={css.ratingText1}>4,7 Риэлтор</div>
        </div>
      </div>
    </div>

    <div className={css.text1}>
      <div className={css.textFrom1}>Елена оставила отзыв:</div>
      <div className={css.textBody1}>
        Все отлично! Помогли подобрать апартаменты под наш запрос.
        Порекомендовали друзьям.
      </div>
    </div>
  </div>

  <div className={css.stars1}>
    <div className={css.star1}></div>
    <div className={css.star1}></div>
    <div className={css.star1}></div>
    <div className={css.star1}></div>
    <div className={css.star1}></div>
  </div>
</div>


       {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 3 --- */}
<div className={css.reviewCard3}>
  <div className={css.frame3}>
    <div className={css.namePic3}>
      <div className={css.avatar3}></div>

      <div className={css.nameGroup3}>
        <div className={css.name3}>Дебушева Вероника</div>
        <div className={css.rating3}>
          <div className={css.starSmall3}></div>
          <div className={css.ratingText3}>5 Английский язык</div>
        </div>
      </div>
    </div>

    <div className={css.text3}>
      <div className={css.textFrom3}>Саша оставила отзыв:</div>
      <div className={css.textBody3}>
        Прошло несколько занятий и уже вижу результат у ребенка. Рекомендую!
      </div>
    </div>
  </div>

  <div className={css.stars3}>
    <div className={css.star3}></div>
    <div className={css.star3}></div>
    <div className={css.star3}></div>
    <div className={css.star3}></div>
    <div className={css.star3}></div>
  </div>
</div>


        {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 2 --- */}
<div className={css.reviewCard2}>
  <div className={css.frame2}>
    <div className={css.namePic2}>
      <div className={css.avatar2}></div>

      <div className={css.nameGroup2}>
        <div className={css.name2}>Эльвира Муратовна</div>
        <div className={css.rating2}>
          <div className={css.starSmall2}></div>
          <div className={css.ratingText2}>4,6 Клининг</div>
        </div>
      </div>
    </div>

    <div className={css.text2}>
      <div className={css.textFrom2}>Ольга оставила отзыв:</div>
      <div className={css.textBody2}>
        Периодически приглашаю Эльвиру для поддержания чистоты в доме. Вежливая, аккуратная, выполняет работу качественно
      </div>
    </div>
  </div>

  <div className={css.stars2}>
    <div className={css.star2}></div>
    <div className={css.star2}></div>
    <div className={css.star2}></div>
    <div className={css.star2}></div>
    <div className={css.star2}></div>
  </div>
</div>


       {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 4 --- */}
<div className={css.reviewCard4}>
  <div className={css.frame4}>
    <div className={css.namePic4}>
      <div className={css.avatar4}></div>

      <div className={css.nameGroup4}>
        <div className={css.name4}>Попов Виталий</div>
        <div className={css.rating4}>
          <div className={css.starSmall4}></div>
          <div className={css.ratingText4}>4,9 Юрист</div>
        </div>
      </div>
    </div>

    <div className={css.text4}>
      <div className={css.textFrom4}>Nick оставил отзыв:</div>
      <div className={css.textBody4}>
        Знает свое дело. Брал консультацию<br />по видеосвязи, все толково объясняет.
      </div>
    </div>
  </div>

  <div className={css.stars4}>
    <div className={css.star4}></div>
    <div className={css.star4}></div>
    <div className={css.star4}></div>
    <div className={css.star4}></div>
    <div className={css.star4}></div>
  </div>
</div>


       {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 6 --- */}
<div className={css.reviewCard6}>
  <div className={css.frame6}>
    <div className={css.namePic6}>
      <div className={css.avatar6}></div>

      <div className={css.nameGroup6}>
        <div className={css.name6}>Максимов Анатолий Павлович</div>
        <div className={css.rating6}>
          <div className={css.starSmall6}></div>
          <div className={css.ratingText6}>4,9 Сантехник</div>
        </div>
      </div>
    </div>

    <div className={css.text6}>
      <div className={css.textFrom6}>Vika оставила отзыв:</div>
      <div className={css.textBody6}>
        Быстро и без проблем поменял мне<br />сантехнику, приехал во время как<br />договаривались
      </div>
    </div>
  </div>

  <div className={css.stars6}>
    <div className={css.star6}></div>
    <div className={css.star6}></div>
    <div className={css.star6}></div>
    <div className={css.star6}></div>
    <div className={css.star6}></div>
  </div>
</div>


       {/* --- ОТЗЫВЫ ОБ ИСПОЛНИТЕЛЯХ: карточка 5 --- */}
<div className={css.reviewCard5}>
  <div className={css.frame5}>
    <div className={css.namePic5}>
      <div className={css.avatar5}></div>

      <div className={css.nameGroup5}>
        <div className={css.name5}>Глазко Александр</div>
        <div className={css.rating5}>
          <div className={css.starSmall5}></div>
          <div className={css.ratingText5}>5 Массажист</div>
        </div>
      </div>
    </div>

    <div className={css.text5}>
      <div className={css.textFrom5}>Светлана оставила отзыв:</div>
      <div className={css.textBody5}>
        Специалист не новичок, знающий,<br />внимательный, золотые руки!
      </div>
    </div>
  </div>

  <div className={css.stars5}>
    <div className={css.star5}></div>
    <div className={css.star5}></div>
    <div className={css.star5}></div>
    <div className={css.star5}></div>
    <div className={css.star5}></div>
  </div>
</div>


       {/* --- ЗАГОЛОВОК "ПОПУЛЯРНОЕ В БЛОГЕ" --- */}
        <div className={css.blogTitle}>
  Популярное в блоге
        </div>


       {/* --- БЛОГ: карточка 1 --- */}
<a href="/privacy-policy" className={css.blogCard1}>
  <div className={css.blogImage1}></div>
  <div className={css.blogTextBlock1}>
    <div className={css.blogTag1}>Реальный проект</div>
    <div className={css.blogName1}>Ремонт виллы за 1 млн дирхам</div>
  </div>
</a>

       {/* --- БЛОГ: карточка 2 --- */}
<a href="/privacy-policy" className={css.blogCard2}>
  <div className={css.blogImage2}></div>
  <div className={css.blogTextBlock2}>
    <div className={css.blogTag2}>Полезные советы</div>
    <div className={css.blogName2}>Шпаргалка для туриста</div>
  </div>
</a>

       {/* --- БЛОГ: карточка 3 --- */}
<a href="/privacy-policy" className={css.blogCard3}>
  <div className={css.blogImage3}></div>
  <div className={css.blogTextBlock3}>
    <div className={css.blogTag3}>Полезные советы</div>
    <div className={css.blogName3}>Как выбрать репетитора</div>
  </div>
</a>

       {/* --- КНОПКА "ПОСМОТРЕТЬ ВСЕ СТАТЬИ" --- */}
<a href="/privacy-policy" className={css.btnBlog}>
  Посмотреть все статьи
</a>


      </div>
      </div>
      <FooterCustom />
    </div>
  );
};

export default LandingPage;