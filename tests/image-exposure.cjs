const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./support/load.cjs');
const { imageVisibleRegion } = load('lib/image-exposure.ts');
const Preview = load('components/admin/ImageExposurePreview.tsx').default;

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const props = { images: [], selectedIndex: 0, onSelect() {}, site: 'sanjipick', productName: '복숭아' };
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)];
}
const picture = tree => elements(tree).find(node => typeof node.type === 'function');

test('portrait poster guide keeps the exact source pixels displayed by the storefront', () => {
  const region = imageVisibleRegion(1092, 1440, 'sanjipick');
  assert.equal(region.x, 0);
  close(region.y, 104.4);
  assert.equal(region.width, 1092);
  assert.equal(region.height, 1092);
});

test('landscape and square sources have bounded, centered horizontal crops', () => {
  assert.deepEqual(imageVisibleRegion(1600, 900, 'sanjipick'), { x: 350, y: 0, width: 900, height: 900 });
  assert.deepEqual(imageVisibleRegion(800, 800, 'sanjipick'), { x: 0, y: 0, width: 800, height: 800 });
});

test('the overlay matches cover geometry at card, representative and short-screen sizes', () => {
  for (const [width, height] of [[1092, 1440], [1122, 1402], [1600, 900], [900, 900], [80, 12000]]) {
    const region = imageVisibleRegion(width, height, 'sanjipick');
    for (const frame of [170, 214, 480]) {
      const scale = Math.max(frame / width, frame / height);
      close(region.x * scale, (width * scale - frame) * 0.5);
      close(region.y * scale, (height * scale - frame) * 0.3);
      close(region.width * scale, frame);
      close(region.height * scale, frame);
      assert.ok(region.x >= 0 && region.y >= 0);
      assert.ok(region.x + region.width <= width + 1e-8);
      assert.ok(region.y + region.height <= height + 1e-8);
    }
  }
});

test('Blendpick uses the full image and invalid dimensions never draw a misleading guide', () => {
  assert.deepEqual(imageVisibleRegion(1092, 1440, 'blendpick'), { x: 0, y: 0, width: 1092, height: 1440 });
  for (const size of [0, -1, NaN, Infinity]) {
    assert.equal(imageVisibleRegion(size, 900, 'sanjipick'), null);
    assert.equal(imageVisibleRegion(900, size, 'blendpick'), null);
  }
});

test('new or replaced URLs reset the photo measurements and error state', () => {
  const oldPhoto = picture(Preview({ ...props, images: ['/old.jpg'] }));
  const newPhoto = picture(Preview({ ...props, images: ['/new.jpg'] }));
  assert.equal(newPhoto.props.src, '/new.jpg');
  assert.notEqual(oldPhoto.key, newPhoto.key);
  const blend = picture(Preview({ ...props, images: ['/new.jpg'], site: 'blendpick' }));
  assert.notEqual(newPhoto.key, blend.key);
});

test('each uploaded slot can be inspected and removing it falls back to a real remaining photo', () => {
  const selected = [];
  const tree = Preview({ ...props, images: ['/main.jpg', '', '/sub.jpg'], selectedIndex: 2, onSelect: index => selected.push(index) });
  assert.equal(picture(tree).props.src, '/sub.jpg');
  const buttons = elements(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].props['aria-pressed'], true);
  buttons[0].props.onClick();
  assert.deepEqual(selected, [0]);
  const cleared = Preview({ ...props, images: ['/main.jpg', '', ''], selectedIndex: 2 });
  assert.equal(picture(cleared).props.src, '/main.jpg');
  assert.equal(Preview({ ...props, images: ['', '  '] }), null);
});
