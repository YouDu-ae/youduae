/**
 * Usage without sizes:
 *   <ResponsiveImage
 *     alt="ListingX"
 *     image={imageDataFromSDK}
 *     variants={['landscape-crop', 'landscape-crop2x']}
 *   />
 *   // produces:
 *   <img
 *     alt="ListingX"
 *     src="url/to/landscape-crop.jpg"
 *     srcSet="url/to/landscape-crop.jpg 400w, url/to/landscape-crop2x.jpg 800w" />
 *
 * Usage with sizes:
 *   <ResponsiveImage
 *     alt="ListingX"
 *     image={imageDataFromSDK}
 *     variants={['landscape-crop', 'landscape-crop2x']}
 *     sizes="(max-width: 600px) 100vw, 50vw"
 *   />
 *   // produces:
 *   <img
 *     alt="ListingX"
 *     src="url/to/landscape-crop.jpg"
 *     srcSet="url/to/landscape-crop.jpg 400w, url/to/landscape-crop2x.jpg 800w"
 *     sizes="(max-width: 600px) 100vw, 50vw" />
 *
 *   // This means that below 600px image will take as many pixels there are available on current
 *   // viewport width (100vw) - and above that image will only take 50% of the page width.
 *   // Browser decides which image it will fetch based on current screen size.
 *
 * NOTE: for all the possible image variant names and their respective
 * sizes, see the API documentation.
 */

import React from 'react';
import classNames from 'classnames';
import { useIntl } from '../../util/reactIntl';
import { DEFAULT_LISTING_COVER } from '../../util/listingCover';

import css from './ResponsiveImage.module.css';

/**
 * Responsive image
 * Usage without sizes:
 *   <ResponsiveImage
 *     alt="ListingX"
 *     image={imageDataFromSDK}
 *     variants={['landscape-crop', 'landscape-crop2x']}
 *   />
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string} props.alt alt attribute for the img element
 * @param {Object?} props.image API entity (image or imageAsset)
 * @param {Array<string>} props.variants
 * @param {string?} props.sizes sizes attribute for the img element (to be used with srcset)
 * @param {string?} props.noImageMessage accessible label for the YouDu logo shown when no image was given
 * @returns {JSX.Element} responsive image
 */
const ResponsiveImage = props => {
  const intl = useIntl();
  const {
    className,
    rootClassName,
    alt,
    noImageMessage,
    image,
    variants,
    dimensions,
    ...rest
  } = props;
  const classes = classNames(rootClassName || css.root, className);

  if (image == null || variants.length === 0) {
    const noImageClasses = classNames(rootClassName || css.root, css.noImageContainer, className);

    return (
      <div
        className={noImageClasses}
        style={{ backgroundImage: `url(${DEFAULT_LISTING_COVER})` }}
        role="img"
        aria-label={noImageMessage || alt || intl.formatMessage({ id: 'ResponsiveImage.noImage' })}
      />
    );
  }

  const imageVariants = image.attributes.variants;

  const srcSet = variants
    .map(variantName => {
      const variant = imageVariants[variantName];

      if (!variant) {
        // Variant not available (most like just not loaded yet)
        return null;
      }
      return `${variant.url} ${variant.width}w`;
    })
    .filter(v => v != null)
    .join(', ');

  const imgProps = {
    className: classes,
    srcSet,
    ...rest,
  };

  return <img alt={alt} {...imgProps} />;
};

export default ResponsiveImage;
