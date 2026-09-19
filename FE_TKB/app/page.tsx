import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CirclePlay,
  Clock3,
  Database,
  GitMerge,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import AppLogo from "./components/AppLogo";
import LandingHeader from "./components/landing/LandingHeader";
import ScrollRevealGroup from "./components/landing/ScrollRevealGroup";

const benefits = [
  {
    icon: Clock3,
    image: "/images/landing/feature-time-saving-voxel.png",
    title: "Tiết kiệm thời gian",
    description: "Tự động xử lý hàng nghìn ràng buộc trong một quy trình rõ ràng.",
  },
  {
    icon: ShieldCheck,
    image: "/images/landing/feature-conflict-detection-voxel.png",
    title: "Giảm xung đột",
    description: "Cảnh báo trùng giáo viên, phòng học và tiết dạy trước khi công bố.",
  },
  {
    icon: SlidersHorizontal,
    image: "/images/landing/feature-flexible-editing-voxel.png",
    title: "Điều chỉnh linh hoạt",
    description: "Khóa tiết, đổi lịch và tinh chỉnh mà không phải làm lại từ đầu.",
  },
];

const steps = [
  {
    icon: UploadCloud,
    title: "Nhập dữ liệu",
    description: "Cập nhật lớp học, giáo viên, môn học, phòng học và các ràng buộc.",
  },
  {
    icon: GitMerge,
    title: "Chạy xếp lịch",
    description: "Hệ thống tự động xử lý dữ liệu và tạo lịch học phù hợp trong vài phút.",
  },
  {
    icon: CalendarCheck2,
    title: "Duyệt và công bố",
    description: "Xem trước, điều chỉnh khi cần và công bố lịch học đến toàn trường.",
  },
];

