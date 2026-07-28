import { describe, expect, it } from 'vitest';
import { findForbiddenInitialModules } from './client-bundle-guard.js';

const chunk = (fileName, options = {}) => ({
  type: 'chunk',
  fileName,
  isEntry: false,
  imports: [],
  modules: {},
  ...options
});

describe('client bundle guard', () => {
  it('ignores forbidden modules that are only dynamically reachable', () => {
    const bundle = {
      'entry.js': chunk('entry.js', { isEntry: true }),
      'edit.js': chunk('edit.js', {
        modules: { 'F:\\repo\\src\\components\\CardEditModal.tsx': {} }
      })
    };

    expect(findForbiddenInitialModules(bundle)).toEqual([]);
  });

  it('reports forbidden modules in the initial static graph', () => {
    const bundle = {
      'entry.js': chunk('entry.js', { isEntry: true, imports: ['vendor.js'] }),
      'vendor.js': chunk('vendor.js', {
        modules: { 'F:\\repo\\node_modules\\date-fns\\index.js': {} }
      })
    };

    expect(findForbiddenInitialModules(bundle)).toEqual([
      'F:/repo/node_modules/date-fns/index.js'
    ]);
  });
});
