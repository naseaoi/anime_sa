const FORBIDDEN_INITIAL_MODULES = [
  '/src/components/CardEditModal.tsx',
  '/src/services/publicDataMutationService.ts',
  '/node_modules/react-day-picker/',
  '/node_modules/date-fns/'
];

const normalizeModuleId = (value) => String(value || '').replaceAll('\\', '/');

export const findForbiddenInitialModules = (bundle) => {
  const chunks = new Map(
    Object.values(bundle)
      .filter((output) => output.type === 'chunk')
      .map((chunk) => [chunk.fileName, chunk])
  );
  const pending = [...chunks.values()].filter((chunk) => chunk.isEntry);
  const visited = new Set();
  const violations = new Set();

  while (pending.length > 0) {
    const chunk = pending.pop();
    if (!chunk || visited.has(chunk.fileName)) continue;
    visited.add(chunk.fileName);

    for (const moduleId of Object.keys(chunk.modules)) {
      const normalized = normalizeModuleId(moduleId);
      for (const marker of FORBIDDEN_INITIAL_MODULES) {
        if (normalized.includes(marker)) violations.add(normalized);
      }
    }
    for (const importedFile of chunk.imports) {
      const importedChunk = chunks.get(importedFile);
      if (importedChunk) pending.push(importedChunk);
    }
  }

  return [...violations].sort();
};

export const clientBundleGuard = () => ({
  name: 'client-bundle-guard',
  generateBundle(_options, bundle) {
    const violations = findForbiddenInitialModules(bundle);
    if (violations.length > 0) {
      throw new Error(`Initial bundle includes forbidden modules:\n${violations.join('\n')}`);
    }
  }
});
