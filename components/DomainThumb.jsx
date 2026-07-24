// 썸네일 대체 표시: 이미지가 없거나 못 불러온 링크에 도메인 첫 글자를
// 클레이 팔레트(포인트 틴트 배경 + 클레이 글자)로 그린다.
// 파싱 실패 카드와 이미지 로드 실패 카드가 같은 표시를 공유한다.
export default function DomainThumb({ domain, className = "", letterClassName = "text-xl" }) {
  const letter = (domain?.replace(/^www\./, "").charAt(0) || "?").toUpperCase();
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-primary-weak ${className}`}
      aria-hidden
    >
      <span className={`font-semibold text-primary ${letterClassName}`}>{letter}</span>
    </div>
  );
}
