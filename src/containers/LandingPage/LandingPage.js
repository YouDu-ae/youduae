import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import css from './LandingPage.module.css';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterCustom from '../FooterCustom/FooterCustom';

const LandingPage = () => {
  const history = useHistory();
  const intl = useIntl();
  const [taskTitle, setTaskTitle] = useState('');

  const handleSearchClick = (e) => {
    e.preventDefault();
    // Redirect to GuestListingWizard with title as query parameter
    if (taskTitle && taskTitle.trim()) {
      history.push({
        pathname: '/l/new',
        search: `?title=${encodeURIComponent(taskTitle.trim())}`,
      });
    } else {
      // If no title, just redirect to search page
      history.push('/s');
    }
  };

  return (
    <div className={css.shell}>
      <TopbarContainer />

      <main className={css.page}>
        {/* фоны */}
        <div className={css.mainBg} aria-hidden="true" />
        <div className={css.mainBgMobile} aria-hidden="true" />
        <div className={css.illustrationBack} aria-hidden="true" />

        <div className={css.container}>

          {/* ===== HERO ===== */}
          <section className={css.hero}>
            <div className={css.heroText}>
              <div className={css.title}>
                <h1 className={css.titleH1}>
                  <FormattedMessage 
                    id="LandingPage.heroTitle" 
                    values={{ br: <br /> }} 
                  />
                </h1>
                <p className={css.titleSub}>
                  <FormattedMessage id="LandingPage.heroSubtitle" />
                </p>
              </div>

              <div className={css.searchLine}>
                <div className={css.search}>
                  <input
                    type="text"
                    className={css.searchInput}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={intl.formatMessage({ id: 'LandingPage.searchPlaceholder' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchClick(e);
                      }
                    }}
                  />
                </div>
                <button onClick={handleSearchClick} className={css.btnFind}>
                  <FormattedMessage id="LandingPage.findButton" />
                </button>
              </div>
            </div>

            <div className={css.heroIllustration} aria-hidden="true" />
          </section>

 
         {/* ===== ПРЕИМУЩЕСТВА ===== */}
          <section className={css.advantages}>
            <div className={css.advantagesLine}>
              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconTexting}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle1" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText1" values={{ br: <br /> }} />
                </div>
              </div>

              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconFire}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle2" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText2" values={{ br: <br /> }} />
                </div>
              </div>

              <div className={css.advantage}>
                <div className={css.advRow}>
                  <span className={`${css.icon} ${css.iconPopular}`} />
                  <span className={css.advTitle}>
                    <FormattedMessage id="LandingPage.advantagesTitle3" values={{ br: <br /> }} />
                  </span>
                </div>
                <div className={css.advText}>
                  <FormattedMessage id="LandingPage.advantagesText3" values={{ br: <br /> }} />
                </div>
              </div>
            </div>
          </section>
  

          {/* ===== КАТЕГОРИИ ===== */}
          <section className={css.categories}>
            <h2 className={css.catTitle}><FormattedMessage id="LandingPage.categoriesTitle" /></h2>
            <p className={css.catSubtitle}>
              <FormattedMessage id="LandingPage.categoriesSubtitle" values={{ br: <br /> }} />
            </p>

            <div className={css.categoriesGrid}>
              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'construction' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconDrill}></span>
                  <span><FormattedMessage id="LandingPage.category.construction" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'beauty' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconScissors}></span>
                  <span><FormattedMessage id="LandingPage.category.beauty" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'tutoring' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconSchool}></span>
                  <span><FormattedMessage id="LandingPage.category.tutors" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'cleaning' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconHousekeeper}></span>
                  <span><FormattedMessage id="LandingPage.category.cleaning" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'legal' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconWeight}></span>
                  <span><FormattedMessage id="LandingPage.category.legal" values={{ br: <br /> }} /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'appliances' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconKitchen}></span>
                  <span><FormattedMessage id="LandingPage.category.appliances" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'media' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCamera}></span>
                  <span><FormattedMessage id="LandingPage.category.photo" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'courier' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCourier}></span>
                  <span><FormattedMessage id="LandingPage.category.courier" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'moving' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconTruck}></span>
                  <span><FormattedMessage id="LandingPage.category.transport" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'tech-repair' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconSearch}></span>
                  <span><FormattedMessage id="LandingPage.category.electronics" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'auto' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconCar}></span>
                  <span><FormattedMessage id="LandingPage.category.auto" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Interior_designer' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconInterior}></span>
                  <span><FormattedMessage id="LandingPage.category.interior" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Tourist_services' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconTourist}></span>
                  <span><FormattedMessage id="LandingPage.category.tourist" /></span>
                </div>
              </NamedLink>

              <NamedLink name="CategoryExecutorsPage" params={{ categoryId: 'Web_design' }} className={css.cardBtn}>
                <div className={css.textIcon}>
                  <span className={css.iconWeb}></span>
                  <span><FormattedMessage id="LandingPage.category.web" /></span>
                </div>
              </NamedLink>
            </div>
          </section>
 

          {/* ===== КАК ЭТО РАБОТАЕТ ===== */}
          <section className={css.howItWorks}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.howItWorksTitle" /></h2>

            <div className={css.hiwGrid}>
              <div className={`${css.hiwCard} ${css.hiwCard1}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard1Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard1Text" /></div>
                </div>
              </div>

              <div className={`${css.hiwCard} ${css.hiwCard2}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard2Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard2Text" /></div>
                </div>
              </div>

              <div className={`${css.hiwCard} ${css.hiwCard3}`}>
                <div className={css.hiwBack}>
                  <div className={css.hiwTitle}><FormattedMessage id="LandingPage.howItWorksCard3Title" /></div>
                  <div className={css.hiwText}><FormattedMessage id="LandingPage.howItWorksCard3Text" values={{ br: <br /> }} /></div>
                </div>
              </div>
            </div>
          </section>
  

          {/* ===== ОТЗЫВЫ ===== */}
          <section className={css.reviews}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.reviewsTitle" /></h2>

            <div className={css.reviewsStage}>
              <div className={css.reviewsCanvas}>
                {/* card 1 */}
                <article className={`${css.reviewCard} ${css.pos1} ${css.card1}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava1}`} />
                    <div>
                      <div className={css.person}>Краснова Евгения</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>4,7 Риэлтор</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Елена' }} />
                    </div>
                    <div className={css.reviewText}>Все отлично! Помогли подобрать <br />апартаменты под наш запрос. <br />Порекомендовали друзьям.</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>

                {/* card 3 */}
                <article className={`${css.reviewCard} ${css.rotR} ${css.pos3} ${css.card3}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava3}`} />
                    <div>
                      <div className={css.person}>Дебушева Вероника</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>5 Английский язык</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Саша' }} />
                    </div>
                    <div className={css.reviewText}>Прошло несколько занятий и уже вижу <br />результат у ребенка. Рекомендую!</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>

                {/* card 2 */}
                <article className={`${css.reviewCard} ${css.pos2} ${css.card2}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava2}`} />
                    <div>
                      <div className={css.person}>Эльвира Муратовна</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>4,6 Клининг</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Ольга' }} />
                    </div>
                    <div className={css.reviewText}>Периодически приглашаю Эльвиру <br />для поддержания чистоты в доме. <br />Вежливая, аккуратная, выполняет <br />работу качественно</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>

                {/* card 4 */}
                <article className={`${css.reviewCard} ${css.pos4} ${css.card4}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava4}`} />
                    <div>
                      <div className={css.person}>Попов Виталий</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>4,9 Юрист</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Nick' }} />
                    </div>
                    <div className={css.reviewText}>Знает свое дело. Брал консультацию <br />по видеосвязи, всё толково объясняет.</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>
 

                {/* card 6 */}
                <article className={`${css.reviewCard} ${css.pos6} ${css.card6}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava6}`} />
                    <div>
                      <div className={css.person}>Максимов Анатолий</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>4,9 Сантехник</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Vika' }} />
                    </div>
                    <div className={css.reviewText}>Быстро и без проблем поменял мне <br />сантехнику, приехал вовремя как <br />договаривались</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>

                {/* card 5 */}
                <article className={`${css.reviewCard} ${css.rotL} ${css.pos5} ${css.card5}`}>
                  <header className={css.reviewHeader}>
                    <div className={`${css.avatar} ${css.ava5}`} />
                    <div>
                      <div className={css.person}>Глазко Александр</div>
                      <div className={css.ratingRow}>
                        <span className={css.starSmall} />
                        <span className={css.ratingText}>5 Массажист</span>
                      </div>
                    </div>
                  </header>
                  <div className={css.reviewBody}>
                    <div className={css.reviewFrom}>
                      <FormattedMessage id="LandingPage.reviewFrom" values={{ name: 'Светлана' }} />
                    </div>
                    <div className={css.reviewText}>Специалист не новичок, знающий, <br />внимательный, золотые руки!</div>
                  </div>
                  <div className={css.stars}>
                    <span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} /><span className={css.star} />
                  </div>
                </article>
              </div>
            </div>
          </section>
 

          {/* ===== БЛОГ ===== */}
          <section className={css.blog}>
            <h2 className={css.h2}><FormattedMessage id="LandingPage.blogTitle" /></h2>

            <div className={css.blogGrid}>
              <NamedLink name="PrivacyPolicyPage" className={css.blogCard}>
                <div className={`${css.blogImage} ${css.blogImageVilla}`} />
                <div className={css.blogTextBlock}>
                  <div className={css.blogTag}><FormattedMessage id="LandingPage.blogTag1" /></div>
                  <div className={css.blogName}><FormattedMessage id="LandingPage.blogName1" /></div>
                </div>
              </NamedLink>

              <NamedLink name="PrivacyPolicyPage" className={css.blogCard}>
                <div className={`${css.blogImage} ${css.blogImagePlane}`} />
                <div className={css.blogTextBlock}>
                  <div className={css.blogTag}><FormattedMessage id="LandingPage.blogTag2" /></div>
                  <div className={css.blogName}><FormattedMessage id="LandingPage.blogName2" /></div>
                </div>
              </NamedLink>

              <NamedLink name="PrivacyPolicyPage" className={css.blogCard}>
                <div className={`${css.blogImage} ${css.blogImageTeacher}`} />
                <div className={css.blogTextBlock}>
                  <div className={css.blogTag}><FormattedMessage id="LandingPage.blogTag3" /></div>
                  <div className={css.blogName}><FormattedMessage id="LandingPage.blogName3" /></div>
                </div>
              </NamedLink>
            </div>

            <NamedLink name="PrivacyPolicyPage" className={css.btnBlog}>
              <FormattedMessage id="LandingPage.blogButton" />
            </NamedLink>
          </section>
 

        </div>
      </main>

      <FooterCustom />
    </div>
  );
};

export default LandingPage;

