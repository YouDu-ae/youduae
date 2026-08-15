import React from 'react';
import ShareButton from './ShareButton';

const Wrapper = props => (
  <div style={{ padding: '24px', minHeight: '260px' }}>
    <ShareButton {...props} />
  </div>
);

export const Default = {
  component: Wrapper,
  props: {
    url: 'https://youdu.ae/l/chistka-konditionerov/6a7f25de-7978-48e8-aeb2-4f966d74eac9',
    title: 'Чистка кондиционеров после ремонта',
    text: 'Задание на YouDu: Чистка кондиционеров после ремонта',
  },
  group: 'buttons',
};
