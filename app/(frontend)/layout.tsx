import type { Metadata } from 'next';
import '../globals.css';
import '../../puck/tokens.css';

export const metadata: Metadata = {
  title: 'Pock CMS Editor',
  description: 'POC de CMS headless com Payload e Puck.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
