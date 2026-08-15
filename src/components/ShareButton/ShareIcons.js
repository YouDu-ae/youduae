import React from 'react';

/**
 * Paper plane icon used as the share button's label.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconSend = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2 21l20-9L2 3v7l14 2-14 2z" />
  </svg>
);

/**
 * Telegram brand mark.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconTelegram = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm4.96 7.22c.1 0 .32.03.46.14a.5.5 0 0 1 .17.33c.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.22-.46-1.9-.9-1.05-.7-1.65-1.13-2.68-1.8-1.18-.78-.41-1.21.27-1.91.17-.19 3.24-2.98 3.3-3.23 0-.03 0-.15-.06-.2-.06-.06-.16-.05-.24-.03-.1.02-1.8 1.14-5.12 3.37-.48.33-.92.5-1.31.49-.43 0-1.25-.24-1.87-.44-.75-.25-1.35-.38-1.3-.79.03-.22.33-.44.9-.67 3.5-1.52 5.83-2.52 7-3.01 3.33-1.39 4.02-1.63 4.48-1.64Z" />
  </svg>
);

/**
 * WhatsApp brand mark.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconWhatsApp = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2a9.93 9.93 0 0 0-8.6 14.9L2 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01a9.94 9.94 0 0 0 7.05-16.92ZM12 20.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1 1.28-10.2 8.23 8.23 0 0 1 14.04 5.82A8.25 8.25 0 0 1 12 20.15Zm4.52-6.18c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.55.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.07-.24-.13-1.04-.39-1.98-1.23a7.4 7.4 0 0 1-1.38-1.72c-.14-.25-.01-.38.11-.5.11-.12.29-.3.43-.44.11-.13.19-.24.28-.4.1-.17.05-.31-.04-.44-.1-.12-.58-1.39-.8-1.9-.2-.48-.4-.42-.55-.42h-.48c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.06 0 1.22.88 2.4 1 2.56.13.17 1.75 2.67 4.23 3.74.59.26 1.05.4 1.41.52.6.19 1.13.16 1.56.1.47-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" />
  </svg>
);

/**
 * Chain link icon used for the "copy link" action.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconLink = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.8-1.7" />
  </svg>
);

/**
 * Checkmark shown after the link has been copied.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconCheck = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);

/**
 * Three dots icon for opening the device's own share sheet.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add style rules for the svg element
 * @returns {JSX.Element} SVG icon
 */
export const IconMore = props => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
