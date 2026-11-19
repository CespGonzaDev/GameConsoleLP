/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: "#0b0f19",
          surface: "#131b2e",
          card: "#1e293b",
          border: "#334155",
          accent: "#10b981",
          cyan: "#06b6d4",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#a855f7"
        }
      },
      fontFamily: {
        arcade: ['"Press Start 2P"', 'monospace'],
        pixel: ['"Silkscreen"', 'monospace'],
        terminal: ['"VT323"', 'monospace'],
        mono: ['"Silkscreen"', '"VT323"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        'brutal-green': '4px 4px 0px 0px #10b981',
        'brutal-cyan': '4px 4px 0px 0px #06b6d4',
        'brutal-amber': '4px 4px 0px 0px #f59e0b',
        'brutal-dark': '4px 4px 0px 0px #020617',
        'brutal-sm': '2px 2px 0px 0px #020617',
        'pixel-green': '0 -3px 0 0 #10b981, 0 3px 0 0 #10b981, -3px 0 0 0 #10b981, 3px 0 0 0 #10b981, 4px 4px 0 0 #020617',
        'pixel-cyan': '0 -3px 0 0 #06b6d4, 0 3px 0 0 #06b6d4, -3px 0 0 0 #06b6d4, 3px 0 0 0 #06b6d4, 4px 4px 0 0 #020617',
        'pixel-amber': '0 -3px 0 0 #f59e0b, 0 3px 0 0 #f59e0b, -3px 0 0 0 #f59e0b, 3px 0 0 0 #f59e0b, 4px 4px 0 0 #020617',
        'pixel-rose': '0 -3px 0 0 #f43f5e, 0 3px 0 0 #f43f5e, -3px 0 0 0 #f43f5e, 3px 0 0 0 #f43f5e, 4px 4px 0 0 #020617',
      }
    },
  },
  plugins: [],
}
