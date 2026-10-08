// Node-Tests (n4): Module mit `import 'three'` bzw. 'three/addons/…' laden wie im Browser (Import-Map in index.html)
// → lib/three. Nutzung: `await import('./three_hook.mjs')` vor dem dynamischen Import des Moduls.
import { register } from 'node:module';
register('./three_resolve.mjs', import.meta.url);