export default function Home() {
  return (
    // overflow-x-clip chứ không phải overflow-x-hidden: hidden biến thẻ này thành một vùng
    // cuộn riêng, khiến header position:sticky trôi đi và chỉ hiện lại khi về đầu trang.
    <div className="landing-page min-h-[100dvh] overflow-x-clip bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      <a className="skip-link" href="#noi-dung-chinh">
        Bỏ qua điều hướng
      </a>

      <LandingHeader />

      <main id="noi-dung-chinh">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container landing-hero-grid grid items-center gap-8 lg:grid-cols-12">
            <ScrollRevealGroup className="lg:col-span-7" ariaLabel="Giới thiệu MiKiTimetable">
              <h1 data-reveal-item id="hero-title" className="landing-display">
                <span className="landing-display-line">Xếp thời khóa biểu,</span>
                <span className="landing-display-line landing-display-accent">nhẹ như chơi</span>
              </h1>
              <p data-reveal-item className="mt-6 max-w-[44rem] text-lg leading-8 text-[var(--landing-muted)]">
                Tự động sắp xếp lịch học, giảm xung đột và giúp nhà trường vận hành gọn hơn.
              </p>
              <div data-reveal-item className="mt-8 flex flex-wrap items-center gap-4">
                <a className="landing-button landing-button--primary" href="#tinh-nang">
                  Khám phá tính năng <ArrowRight aria-hidden size={18} />
                </a>
                <a className="landing-text-link" href="#cach-hoat-dong">
                  <CirclePlay aria-hidden size={20} /> Xem cách hoạt động
                </a>
              </div>
              <div data-reveal-item className="landing-hero-points mt-10" aria-label="Lợi ích chính">
                <span><Clock3 aria-hidden size={18} /> Tiết kiệm thời gian</span>
                <span><ShieldCheck aria-hidden size={18} /> Giảm xung đột</span>
                <span><CalendarCheck2 aria-hidden size={18} /> Lịch học hợp lý hơn</span>
              </div>
            </ScrollRevealGroup>

            <ScrollRevealGroup className="relative lg:col-span-5" ariaLabel="Minh họa lịch học MiKiTimetable">
              <div data-reveal-item data-reveal-kind="image" className="landing-hero-art">
                <div className="landing-orbit landing-orbit--one" aria-hidden />
                <div className="landing-orbit landing-orbit--two" aria-hidden />
                <Image
                  src="/images/landing/hero-campus-voxel.png"
                  alt="Mô hình 3D pixel gồm lịch học, đồng hồ, sách và trường học"
                  width={1536}
                  height={1024}
                  priority
                  sizes="(max-width: 768px) 100vw, 58vw"
                  className="landing-breathe landing-breathe--slow relative z-10 h-auto w-full object-contain"
                />
              </div>
            </ScrollRevealGroup>
          </div>
        </section>

        <section id="tinh-nang" className="landing-section landing-section--features" aria-labelledby="features-title">
          <div className="landing-container">
            <div className="mx-auto max-w-6xl text-center">
              <h2 id="features-title" className="landing-heading">Một lịch học tốt bắt đầu từ dữ liệu đúng</h2>
              <p className="landing-section-copy mx-auto mt-5">
                MiKiTimetable giúp nhà trường khai thác dữ liệu hiệu quả để tạo lịch học tối ưu, linh hoạt và phù hợp với thực tế.
              </p>
            </div>

            <ScrollRevealGroup className="landing-feature-grid mt-12" ariaLabel="Ba tính năng chính">
                {benefits.map(({ icon: Icon, image, title, description }, index) => (
                  <article data-reveal-item key={title} className={`landing-feature-row landing-feature-row--${index + 1}`}>
                    <div className="landing-feature-copy">
                      <div className="landing-icon-tile" aria-hidden><Icon size={24} /></div>
                      <div>
                      <h3 className="text-lg font-bold text-[var(--landing-ink)]">{title}</h3>
                      <p className="mt-2 leading-7 text-[var(--landing-muted)]">{description}</p>
                      </div>
                    </div>
                    <div className="landing-feature-art" aria-hidden>
                      <Image
                        src={image}
                        alt=""
                        width={1254}
                        height={1254}
                        sizes="(max-width: 767px) 88vw, 30vw"
                        className="landing-feature-image landing-breathe"
                      />
                    </div>
                  </article>
                ))}
            </ScrollRevealGroup>
          </div>
        </section>

        <section id="cach-hoat-dong" className="landing-section landing-section--workflow" aria-labelledby="workflow-title">
          <div className="landing-container">
            <div className="mx-auto max-w-5xl text-center">
              <h2 id="workflow-title" className="landing-heading">Từ dữ liệu đến lịch hoàn chỉnh</h2>
              <p className="landing-section-copy mx-auto mt-5">Chỉ với ba bước rõ ràng, nhà trường đã có một thời khóa biểu phù hợp để duyệt và công bố.</p>
            </div>

            <ScrollRevealGroup className="landing-workflow-art mt-8" ariaLabel="Minh họa ba bước tạo lịch">
              <div data-reveal-item data-reveal-kind="image" className="landing-workflow-piece">
                <Image src="/images/landing/workflow-upload-voxel.png" alt="" width={724} height={724} className="landing-workflow-image landing-breathe" />
              </div>
              <ArrowRight data-reveal-item className="landing-workflow-arrow" size={36} aria-hidden />
              <div data-reveal-item data-reveal-kind="image" className="landing-workflow-piece">
                <Image src="/images/landing/workflow-schedule-voxel.png" alt="" width={724} height={724} className="landing-workflow-image landing-breathe" />
              </div>
              <ArrowRight data-reveal-item className="landing-workflow-arrow" size={36} aria-hidden />
              <div data-reveal-item data-reveal-kind="image" className="landing-workflow-piece">
                <Image src="/images/landing/workflow-publish-voxel.png" alt="" width={724} height={724} className="landing-workflow-image landing-breathe" />
              </div>
            </ScrollRevealGroup>
            <ScrollRevealGroup className="landing-steps mt-2" ariaLabel="Quy trình ba bước">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <article data-reveal-item key={title} className="landing-step">
                  <div className="landing-step-title">
                    <span className="landing-step-number">{index + 1}</span>
                    <Icon className="landing-step-fallback-icon" aria-hidden size={24} strokeWidth={1.8} />
                    <h3 className="text-xl font-bold">{title}</h3>
                  </div>
                  <p className="mt-3 leading-7 text-[var(--landing-muted)]">{description}</p>
                </article>
              ))}
            </ScrollRevealGroup>
          </div>
        </section>

        <section id="tro-ly-miki" className="landing-section landing-section--assistant" aria-labelledby="assistant-title">
          <div className="landing-container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 id="assistant-title" className="landing-heading">Có Miki hỗ trợ mỗi ngày</h2>
              <p className="landing-section-copy landing-section-copy--single-line mx-auto mt-5">Hỏi nhanh, tra cứu dễ dàng. Miki luôn sẵn sàng hỗ trợ thầy cô và nhà trường trong mọi tình huống.</p>
            </div>

            <div className="landing-assistant-grid mt-8 grid items-center gap-8 lg:grid-cols-12">
            <ScrollRevealGroup className="relative lg:col-span-5" ariaLabel="Trợ lý Miki">
              <div data-reveal-item data-reveal-kind="image" className="landing-miki-art">
                <div className="landing-miki-bubble">Xin chào!<br />Mình là Miki!<br />Bạn cần hỗ trợ gì?</div>
                <Image
                  src="/images/assistant/miki-assistant-3d.png"
                  alt="Trợ lý Miki đang chào và sẵn sàng hỗ trợ"
                  width={512}
                  height={512}
                  sizes="(max-width: 1024px) 70vw, 36vw"
                  className="mx-auto h-auto w-full max-w-[480px] object-contain"
                />
              </div>
            </ScrollRevealGroup>

            <div className="lg:col-span-7">
              <ScrollRevealGroup className="landing-chat" ariaLabel="Ví dụ hội thoại với Miki">
                <div data-reveal-item className="landing-chat-message landing-chat-message--user">
                  <span className="landing-chat-avatar" aria-hidden><Database size={18} /></span>
                  <p>Cho mình xem lịch dạy của cô Nguyễn Thị Lan tuần này nhé!</p>
                </div>
                <div data-reveal-item className="landing-chat-message landing-chat-message--miki">
                  <span className="landing-chat-avatar landing-chat-avatar--miki" aria-hidden><Sparkles size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p>Dạ, đây là lịch dạy của cô Nguyễn Thị Lan.</p>
                    <div className="landing-mini-schedule mt-4" aria-label="Lịch dạy minh họa">
                      <span>Thứ 2</span><strong>07:00</strong><span>Toán · 10A1</span>
                      <span>Thứ 3</span><strong>09:15</strong><span>Toán · 10A3</span>
                      <span>Thứ 5</span><strong>13:00</strong><span>Toán · 10A1</span>
                    </div>
                  </div>
                </div>
                <div data-reveal-item className="landing-chat-input" aria-hidden>
                  <span>Nhập câu hỏi của bạn...</span><Send size={18} />
                </div>
              </ScrollRevealGroup>
            </div>
            </div>
          </div>
        </section>

        <section className="landing-cta-section" aria-labelledby="cta-title">
          <div className="landing-container">
            <div className="landing-cta-grid">
              <ScrollRevealGroup className="relative z-10" ariaLabel="Bắt đầu sử dụng MiKiTimetable">
                <h2 data-reveal-item id="cta-title" className="landing-heading">Sẵn sàng để lịch học tự vào đúng chỗ?</h2>
                <p data-reveal-item className="mt-5 max-w-xl leading-7 text-[var(--landing-muted)]">
                  Đăng nhập để khám phá sức mạnh của MiKiTimetable và bắt đầu tạo thời khóa biểu thông minh cho nhà trường.
                </p>
                <div data-reveal-item className="mt-8">
                  <Link className="landing-button landing-button--primary" href="/login">
                    Đăng nhập ngay <ArrowRight aria-hidden size={18} />
                  </Link>
                </div>
              </ScrollRevealGroup>
              <ScrollRevealGroup ariaLabel="Minh họa trường học và lịch hoàn chỉnh">
                <div data-reveal-item data-reveal-kind="image" className="landing-cta-art">
                  <Image
                    src="/images/landing/cta-campus-voxel.png"
                    alt="Mô hình 3D pixel gồm sách, lịch và trường học"
                    width={1536}
                    height={1024}
                    sizes="(max-width: 1024px) 100vw, 48vw"
                    className="landing-breathe landing-breathe--offset h-auto w-full object-contain"
                  />
                </div>
              </ScrollRevealGroup>
            </div>
          </div>
        </section>
      </main>

      <footer id="lien-he" className="landing-footer">
        <div className="landing-container landing-footer-main">
          <div className="landing-footer-brand">
            <Link href="/" aria-label="MiKiTimetable, trang chủ">
              <AppLogo size="lg" tone="light" />
            </Link>
            <p>Hệ thống xếp thời khóa biểu thông minh dành cho nhà trường.</p>
          </div>

          <nav className="landing-footer-column" aria-label="Thông tin chung">
            <h2>Thông tin chung</h2>
            <Link href="/">Trang chủ</Link>
            <Link href="/login">Đăng nhập</Link>
          </nav>

          <div className="landing-footer-column">
            <h2>Liên hệ</h2>
            <a href="https://mikitech.io" target="_blank" rel="noreferrer">Hỗ trợ khách hàng</a>
            <a href="mailto:support@gettimetable.cloud">support@gettimetable.cloud</a>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div className="landing-container">
            <p>MiKiTimetable © 2026. Mọi quyền được bảo lưu.</p>
            <p>
              Phát triển bởi{' '}
              <a href="https://mikitech.io" target="_blank" rel="noreferrer">
                <strong>MiKiTech</strong>
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
