module.exports = {
  id: 'uv-c-ozon-osushitel-chiller-hvac-dubai',
  slug: 'uv-c-ozon-osushitel-chiller-hvac-dubai',
  category: 'client-guide',
  title: {
    ru: 'UV-C, озонатор и осушитель в потолочном chiller / HVAC: что можно врезать в Дубае, а что нельзя',
    en: 'UV-C, ozone and dehumidifiers on a ceiling chiller/HVAC in Dubai: what you can retrofit',
  },
  description: {
    ru:
      'Как модифицировать потолочный фанкойл и канальный HVAC в Дубае: лампа UV-C на змеевик, почему озонатор в жилую зону не ставят, и как сушить воздух отдельно от холода.',
    en:
      'How to retrofit a Dubai ceiling FCU or ducted HVAC: UV-C on the coil, why ozone does not belong in occupied air, and how to dry the room without pretending the AC is a dehumidifier.',
  },
  keywords:
    'UV-C кондиционер Дубай, ультрафиолет фанкойл, озонатор HVAC опасно, осушитель воздуха Дубай, FCU cassette retrofit, district cooling влажность',
  readTime: 18,
  featured: false,
  status: 'published',
  image: '',
  content: {
    ru: `
<p>В башне Дубая холод почти всегда приходит не от «наружного блока на балконе», а от <strong>чиллера здания</strong> и <strong>фанкойла за потолком</strong> (FCU) или кассеты. К этому блоку продавцы охотно предлагают три апгрейда: лампу UV-C, озонатор и осушитель. Это три разные машины с разной пользой и разным риском. Их нельзя свалить в один «комплект очистки воздуха».</p>
<p>Ниже — практичная схема: что в потолочный HVAC реально врезают, что работает только в вилле с собственным AHU, и чего EPA с ASHRAE просят не делать в жилой комнате. Мойка сетки и змеевика по-прежнему база: <a href="/blog/chistka-kondicionera-v-dubae">чистка кондиционера</a>. Про HEPA в сплите — <a href="/blog/filtry-hepa-ugolnye-kondicioner-dubai">отдельный разбор</a>.</p>

<h2>Какая система у вас за потолком</h2>
<p>Пока это не ясно, любой «кит» купят не туда.</p>
<ul>
<li><strong>Кассета</strong> — квадратная решётка в потолке, блок над ней. Часто в офисах и части квартир.</li>
<li><strong>Скрытый фанкойл (ceiling concealed FCU)</strong> — железный ящик за гипсокартоном, воздух идёт в щелевые решётки. Типичная картина district cooling: Empower / Tabreed гоняет холодную воду, в квартире только вентилятор и змеевик.</li>
<li><strong>Канальный AHU виллы</strong> — большой шкаф на крыше или в комнате техники, свои компрессоры или свой чиллер, воздуховоды по дому. Здесь места для врезок больше, чем в квартирном FCU.</li>
</ul>
<p>Чиллер на парковке или на крыше башни жилец не модифицирует. Речь всегда про <strong>ваш конечный блок</strong> и, в вилле, про воздуховоды после него. В аренде любой вскрытый потолок — через facilities и письменное согласие: иначе депозит и акт о вмешательстве в общедомовую систему.</p>

<h2>Три приставки — три задачи</h2>
<ul>
<li><strong>UV-C</strong> светит на мокрый змеевик и поддон, чтобы там меньше росла биоплёнка. Это гигиена поверхности блока, не «больничный воздух в комнате».</li>
<li><strong>Озонатор</strong> намеренно делает O₃. В концентрации, которая убивает запах и плесень, он уже вреден лёгким. В жилом воздухе его не держат.</li>
<li><strong>Осушитель</strong> вынимает воду из воздуха. Ни ультрафиолет, ни озон воздух не сушат. Если в квартире 24 °C и липко — это про влажность, не про лампу.</li>
</ul>
<p>Продавец, который ставит все три «на всякий случай», обычно не понимает систему. Ниже — по каждой отдельно, с тем, как это выглядит на потолочном FCU.</p>

<h2>UV-C: единственный из трёх, который в FCU имеет инженерный смысл</h2>
<p>Ультрафиолет диапазона <strong>254 нм (UV-C)</strong> повреждает ДНК микроорганизмов на поверхности, куда свет доходит. ASHRAE описывает два разных применения, и их путают:</p>
<ol>
<li><strong>Облучение змеевика (coil irradiation).</strong> Лампа смотрит на мокрую сторону испарителя и поддон. Поток воздуха проходит быстро, «убить всё в полёте» такая лампа почти не успевает. Зато змеевик меньше зарастает, холод стабильнее, запах «сырого носка» возвращается реже. Именно это ставят в фанкойлы.</li>
<li><strong>Обеззараживание воздуха в канале (in-duct UVGI).</strong> Нужна длина канала, чтобы воздух висел под лампой достаточно долго, и мощность под расход. В коротком квартирном FCU этого места обычно нет. Это история большого AHU.</li>
<li><strong>Верхняя зона комнаты (upper-room UV).</strong> Отдельные светильники под потолком в больницах, с экраном, чтобы луч не бил в глаза. В спальню Дубая это не бытовой апгрейд.</li>
</ol>

<h3>Как это врезают в потолочный фанкойл</h3>
<p>На рынке ОАЭ и GCC есть готовые комплекты под тесный FCU и PTAC — например линейка вроде Honeywell UVL-FCU: короткая лампа 254 нм, металлический экран, магнитное крепление, блок питания 18–32 В или 110–277 В, кабель, индикатор на панели. Похожую опцию (U.V. lamp) закладывают местные сборщики фанкойлов для district cooling. Смысл один: свет на змеевик, не в комнату.</p>
<p>Практический порядок, который делает не «человек с AliExpress», а техник с допуском в потолок:</p>
<ol>
<li>Письменное согласие управляющей и, если аренда, владельца. Вскрывается потолок, часто общий дренаж и электропитание FCU.</li>
<li>Питание блока снято. Кассета или сервисный люк открыты так, чтобы видеть <strong>мокрую сторону змеевика</strong> (куда стекает конденсат), а не только фильтр с лица.</li>
<li>Лампа крепится экраном к корпусу так, чтобы луч падал на рёбра и поддон, не в глаз через приточную щель и не в соседний пластик дренажа без защиты. UV-C старит некоторые пластики и уплотнения — экран для этого и нужен.</li>
<li>Питание берут с линии FCU, чтобы лампа жила вместе с вентилятором, либо ставят отдельный трансформатор в контрольном отсеке. На люк — <strong>концевик</strong>: открыли потолок — лампа погасла. Без этого это не апгрейд, а травма сетчатки.</li>
<li>Снаружи — маленький индикатор «лампа жива». UV-C глазом не проверяют.</li>
<li>После сборки — фото «до/после» змеевика через месяц. Если слой слизи как был, либо лампу поставили не туда, либо её мощность для этого змеевика мала.</li>
</ol>
<p>Лампу меняют по моточасам, обычно раз в 9–18 месяцев: она ещё светит синим, а гермицидная доза уже села. Это расходник, не вечная установка.</p>

<h3>Какую лампу брать — и какую не брать</h3>
<ul>
<li>Нужна <strong>100% 254 нм</strong>, без линии 185 нм. Длина 185 нм как раз рождает озон.</li>
<li>Ищите пометку вроде <strong>UL 2998 / zero ozone</strong>, не «UV sterilization ozone». Дешёвые «кварцевые» трубки с китайских площадок часто озоновые: пахнет бассейном — это не чистота, это O₃.</li>
<li>UV-C <strong>не заменяет мойку</strong>. Биоплёнка толщиной в миллиметр свет не пробивает. Сначала чистый змеевик, потом лампа его так и держит. Грязный блок с лампочкой — дорогой ночник в потолке.</li>
<li>В аренде оригинал-кит с экраном и концевиком дороже «лампочки на скотче» и единственный вариант, который facilities вообще согласует.</li>
</ul>

<h2>Озонатор: в жилой HVAC не модификация, а ошибка</h2>
<p>Озон в воде дезинфицирует бассейн. Озон в воздухе квартиры — другое вещество и другая токсичность. EPA прямо пишет: ни одно федеральное ведомство США не одобряло озонаторы как очистители <strong>в присутствии людей</strong>. ASHRAE для занятых помещений держит планку в единицы ppb и фактически говорит: добавлять озон в здание не следует. Чтобы запах и споры реально «сгорели», концентрация уже выше той, которую можно дышать.</p>
<p>Что из этого следует для потолочного FCU в Дубае:</p>
<ul>
<li>Не вешают генератор озона в приточный короб «чтобы пахло отелем».</li>
<li>Не покупают «UV»-лампу, которая пахнет металлом и щиплет горло — это 185 нм, не 254.</li>
<li>Не путают озон с ионизатором / bipolar ionization: часть таких приборов тоже сыпет озон. Если что-то и рассматривать, то снова сертификат zero ozone, не обещание «убивает 99,9%».</li>
<li>Разовая «озоновая бомба» в пустой квартире после пожара или сильного запаха — работа службы клининга с последующим проветриванием, не круглосуточный режим FCU. Резина дренажа, изоляция проводов и комнатные растения озон портят.</li>
</ul>
<p>Если мастер предлагает озонатор вместе с UV-C «в одном комплекте для кассеты» — это стоп. Оставляете ультрафиолет на змеевик, озон вычёркиваете.</p>

<h2>Осушитель: единственный, кто отвечает на «липко при 24 °C»</h2>
<p>Кондиционер сушит воздух только пока змеевик холоднее точки росы и конденсат успевает стечь. В Дубае это часто ломается:</p>
<ul>
<li>блок быстро набирает температуру и встаёт — влаги выпало мало;</li>
<li>в district cooling вода в змеевике недостаточно холодная (решение здания, не пульта);</li>
<li>вентилятор на максимальной скорости гоняет воздух слишком быстро, змеевик теплее, воды меньше;</li>
<li>грязный змеевик и забитый дренаж.</li>
</ul>
<p>Держать относительную влажность ниже 60%, лучше около 50–55%, просит и здравый смысл, и ориентиры вроде руководства Dubai Municipality по качеству воздуха. Выше 60% липко и спорам хорошо, даже если термометр показывает 23 °C.</p>
<p>UV-C и озон влажность не меняют. Если гигрометр в тени, не у решётки, две-три ночи подряд показывает 65–75% — нужна вода из воздуха, не лампа.</p>

<h3>Что сделать до покупки железки</h3>
<ol>
<li>Поставить простой гигрометр. Два дня записывать %RH и режим FCU.</li>
<li>Грязный фильтр и змеевик — сначала мойка. Мокрый войлок сам отдаёт влагу в поток.</li>
<li>Вентилятор на <strong>низкую скорость</strong>, когда комната уже не пекло: воздух дольше на холодном змеевике, конденсата больше. Режим Dry / осушение, если он на пульте есть, делает похожую работу.</li>
<li>Душ и кухня — с вытяжкой, не с приоткрытой балконной дверью «проветрить» в августе: с улицы заходит ещё более влажный воздух.</li>
<li>Если после этого %RH не падает — писать в facilities: температура подачи chilled water. Жилец вентиль на стояке сам не крутит.</li>
</ol>

<h3>Как модифицируют систему, когда бесплатных настроек мало</h3>
<p><strong>Квартира с кассетой / скрытым FCU.</strong> Полноценный канальный осушитель в 30 см запотолочного пространства почти никогда не влезает: у FCU и так слабый напор, лишний корпус душит воздух. Рабочие варианты:</p>
<ul>
<li>отдельный осушитель в комнате со своим баком — просто, но в Дубае бак за сутки выливают часто;</li>
<li>тот же прибор с <strong>помпой конденсата</strong> в тот же дренаж FCU или в ванную — уже похоже на инженерию, нужен уклон и обратный клапан, чтобы грязная вода не пошла назад;</li>
<li>скрытый мини-осушитель в шкафу у люка FCU с выводом дренажа в поддон кассеты — только если места хватает и facilities согласны сверлить.</li>
</ul>
<p>Не врезают осушитель «последовательно в тот же фанкойл» без расчёта статики: вентилятор FCU не рассчитан толкать ещё один змеевик.</p>
<p><strong>Вилла с канальным AHU.</strong> Здесь как раз место для <em>whole-home dehumidifier</em> на обратке: часть воздуха уходит в осушитель со своим компрессором и возвращается суше, конденсат — в тот же дренаж. Это уже проект, не «коробка с полки». Иногда на фанкойл ставят электрический догрев после змеевика (reheat): воздух сначала охладили и осушили, потом чуть подогрели, чтобы не выставлять 18 °C ради сухости. Догрев ест электричество — в тарифе DEWA это видно.</p>
<p>Мощность считают по литрам в сутки и по объёму, не по «для всей виллы» на коробке. Для однушки-трёшки часто начинают с 20–50 л/сутки; вилла с бассейном у патио — другой класс.</p>

<h2>Что можно сделать жильцу, владельцу и зданию</h2>
<ul>
<li><strong>Мойка, фильтр, гигрометр, низкий вентилятор</strong> — жилец, владелец, вилла.</li>
<li><strong>Переносной осушитель</strong> — жилец и владелец; на вилле это временная мера.</li>
<li><strong>UV-C кит на FCU</strong> — жилец только с письмом facilities; владелец согласовывает с УК; на вилле проще, есть доступ к AHU.</li>
<li><strong>Озонатор в канал</strong> — никому в жилом режиме.</li>
<li><strong>Канальный осушитель / reheat</strong> — в аренде обычно нет; в своей квартире редко, если есть место и дренаж; на вилле это основной сценарий.</li>
<li><strong>Температура воды чиллера</strong> — заявка в УК; на вилле свой техник или сервис чиллера.</li>
</ul>

<h2>Как написать задачу на YouDu, чтобы приехал не продавец лампочек</h2>
<p>В задании укажите:</p>
<ul>
<li>кассета / скрытый FCU / канальная вилла;</li>
<li>district cooling или свой наружный блок;</li>
<li>что беспокоит: запах при старте, липкость, плесень в ванной, счёт;</li>
<li>цифры гигрометра, если есть;</li>
<li>можно ли вскрывать потолок, есть ли согласие УК;</li>
<li>что уже пробовали: мойка, Dry, низкий вентилятор.</li>
</ul>
<p>Нормальный визит: осмотр змеевика и дренажа, замер %RH, предложение <em>либо</em> чистки, <em>либо</em> UV-C на уже чистый змеевик, <em>либо</em> осушения. Комплект «лампа + озон + HEPA-салфетка» из одного ящика — повод искать другого.</p>
<p><a href="/l/new">Описать задачу →</a> · <a href="/category/repairs_main">Мастера по ремонту и HVAC</a></p>

<h2>Коротко</h2>
<p>Потолочный chiller в квартире Дубая — это ваш фанкойл, не заводская установка во дворе. UV-C 254 нм на змеевик — рабочий ретрофит, если есть экран, концевик, без озона и после мойки. Озонатор в жилой канал не ставят. Липкий воздух лечит осушение: сначала скорость вентилятора и чистый блок, потом отдельный осушитель с дренажом; в вилле — канальный прибор на обратке. Три коробки из одного каталога не заменяют понимание, какая у вас за потолком машина.</p>
`,
    en: `
<p>In a Dubai tower, cold air usually does not come from a balcony condenser. It comes from the building <strong>chiller</strong> and a <strong>fan coil above the ceiling</strong> (FCU) or a cassette. Salespeople then offer three add-ons: a UV-C lamp, an ozone generator, and a dehumidifier. They are three different machines. They are not a “purification bundle.”</p>
<p>This is the practical map: what you can actually retrofit on a ceiling HVAC, what only fits a villa AHU, and what EPA and ASHRAE ask you not to put in a bedroom. Coil cleaning is still the base: <a href="/blog/chistka-kondicionera-v-dubae">AC cleaning in Dubai</a>. HEPA in a split is a <a href="/blog/filtry-hepa-ugolnye-kondicioner-dubai">separate piece</a>.</p>

<h2>What is actually above the ceiling</h2>
<ul>
<li><strong>Cassette</strong> — a square grille, the box sitting on it.</li>
<li><strong>Concealed FCU</strong> — a metal chassis in the void, slot diffusers in the rooms. Typical district cooling: Empower / Tabreed send chilled water; you only own the fan and the coil.</li>
<li><strong>Villa ducted AHU</strong> — a real air handler, ducts, its own plant. There is room here that a flat FCU does not have.</li>
</ul>
<p>You do not modify the basement chiller. You modify <strong>your terminal</strong>. In a rental, opening the ceiling goes through facilities in writing.</p>

<h2>Three add-ons, three jobs</h2>
<ul>
<li><strong>UV-C</strong> shines on the wet coil and pan so biofilm grows more slowly. Surface hygiene, not “hospital air.”</li>
<li><strong>An ozonator</strong> makes O₃ on purpose. The dose that kills odour is already a lung irritant. It does not stay in occupied air.</li>
<li><strong>A dehumidifier</strong> takes water out of the air. Neither UV nor ozone dries a room. Clammy at 24°C is humidity, not a missing lamp.</li>
</ul>

<h2>UV-C: the one retrofit that belongs on an FCU</h2>
<p>Light at <strong>254 nm</strong> damages DNA on surfaces it can see. ASHRAE treats two jobs that get mixed up:</p>
<ol>
<li><strong>Coil irradiation.</strong> The lamp faces the wet evaporator and pan. Air moves too fast for a thorough “kill in flight.” The coil stays cleaner, cooling more stable, wet-sock smell rarer. This is what goes in fan coils.</li>
<li><strong>In-duct UVGI.</strong> Needs dwell time and power matched to airflow. A short apartment FCU rarely has that length. It is an AHU story.</li>
<li><strong>Upper-room UV.</strong> Shielded hospital fixtures. Not a Dubai bedroom kit.</li>
</ol>
<p>GCC kits for tight FCUs (Honeywell UVL-FCU and similar, plus factory UV options on local FCU catalogues) are a short 254 nm lamp, a metal shield, a magnet, 18–32 V or mains, a panel LED. The beam hits the coil, not the room.</p>
<p>A competent visit: written facilities OK; power off; lamp aimed at the <strong>wet face</strong> of the coil; shield so the grille does not leak UV into eyes and so nearby plastics do not age out; an <strong>interlock</strong> that kills the lamp when the hatch opens; an indicator you can see without looking at the tube; photos a month later. Replace the lamp on hours (often 9–18 months) — it still glows after the germicidal dose has faded.</p>
<p>Specify <strong>254 nm only</strong>, ideally <strong>UL 2998 / zero ozone</strong>. A 185 nm “quartz” tube is an ozone lamp. UV-C does not replace a wash: millimetres of slime block the light. Clean first, then keep it clean.</p>

<h2>Ozone: not a retrofit in occupied HVAC</h2>
<p>EPA: no US federal body has approved ozone generators as cleaners <strong>with people present</strong>. ASHRAE does not want ozone added to occupied buildings. The concentration that actually oxidises odour is above what you should breathe.</p>
<p>Do not hang a generator in the supply plenum. Do not buy a “UV” tube that smells like a pool. Do not confuse ozone with bipolar ionization — some of those boxes emit ozone too. A one-off ozone shock of an empty flat after a fire is a specialist job with ventilation afterwards, not a 24/7 FCU mode. Ozone also attacks drain rubber, wire jackets and plants.</p>
<p>If the quote bundles ozone with UV-C “for the cassette,” keep the lamp, delete the ozone.</p>

<h2>Dehumidifier: the answer to clammy 24°C</h2>
<p>An AC dries air only while the coil is below dew point and condensate can leave. In Dubai that often fails: short cycles, district-cooling water that is not cold enough, a fan on high that warms the coil, a dirty coil, a blocked drain. Dubai Municipality IAQ guidance sits in the same place as EPA: keep indoor RH below 60%, ideally near 50%. UV-C and ozone do not move that number.</p>
<p>Before hardware: a cheap hygrometer for two nights; wash the coil; run the fan on <strong>low</strong> once the room is already cool (ENERGY STAR’s humid-day advice); use Dry if the controller has it; run bathroom extract, do not “air” the flat with a balcony door in August. If RH still sits at 65–75%, write to facilities about chilled-water supply temperature. You do not throttle the riser yourself.</p>
<p><strong>Apartment cassette / concealed FCU.</strong> A ducted dehumidifier almost never fits the void and the FCU fan cannot push a second coil. Use a portable unit, or the same unit with a <strong>condensate pump</strong> into the FCU drain or the bathroom — trap and check valve so dirty water does not run back. Do not series-pipe a dehumidifier through the FCU without a static-pressure calculation.</p>
<p><strong>Villa AHU.</strong> This is where a whole-home dehumidifier on the return belongs, or electric reheat after the coil so you can dry without setting 18°C. Reheat shows up on the DEWA bill. Size in litres per day, not “for the whole villa” on the carton. A one- to three-bed often starts around 20–50 L/day.</p>

<h2>Who is allowed to touch what</h2>
<ul>
<li><strong>Wash, hygrometer, low fan, portable dehumidifier</strong> — tenant, owner, villa.</li>
<li><strong>UV-C kit on an FCU</strong> — tenant only with a facilities letter; owner with the building’s OK; villa is easier because the AHU is accessible.</li>
<li><strong>Ozone in the duct</strong> — nobody in occupied mode.</li>
<li><strong>Ducted dehumidifier or reheat</strong> — almost never in a rental; rarely in an owned flat if there is space and a drain; on a villa this is the main job.</li>
<li><strong>Chiller water temperature</strong> — a ticket to the building, not a YouDu visit alone. On a villa, your own technician.</li>
</ul>

<h2>How to brief the job</h2>
<p>Write: cassette / concealed FCU / villa ducts; district cooling or own outdoor unit; smell, clammy air, bathroom mould, bill; hygrometer numbers; whether the ceiling may be opened; what you already tried. A proper visit inspects coil and drain, measures RH, then offers cleaning <em>or</em> UV-C on a clean coil <em>or</em> dehumidification. A crate of lamp + ozone + HEPA tissue is a reason to keep looking.</p>
<p><a href="/l/new">Describe the job →</a> · <a href="/category/repairs_main">Repairs and HVAC specialists</a></p>

<h2>In short</h2>
<p>The “chiller” in a Dubai flat is your FCU, not the plant in the basement. UV-C at 254 nm on the coil is a real retrofit if it is shielded, interlocked, ozone-free and fitted after a wash. An ozonator does not go in occupied supply air. Clammy air is water: fan speed and a clean coil first, then a dehumidifier with a drain; on a villa, a ducted unit on the return. Three catalogue boxes are not a substitute for knowing which machine sits above the ceiling.</p>
`,
  },
};
