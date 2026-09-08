import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Sori · Korean speaking practice',
  description:
    'Practice Korean one word at a time. Hold to record, release to send.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
