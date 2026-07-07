(() => {
  'use strict';
  const E = window.TangoEngine;
  if (!E || E.__liGeneratorScaffold) return;
  const originalGenerate = E.generatePuzzle;
  E.generatorModes = [
    { id: 'hybrid', label: 'LI mix' },
    { id: 'skeleton', label: 'LI skeleton' },
    { id: 'mutant', label: 'LI mutant' },
    { id: 'grammar', label: 'LI grammar' },
    { id: 'archive', label: 'Archive replay' },
    { id: 'original', label: 'Old generator' }
  ];
  E.setGeneratorMode = function setGeneratorMode(id) {
    if (!E.generatorModes.some(m => m.id === id)) throw new Error('Unknown Tango generator: ' + id);
    localStorage.setItem('tangoGenerator', id);
    return id;
  };
  E.currentGeneratorMode = function currentGeneratorMode() {
    return localStorage.getItem('tangoGenerator') || 'hybrid';
  };
  E.generatePuzzle = function generatePuzzleWithMode() {
    const mode = E.currentGeneratorMode();
    const puzzle = originalGenerate();
    puzzle.generator = mode === 'original' ? 'original' : 'scaffold';
    puzzle.mode = mode === 'original' ? puzzle.mode : 'LI scaffold';
    return puzzle;
  };
  E.__liGeneratorScaffold = true;
})();
