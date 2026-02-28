const logos = [
  { name: "Next.js", src: "/images/partners/next-logo.png" },
  { name: "Turbo", src: "/images/partners/turbo-logo.png" },
  { name: "v0", src: "/images/partners/v0green-logo.png" },
  { name: "AI SDK", src: "/images/partners/aisdk-logo.png" },
  { name: "Vercel", src: "/images/partners/vercel-logo.png" },
];

export default function InfiniteLogoSlider() {
  const singleSequence = [...logos, ...logos, ...logos, ...logos];
  const sliderContent = [...singleSequence, ...singleSequence];

  return (
    <div className="w-full overflow-hidden py-10 relative mask-gradient bg-transparent">
      <div className="flex w-max animate-infinite-slide">
        {sliderContent.map((logo, index) => (
          <div
            key={index}
            className="relative h-[35px] w-[150px] flex items-center justify-center flex-shrink-0 mx-8 opacity-100 hover:grayscale hover:opacity-70 transition-all duration-300"
          >
            <img
              src={logo.src || "/placeholder.svg"}
              alt={logo.name}
              className="h-full w-auto max-h-[30px] object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
