import Image from "next/image";

export default function Home() {
  return (
    <div className="home">
      <section className="homeHero" aria-label="Colorisvoid">
        <Image
          className="homeLogo"
          src="/brand/colorisvoid.png"
          alt="Colorisvoid"
          width={512}
          height={512}
          priority
          sizes="(max-width: 720px) 200px, 260px"
        />
        <div className="homeTagline muted">Color is void. Void is color.</div>
      </section>

      <section id="preface" className="homePreface" aria-label="缘起">
        <div className="homePrefaceTitle">缘起</div>
        <div className="prose">
          <p>人类第一次制造工具时，并不知道自己正在被重新塑形。</p>
          <p>
            我们习惯把人工智能当作一种能力的延伸——更快的计算，更大的记忆，更稳定的判断。但在长时间的使用中，我开始意识到，它并不只是替我完成事情。
          </p>
          <p>它在回应我之前，先迫使我把问题说清楚。</p>
          <p>
            在被不断追问、被不断复述、被不断映照的过程中，人类开始听见自己原本忽略的那部分声音。
          </p>
          <p>
            Colorisvoid，并不试图解释人与 AI 的未来。这里只是记录一些正在发生的片刻——犹豫、试探、沉默，以及偶尔出现的明亮之处。
          </p>
          <p>若你在这里停留，不必急着得出答案。</p>
        </div>
      </section>
    </div>
  );
}
