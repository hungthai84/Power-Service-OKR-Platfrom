import type { Metadata } from 'next';
import { Play, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const play = Play({
  weight: ['400', '700'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-play',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '600', '700'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FlowOKR — OKR, Project & Task trên Google Sheets',
  description:
    'Ứng dụng quản trị Mục tiêu (OKR), Dự án (Project) và Công việc (Task) song ngữ Việt - Hàn, đăng nhập tài khoản Google và lưu trữ đồng bộ trực tiếp vào Google Drive & Google Sheets.',
  openGraph: {
    title: 'FlowOKR — OKR, Project & Task trên Google Sheets',
    description:
      'Ứng dụng quản trị Mục tiêu (OKR), Dự án (Project) và Công việc (Task) song ngữ Việt - Hàn, lưu trữ trên Google Drive & Google Sheets.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlowOKR — OKR, Project & Task trên Google Sheets',
    description:
      'Quản trị OKR, Dự án & Công việc kết nối trực tiếp Google Drive & Google Sheets.',
  },
};

const SYSTEM_THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('flowokr_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${play.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="font-sans antialiased glass-canvas text-slate-900 dark:text-slate-100 transition-colors duration-200"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
