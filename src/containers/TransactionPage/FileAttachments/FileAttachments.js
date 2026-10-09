import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { analyseFileName, calculateFileSize } from '../../../util/fileHelpers';

import {
  IconDownload,
  IconErrorSmall,
  IconSpinnerSmall,
  IconUnavailable,
} from './FileAttachmentIcons';

import css from './FileAttachments.module.css';

// A long base name is cut with an ellipsis, but the extension stays visible.
const FileName = props => {
  const { baseName, extension } = analyseFileName(props.name);
  return (
    <span className={css.fileName}>
      <span className={css.fileNameBeginning}>{baseName}</span>
      {extension ? <span className={css.fileNameEnding}>{extension}</span> : null}
    </span>
  );
};

const FileStatus = props => {
  const { icon, name, children } = props;
  return (
    <div className={css.file}>
      <span className={css.icon}>{icon}</span>
      <span className={css.fileWithStatus}>
        {name ? <FileName name={name} /> : null}
        <span className={css.statusText}>{children}</span>
      </span>
    </div>
  );
};

/**
 * @component
 * @param {Object} props
 * @param {Object} props.fileAttachment - fileAttachment entity with its file
 * @param {Object} [props.download] - Download state of this attachment
 * @param {Function} props.onDownloadFile - Called with the fileAttachment id
 * @param {Object} props.intl - The intl object
 * @returns {JSX.Element}
 */
const FileAttachment = props => {
  const { fileAttachment, download = {}, onDownloadFile, intl } = props;
  const { file } = fileAttachment;
  const { name, size, state, deleted } = file?.attributes || {};

  if (!file || deleted || fileAttachment.attributes?.deleted) {
    return (
      <FileStatus icon={<IconUnavailable />}>
        <FormattedMessage id="FileAttachments.fileDeleted" />
      </FileStatus>
    );
  }

  if (state === 'verificationFailed') {
    return (
      <FileStatus icon={<IconErrorSmall />} name={name}>
        <FormattedMessage id="FileAttachments.fileSecurityCheckFailed" />
      </FileStatus>
    );
  }

  if (state !== 'available') {
    return (
      <FileStatus icon={<IconSpinnerSmall />} name={name}>
        <FormattedMessage id="FileAttachments.fileVerifying" />
      </FileStatus>
    );
  }

  const { inProgress, error, downloadUrl } = download;
  return (
    <div className={css.downloadable}>
      <button
        type="button"
        className={classNames(css.file, css.downloadButton)}
        aria-label={intl.formatMessage({ id: 'FileAttachments.downloadFile' }, { fileName: name })}
        onClick={() => onDownloadFile(fileAttachment.id)}
        disabled={inProgress}
      >
        <span className={css.icon}>{inProgress ? <IconSpinnerSmall /> : <IconDownload />}</span>
        <FileName name={name} />
        <span className={css.status}>{calculateFileSize(size, intl.locale)}</span>
      </button>
      {downloadUrl ? (
        <p className={css.note}>
          <FormattedMessage
            id="FileAttachments.downloadFileFallback"
            values={{
              link: (
                <a
                  className={css.noteLink}
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FormattedMessage id="FileAttachments.downloadFileFallbackLink" />
                </a>
              ),
            }}
          />
        </p>
      ) : null}
      {error ? (
        <p className={css.note}>
          <FormattedMessage id="FileAttachments.downloadFileFailed" />
        </p>
      ) : null}
    </div>
  );
};

/**
 * Files attached to a transaction message.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Additional class for the root element
 * @param {Array<Object>} [props.fileAttachments] - fileAttachment entities of the message
 * @param {boolean} props.allowFiles - False when the marketplace has disabled files
 * @param {Object} [props.fileDownloads] - Download states by fileAttachment uuid
 * @param {Function} props.onDownloadFile - Called with the fileAttachment id
 * @param {string} [props.marketplaceName] - Shown when files are disabled
 * @param {Object} props.intl - The intl object
 * @returns {JSX.Element|null}
 */
const FileAttachments = props => {
  const {
    className,
    fileAttachments,
    allowFiles,
    fileDownloads,
    onDownloadFile,
    marketplaceName,
    intl,
  } = props;

  if (!fileAttachments?.length) {
    return null;
  }

  return (
    <div className={classNames(css.root, className)}>
      {allowFiles ? (
        fileAttachments.map(fileAttachment => (
          <FileAttachment
            key={fileAttachment.id.uuid}
            fileAttachment={fileAttachment}
            download={fileDownloads?.[fileAttachment.id.uuid]}
            onDownloadFile={onDownloadFile}
            intl={intl}
          />
        ))
      ) : (
        <p className={css.filesDisabled}>
          <FormattedMessage
            id="TransactionPage.messageFilesDisabled"
            values={{ marketplaceName }}
          />
        </p>
      )}
    </div>
  );
};

export default FileAttachments;
