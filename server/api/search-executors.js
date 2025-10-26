/**
 * API endpoint для поиска исполнителей (Customer) по категории услуг
 * 
 * GET /api/search-executors?category=construction
 * 
 * Возвращает список пользователей типа Customer с отзывами и статистикой
 */

const sharetribeSdk = require('sharetribe-flex-sdk');

module.exports = (req, res) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'Category parameter is required' });
  }

  const sdk = sharetribeSdk.createInstance({
    clientId: process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID,
    clientSecret: process.env.SHARETRIBE_SDK_CLIENT_SECRET,
  });

  console.log('🔍 Searching executors for category:', category);

  // Ищем пользователей с указанной категорией в publicData.serviceCategories
  sdk.users
    .query({
      // Фильтруем по категории услуг
      pub_serviceCategories: category,
      include: ['profileImage'],
      'fields.user': [
        'profile.displayName',
        'profile.abbreviatedName',
        'profile.publicData',
        'profile.metadata',
        'createdAt',
      ],
      'fields.image': [
        'variants.square-small',
        'variants.square-small2x',
      ],
      perPage: 100, // Максимум результатов
    })
    .then(response => {
      const users = response.data.data;
      const included = response.data.included || [];

      console.log(`✅ Found ${users.length} executors for category "${category}"`);

      // Для каждого пользователя получаем отзывы
      const userPromises = users.map(user => {
        return sdk.reviews
          .query({
            subject_id: user.id.uuid,
            state: 'public',
            perPage: 100,
          })
          .then(reviewsResponse => {
            const reviews = reviewsResponse.data.data;
            
            // Вычисляем статистику
            const reviewCount = reviews.length;
            const totalRating = reviews.reduce((sum, review) => {
              return sum + (review.attributes.rating || 0);
            }, 0);
            const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

            return {
              id: user.id.uuid,
              displayName: user.attributes.profile.displayName,
              abbreviatedName: user.attributes.profile.abbreviatedName,
              publicData: user.attributes.profile.publicData || {},
              metadata: user.attributes.profile.metadata || {},
              createdAt: user.attributes.createdAt,
              profileImage: included.find(
                item => item.type === 'image' && item.id.uuid === user.relationships?.profileImage?.data?.id?.uuid
              ),
              reviews: {
                count: reviewCount,
                averageRating: Math.round(averageRating * 10) / 10, // Округляем до 1 знака
              },
            };
          })
          .catch(err => {
            console.error('❌ Error fetching reviews for user:', user.id.uuid, err);
            return {
              id: user.id.uuid,
              displayName: user.attributes.profile.displayName,
              abbreviatedName: user.attributes.profile.abbreviatedName,
              publicData: user.attributes.profile.publicData || {},
              metadata: user.attributes.profile.metadata || {},
              createdAt: user.attributes.createdAt,
              profileImage: included.find(
                item => item.type === 'image' && item.id.uuid === user.relationships?.profileImage?.data?.id?.uuid
              ),
              reviews: {
                count: 0,
                averageRating: 0,
              },
            };
          });
      });

      return Promise.all(userPromises);
    })
    .then(executors => {
      // Сортируем: сначала верифицированные, потом по количеству отзывов, потом по рейтингу
      const sortedExecutors = executors.sort((a, b) => {
        // 1. Приоритет верифицированным
        const aVerified = a.publicData?.isVerified === true || 
                         (typeof a.publicData?.isVerified === 'object' && a.publicData?.isVerified?.isVerified === true);
        const bVerified = b.publicData?.isVerified === true || 
                         (typeof b.publicData?.isVerified === 'object' && b.publicData?.isVerified?.isVerified === true);
        
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;

        // 2. По количеству отзывов
        if (b.reviews.count !== a.reviews.count) {
          return b.reviews.count - a.reviews.count;
        }

        // 3. По рейтингу
        if (b.reviews.averageRating !== a.reviews.averageRating) {
          return b.reviews.averageRating - a.reviews.averageRating;
        }

        // 4. По дате регистрации (новые выше)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      res.status(200).json({
        data: sortedExecutors,
        meta: {
          totalCount: sortedExecutors.length,
          category,
        },
      });
    })
    .catch(err => {
      console.error('❌ Error searching executors:', err);
      res.status(500).json({ 
        error: 'Failed to search executors',
        details: err.message 
      });
    });
};

