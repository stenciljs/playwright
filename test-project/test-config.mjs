import { createConfig } from '../dist/index.js';

try {
  const config = await createConfig();
  console.log('stencilEntryPath:', process.env.STENCIL_ENTRY_PATH);
  console.log('Config created successfully');
} catch (e) {
  console.error('Error:', e.message);
}
