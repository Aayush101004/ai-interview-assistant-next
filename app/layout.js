import './globals.css';

export const metadata = {
  title: 'AI Interview Assistant',
  description: 'AI-powered interview practice platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-900 text-gray-200 font-sans">
        {children}
      </body>
    </html>
  );
}