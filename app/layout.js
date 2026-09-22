import "./globals.css";

export const metadata = {
  title: "Shooter",
  description: "A browser shooter built with Next.js and Three.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
