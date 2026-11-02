const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { load } = require('./support/load.cjs');

function imageRenderer() {
  let failedSrc = null;
  const Image = load('components/FallbackImg.tsx', {
    react: { ...React, useState: () => [failedSrc, value => { failedSrc = value; }] },
  }).default;
  return (src, extra = {}) => Image({ src, alt: '상품 사진 전체', className: 'product-media-image', ...extra });
}

test('an image failure is limited to that URL; replacing the photo restores the real image', () => {
  const render = imageRenderer();
  const first = render('/uploads/old.jpg');
  assert.equal(first.type, 'img');
  first.props.onError();
  assert.equal(render('/uploads/old.jpg').type, 'div');
  const replacement = render('/uploads/new.jpg?v=2');
  assert.equal(replacement.type, 'img');
  assert.equal(replacement.props.src, '/uploads/new.jpg?v=2');
  assert.equal(replacement.props.alt, '상품 사진 전체');
});

test('missing photos retain their media frame and an accessible fallback', () => {
  const render = imageRenderer();
  for (const src of [null, undefined, '', '   ']) {
    const fallback = render(src);
    assert.equal(fallback.type, 'div');
    assert.equal(fallback.props.className, 'product-media-image');
    assert.equal(fallback.props.role, 'img');
    assert.equal(fallback.props['aria-label'], '상품 사진 전체');
  }
  const image = render(' /uploads/valid.jpg ');
  assert.equal(image.type, 'img');
  assert.equal(image.props.src, '/uploads/valid.jpg');
});
