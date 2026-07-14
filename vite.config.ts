import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Static build (AD-9): `vite build` emits a self-contained bundle to dist/,
// meant to be served same-origin from Home Assistant (add-on / ingress / www).
// No application server. Tailwind is primary (styling convention); the Emotion
// CSS-in-JS used internally by @hakit/components stays isolated to it.
// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // AD-8 / T0.5 guard: Vite statically inlines `import.meta.env.VITE_*` into the
  // bundle, so a production build with the HA token set would leak it into the
  // readable static build. The token is a dev-server convenience only; the
  // shippable build must rely on the HA session (same-origin). Fail loudly
  // rather than silently baking a secret into dist/.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_HA_TOKEN')
    if (env.VITE_HA_TOKEN) {
      throw new Error(
        'AD-8: VITE_HA_TOKEN is set for a production build and would be inlined ' +
          'into dist/. Unset it and rely on the HA session (same-origin), or ' +
          'build in an environment without the token.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
