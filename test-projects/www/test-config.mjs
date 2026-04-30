import { createConfig } from '../../dist/index.js';

const config = await createConfig();
console.log('stencilEntryPath:', process.env.STENCIL_ENTRY_PATH);
