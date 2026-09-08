import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Wake2Adapt · Voice practice',
  description:
    'Record a greeting, then practice Korean with your voice reference.',
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
