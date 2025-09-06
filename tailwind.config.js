/** @type {import('tailwindcss').Config} */
const config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: '#121212',
                card: '#1E1E1E',
                input: '#2A2A2A',
                border: '#3A3A3A',
                foreground: '#EAEAEA',
                accent: '#A0A0A0',
                primary: '#A78BFA', // Purple
                'primary-hover': '#9370DB',
                secondary: '#60A5FA', // Blue
                'secondary-hover': '#3B82F6',
            }
        },
    },
    plugins: [],
};

export default config;