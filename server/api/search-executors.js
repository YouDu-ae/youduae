const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');
const sharetribeSdk = require('sharetribe-flex-sdk');

module.exports = (req, res) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'Category parameter is required' });
  }

  console.log('🔍 Searching executors for category:', category);

  const integrationClientId = process.env.INTEGRATION_API_CLIENT_ID;
  const integrationClientSecret = process.env.INTEGRATION_API_CLIENT_SECRET;
  const marketplaceClientId = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
  const marketplaceClientSecret = process.env.SHARETRIBE_SDK_CLIENT_SECRET;

  if (!integrationClientId || !integrationClientSecret) {
    return res.status(500).json({ error: 'Integration API credentials not configured' });
  }

  try {
    const integrationSdk = sharetribeIntegrationSdk.createInstance({
      clientId: integrationClientId,
      clientSecret: integrationClientSecret,
    });

    const marketplaceSdk = sharetribeSdk.createInstance({
      clientId: marketplaceClientId,
      clientSecret: marketplaceClientSecret,
    });

    // Получаем всех пользователей
  integrationSdk.users
    .query({
      include: ['profileImage'],
        perPage: 100,
    })
    .then(response => {
      const users = response.data.data;
      const included = response.data.included || [];

        console.log(`📊 Total users: ${users.length}`);

        // Фильтруем по категории
        const filteredUsers = users.filter(user => {
          const publicData = user.attributes?.profile?.publicData || {};
          const serviceCategories = publicData.serviceCategories;
          
          if (Array.isArray(serviceCategories)) {
            console.log(`👤 ${user.attributes?.profile?.displayName}: [${serviceCategories.join(', ')}]`);
          }

          return (
            Array.isArray(serviceCategories) && 
            serviceCategories.includes(category)
          );
        });

        console.log(`✅ Filtered: ${filteredUsers.length} executors for "${category}"`);

        // Для каждого пользователя получаем отзывы и выполненные задания
        const userPromises = filteredUsers.map(async user => {
          // Находим фото профиля
          const profileImage = included.find(
            item =>
              item.type === 'image' &&
              item.id.uuid === user.relationships?.profileImage?.data?.id?.uuid
          );

          let reviewCount = 0;
          let averageRating = 0;
          let completedTasksCount = 0;

          // Получаем отзывы
          try {
            const reviewsResponse = await marketplaceSdk.reviews.query({
              subjectId: user.id.uuid,
              state: 'public',
              perPage: 100,
            });
            const reviews = reviewsResponse.data.data;
            reviewCount = reviews.length;
            const totalRating = reviews.reduce((sum, review) => {
              return sum + (review.attributes.rating || 0);
            }, 0);
            averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
          } catch (err) {
            console.error('❌ Error fetching reviews for user:', user.id.uuid, err.message);
          }

          // Получаем выполненные задания (транзакции где пользователь - исполнитель)
          try {
            const transactionsResponse = await integrationSdk.transactions.query({
              providerId: user.id.uuid,
              lastTransitions: [
                'transition/complete',
                'transition/review-1-by-customer',
                'transition/review-2-by-customer',
                'transition/review-1-by-provider',
                'transition/review-2-by-provider',
              ],
              perPage: 100,
            });
            completedTasksCount = transactionsResponse.data.data.length;
          } catch (err) {
            console.error('❌ Error fetching transactions for user:', user.id.uuid, err.message);
          }

          return {
            id: user.id.uuid,
            displayName: user.attributes.profile.displayName,
            abbreviatedName: user.attributes.profile.abbreviatedName,
            publicData: user.attributes.profile.publicData || {},
            metadata: user.attributes.profile.metadata || {},
            isVerified: user.attributes.profile.metadata?.isVerified === true,
            createdAt: user.attributes.createdAt,
            profileImage: profileImage,
            reviews: {
              count: reviewCount,
              averageRating: Math.round(averageRating * 10) / 10,
            },
            completedTasks: completedTasksCount,
          };
      });

      return Promise.all(userPromises);
    })
    .then(executors => {
        // Сортировка по приоритетам
      const sortedExecutors = executors.sort((a, b) => {
          // Проверяем наличие верификации
          const aVerified = a.metadata?.isVerified === true;
          const bVerified = b.metadata?.isVerified === true;
          
          // Проверяем наличие отзывов
          const aHasReviews = a.reviews.count > 0;
          const bHasReviews = b.reviews.count > 0;
          
          // 1️⃣ Группа: Верификация + Отзывы
          const aBoth = aVerified && aHasReviews;
          const bBoth = bVerified && bHasReviews;
          
          if (aBoth && !bBoth) return -1;
          if (!aBoth && bBoth) return 1;
          
          // Если оба в группе 1 - сравниваем по рейтингу и количеству отзывов
          if (aBoth && bBoth) {
            if (b.reviews.averageRating !== a.reviews.averageRating) {
              return b.reviews.averageRating - a.reviews.averageRating;
            }
            if (b.reviews.count !== a.reviews.count) {
              return b.reviews.count - a.reviews.count;
            }
          }
          
          // 2️⃣ Группа: Только верификация (без отзывов)
          const aVerifiedOnly = aVerified && !aHasReviews;
          const bVerifiedOnly = bVerified && !bHasReviews;
        
          if (aVerifiedOnly && !bVerifiedOnly) return -1;
          if (!aVerifiedOnly && bVerifiedOnly) return 1;

          // 3️⃣ Группа: Только отзывы (без верификации)
          const aReviewsOnly = !aVerified && aHasReviews;
          const bReviewsOnly = !bVerified && bHasReviews;
          
          if (aReviewsOnly && !bReviewsOnly) return -1;
          if (!aReviewsOnly && bReviewsOnly) return 1;
          
          // Если оба в группе 3 - сравниваем по рейтингу
          if (aReviewsOnly && bReviewsOnly) {
            if (b.reviews.averageRating !== a.reviews.averageRating) {
              return b.reviews.averageRating - a.reviews.averageRating;
            }
        if (b.reviews.count !== a.reviews.count) {
          return b.reviews.count - a.reviews.count;
            }
        }

          // 4️⃣ По рейтингу (для остальных)
        if (b.reviews.averageRating !== a.reviews.averageRating) {
          return b.reviews.averageRating - a.reviews.averageRating;
        }

          // 5️⃣ По дате регистрации (новые выше)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

        // Логируем сортировку для отладки
        console.log(`📤 Sending ${sortedExecutors.length} executors with reviews`);
        console.log('🔢 Sorting summary:');
        sortedExecutors.forEach((exec, index) => {
          const verifiedIcon = exec.isVerified ? '✅' : '❌';
          const reviewsInfo = exec.reviews.count > 0 
            ? `⭐${exec.reviews.averageRating} (${exec.reviews.count})` 
            : 'нет отзывов';
          console.log(`  ${index + 1}. ${verifiedIcon} ${exec.displayName} - ${reviewsInfo}`);
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
        const status = err?.status || err?.statusCode;
        const data = err?.data || err?.response?.data;
        const apiErrors = data?.errors || data;

        console.error('❌ Query error:', {
          message: err?.message,
          status,
          apiErrors,
        });

      res.status(500).json({ 
          error: 'Query failed',
          details: err?.message,
          status,
          apiErrors,
        });
      });
  } catch (err) {
    console.error('❌ SDK init error:', err.message);
    res.status(500).json({
      error: 'SDK initialization failed',
      details: err.message,
    });
  }
};
