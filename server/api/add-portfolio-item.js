const { getSdk, handleError, serialize } = require('../api-util/sdk');

module.exports = (req, res) => {
  const { userId, images, title, description, category, transactionId } = req.body;

  if (!userId || !images || !Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: 'Missing required parameters: userId, images' });
    return;
  }

  const sdk = getSdk(req, res);

  sdk.users
    .show({ id: userId })
    .then(userResponse => {
      const user = userResponse.data.data;
      const currentPublicData = user.attributes.profile.publicData || {};
      const currentPortfolio = currentPublicData.portfolioItems || [];

      // Create new portfolio item
      const newItem = {
        id: `portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        images: images.map(img => (typeof img === 'string' ? img : img.uuid || img.id?.uuid)),
        title: title || '',
        description: description || '',
        category: category || null,
        completedAt: new Date().toISOString(),
        transactionId: transactionId || null,
      };

      const updatedPortfolio = [...currentPortfolio, newItem];

      // Update user's publicData
      return sdk.currentUser.updateProfile({
        publicData: {
          ...currentPublicData,
          portfolioItems: updatedPortfolio,
        },
      });
    })
    .then(response => {
      console.log('✅ Portfolio item added successfully');
      res.status(200).json({
        success: true,
        portfolioItems: response.data.data.attributes.profile.publicData.portfolioItems,
      });
    })
    .catch(e => {
      console.error('❌ Failed to add portfolio item:', e);
      handleError(res, e);
    });
};

