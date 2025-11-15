import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import * as validators from '../../util/validators';

import {
  Form,
  PrimaryButton,
  SecondaryButton,
  FieldTextInput,
  Modal,
  ImageFromFile,
  IconClose,
} from '../';

import css from './AddPortfolioModal.module.css';

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const AddPortfolioModal = props => {
  const {
    id,
    isOpen,
    onClose,
    onSubmit,
    inProgress,
    currentUser,
    transactionId,
  } = props;

  const intl = useIntl();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  const handleFileSelect = event => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setUploadError(intl.formatMessage({ id: 'AddPortfolioModal.invalidFileType' }));
        return false;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setUploadError(
          intl.formatMessage(
            { id: 'AddPortfolioModal.fileTooLarge' },
            { maxSize: '10MB' }
          )
        );
        return false;
      }
      return true;
    });

    if (selectedFiles.length + validFiles.length > MAX_IMAGES) {
      setUploadError(
        intl.formatMessage(
          { id: 'AddPortfolioModal.tooManyImages' },
          { maxImages: MAX_IMAGES }
        )
      );
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setUploadError(null);
  };

  const handleRemoveFile = index => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPortfolio = values => {
    if (selectedFiles.length === 0) {
      setUploadError(intl.formatMessage({ id: 'AddPortfolioModal.noImages' }));
      return;
    }

    onSubmit({
      ...values,
      files: selectedFiles,
      transactionId,
    });
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setUploadError(null);
    onClose();
  };

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={handleClose}
      onManageDisableScrolling={() => {}}
      containerClassName={css.modalContainer}
      usePortal
    >
      <FinalForm
        onSubmit={handleSubmitPortfolio}
        render={formRenderProps => {
          const { handleSubmit, pristine, invalid } = formRenderProps;

          const submitDisabled = invalid || inProgress || selectedFiles.length === 0;

          return (
            <Form className={css.form} onSubmit={handleSubmit}>
              <div className={css.modalHeader}>
                <h2 className={css.modalTitle}>
                  <FormattedMessage id="AddPortfolioModal.title" />
                </h2>
                <button type="button" className={css.closeButton} onClick={handleClose}>
                  <IconClose rootClassName={css.closeIcon} />
                </button>
              </div>

              <div className={css.modalBody}>
                <div className={css.section}>
                  <label className={css.label}>
                    <FormattedMessage id="AddPortfolioModal.imagesLabel" />
                    <span className={css.required}>*</span>
                  </label>
                  
                  <div className={css.imageUploadArea}>
                    <input
                      type="file"
                      id="portfolio-images"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className={css.fileInput}
                      disabled={selectedFiles.length >= MAX_IMAGES}
                    />
                    <label htmlFor="portfolio-images" className={css.uploadLabel}>
                      {selectedFiles.length === 0 ? (
                        <div className={css.uploadPlaceholder}>
                          <span className={css.uploadIcon}>📷</span>
                          <FormattedMessage id="AddPortfolioModal.uploadPlaceholder" />
                          <span className={css.uploadHint}>
                            <FormattedMessage
                              id="AddPortfolioModal.uploadHint"
                              values={{ max: MAX_IMAGES }}
                            />
                          </span>
                        </div>
                      ) : (
                        <div className={css.uploadMore}>
                          <FormattedMessage
                            id="AddPortfolioModal.addMoreImages"
                            values={{ current: selectedFiles.length, max: MAX_IMAGES }}
                          />
                        </div>
                      )}
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className={css.imagePreviewGrid}>
                      {selectedFiles.map((file, index) => (
                        <div key={index} className={css.imagePreview}>
                          <ImageFromFile
                            file={file}
                            className={css.previewImage}
                            aspectWidth={1}
                            aspectHeight={1}
                          >
                            <button
                              type="button"
                              className={css.removeImageButton}
                              onClick={() => handleRemoveFile(index)}
                            >
                              <IconClose rootClassName={css.removeIcon} />
                            </button>
                          </ImageFromFile>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadError && <div className={css.error}>{uploadError}</div>}
                </div>

                <FieldTextInput
                  id="portfolio-title"
                  name="title"
                  type="text"
                  label={intl.formatMessage({ id: 'AddPortfolioModal.titleLabel' })}
                  placeholder={intl.formatMessage({ id: 'AddPortfolioModal.titlePlaceholder' })}
                  maxLength={100}
                />

                <FieldTextInput
                  id="portfolio-description"
                  name="description"
                  type="textarea"
                  label={intl.formatMessage({ id: 'AddPortfolioModal.descriptionLabel' })}
                  placeholder={intl.formatMessage({
                    id: 'AddPortfolioModal.descriptionPlaceholder',
                  })}
                  maxLength={500}
                />
              </div>

              <div className={css.modalFooter}>
                <SecondaryButton type="button" onClick={handleClose} disabled={inProgress}>
                  <FormattedMessage id="AddPortfolioModal.cancel" />
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={submitDisabled} inProgress={inProgress}>
                  <FormattedMessage id="AddPortfolioModal.submit" />
                </PrimaryButton>
              </div>
            </Form>
          );
        }}
      />
    </Modal>
  );
};

AddPortfolioModal.defaultProps = {
  inProgress: false,
  transactionId: null,
};

AddPortfolioModal.propTypes = {
  id: propTypes.string.isRequired,
  isOpen: propTypes.bool.isRequired,
  onClose: propTypes.func.isRequired,
  onSubmit: propTypes.func.isRequired,
  inProgress: propTypes.bool,
  currentUser: propTypes.currentUser,
  transactionId: propTypes.uuid,
};

export default AddPortfolioModal;

