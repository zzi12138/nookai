import './globals.css';

export const metadata = {
  title: 'NookAI (栖息小窝)',
  description: '猫咪包工头陪你把出租屋变成理想小窝。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-amber-50 text-stone-800 antialiased">
        {children}
      </body>
    </html>
  );
}
