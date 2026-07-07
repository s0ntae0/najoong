import "./globals.css";

export const metadata = {
  title: "나중 — 나중에 볼 링크, 알아서 정리",
  description: "URL 하나만 넣으면 자동 분류되어 카테고리별 서랍에 정리됩니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
