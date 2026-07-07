import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// BASE_PATH is set by the deploy workflow for GitHub Pages project sites
// (e.g. "/timeless/"); defaults to "/" for local dev and user/root pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [svelte()],
});
