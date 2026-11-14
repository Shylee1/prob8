import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProb8Modelfile, selectOptimalOllamaModel } from './ollamaHardware.ts';

test('selectOptimalOllamaModel chooses 8B for >=16GB RAM workstations', () => {
  const m = selectOptimalOllamaModel(16, 8, 'Apple M2 Pro');
  assert.equal(m.recommendedModelTag, 'prob8-realestate-8b');
  assert.equal(m.recommendedBaseModel, 'llama3.1:8b');
});

test('selectOptimalOllamaModel chooses 3B for 8GB mid-tier laptops', () => {
  const m = selectOptimalOllamaModel(8, 4, 'Intel Iris Xe');
  assert.equal(m.recommendedModelTag, 'prob8-realestate-3b');
  assert.equal(m.recommendedBaseModel, 'llama3.2:3b');
});

test('selectOptimalOllamaModel chooses 1B for low-RAM devices', () => {
  const m = selectOptimalOllamaModel(4, 2, 'Basic Integrated');
  assert.equal(m.recommendedModelTag, 'prob8-realestate-1b');
  assert.equal(m.recommendedBaseModel, 'llama3.2:1b');
});

test('buildProb8Modelfile embeds selected base model tag cleanly', () => {
  const mf = buildProb8Modelfile('llama3.1:8b');
  assert.match(mf, /^FROM llama3\.1:8b/);
  assert.match(mf, /Prob8 Probate Real Estate Acquisitions Underwriter/);
});
