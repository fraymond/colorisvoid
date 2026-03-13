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
        <div className="homeTagline muted">Form appears. Meaning emerges.</div>
      </section>

      <section id="preface" className="homePreface" aria-label="缘起">
        <div className="homePrefaceTitle">缘起</div>
        <div className="prose">
          <p>人类每一次制造工具，都是将自己重新塑形一次。</p>
          <p>
            人工智能常被理解为能力的延伸 - 更快的计算，更大的记忆，更稳定的判断。但在使用中，我开始意识到，我并不只是让它帮我完成一件事情，我希望它用我的方式去完成这件事情。
          </p>
          <p>在回应我之前，它先迫使我把问题想明白，说清楚。</p>
          <p>
            在被不断追问，不断复述， 不断映照的过程中，我开始听到自己原本忽略的那部分声音。这是一个让人感到愉悦的过程。
          </p>
          <p>
            Colorisvoid 并不试图解释人与 AI 的未来。这里只是记录一些正在发生的片刻，犹豫，试探，沉默，以及偶尔出现的明亮。
          </p>
          <p>网站一个传统工具，何去何从，我也不知道。</p>
          <p>若你在这里停留，可以多问，不必急着等答案。</p>
        </div>
      </section>
    </div>
  );
}
