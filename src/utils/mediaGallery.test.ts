import test from 'node:test';
import assert from 'node:assert/strict';
import { isRealPropertyPhoto, resolveSmartPropertyMedia } from './mediaGallery';

test('isRealPropertyPhoto rejects generic map thumbnails and empty strings', () => {
  assert.equal(isRealPropertyPhoto(''), false);
  assert.equal(isRealPropertyPhoto('https://maps.googleapis.com/maps/api/staticmap?center=40,-83'), false);
  assert.equal(isRealPropertyPhoto('https://maps.googleapis.com/maps/api/streetview?size=400x300'), false);
  assert.equal(isRealPropertyPhoto('https://cdn.example.com/no-photo-placeholder.png'), false);
  assert.equal(isRealPropertyPhoto('/src/assets/images/prop_craftsman_ext_1794630630705.jpg'), true);
});

test('resolveSmartPropertyMedia skips Zillow with <= 3 photos and falls back to Redfin with > 3 real photos', () => {
  const zillow = [
    'https://maps.googleapis.com/maps/api/staticmap?center=1,1',
    '/src/assets/images/prop_craftsman_ext_1794630630705.jpg',
    '/src/assets/images/prop_kitchen_int_1794630631904.jpg',
  ];
  const redfin = [
    '/src/assets/images/prop_colonial_ext_1794630631551.jpg',
    '/src/assets/images/prop_kitchen_int_1794630631904.jpg',
    '/src/assets/images/prop_living_int_1794630632820.jpg',
    '/src/assets/images/prop_craftsman_ext_1794630630705.jpg',
  ];

  const result = resolveSmartPropertyMedia(zillow, redfin);
  assert.equal(result.mode, 'photos');
  assert.equal(result.selectedSource, 'redfin');
  assert.equal(result.photos.length, 4);
  assert.equal(result.zillowRealCount, 2);
  assert.equal(result.redfinRealCount, 4);
});

test('resolveSmartPropertyMedia uses Zillow when Zillow has > 3 genuine photos', () => {
  const zillow = ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg'];
  const redfin = ['/e.jpg', '/f.jpg', '/g.jpg', '/h.jpg'];
  const result = resolveSmartPropertyMedia(zillow, redfin);
  assert.equal(result.mode, 'photos');
  assert.equal(result.selectedSource, 'zillow');
  assert.equal(result.photos.length, 4);
});

test('resolveSmartPropertyMedia falls back to streetview_satellite when neither source has > 3 real photos', () => {
  const zillow = [
    'https://maps.googleapis.com/maps/api/staticmap?center=1,1',
    '/a.jpg',
    '/b.jpg',
    '/c.jpg',
  ];
  const redfin = ['/d.jpg'];
  const result = resolveSmartPropertyMedia(zillow, redfin);
  assert.equal(result.mode, 'streetview_satellite');
  assert.equal(result.selectedSource, 'google_maps');
  assert.equal(result.photos.length, 0);
});
