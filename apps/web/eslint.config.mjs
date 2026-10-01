import next from 'eslint-config-next';

export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...next,
];
